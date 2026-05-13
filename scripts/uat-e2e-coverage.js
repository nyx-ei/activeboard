#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const { extractCases, summarize } = require('./uat-e2e-matrix');

const DEFAULT_INPUT = 'UAT ActiveBoard v1.xlsx';
const DEFAULT_SPEC_DIR = 'e2e/specs';
const UAT_ID_PATTERN = /\b(?:[A-Z]{2,5}-\d+(?:\.\d+)*|INT-B\.\d+\.\d+)\b/g;

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    specDir: DEFAULT_SPEC_DIR,
    json: false,
    out: null,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      args.json = true;
    } else if (arg === '--input') {
      args.input = argv[index + 1] ?? args.input;
      index += 1;
    } else if (arg === '--spec-dir') {
      args.specDir = argv[index + 1] ?? args.specDir;
      index += 1;
    } else if (arg === '--out') {
      args.out = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return args;
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (/\.(spec|test)\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function scanAutomatedIds(specDir) {
  const idsByFile = {};
  const allIds = new Set();

  for (const filePath of walkFiles(specDir)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const ids = [...new Set(content.match(UAT_ID_PATTERN) ?? [])].sort();
    if (ids.length === 0) {
      continue;
    }

    const relativePath = path.relative(process.cwd(), filePath);
    idsByFile[relativePath] = ids;
    ids.forEach((id) => allIds.add(id));
  }

  return {
    idsByFile,
    allIds,
  };
}

function buildCoverageReport({ cases, automatedIds, idsByFile }) {
  const casesById = new Map(cases.map((testCase) => [testCase.id, testCase]));
  const coveredCases = cases.filter((testCase) =>
    automatedIds.has(testCase.id),
  );
  const missingPlaywrightCandidates = cases.filter(
    (testCase) =>
      testCase.automationType === 'playwright-candidate' &&
      !automatedIds.has(testCase.id),
  );
  const missingApiOrUnitCandidates = cases.filter(
    (testCase) =>
      testCase.automationType === 'api-or-unit' &&
      !automatedIds.has(testCase.id),
  );
  const orphanAutomatedIds = [...automatedIds]
    .filter((id) => !casesById.has(id))
    .sort();

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      ...summarize(cases),
      automatedUatIds: coveredCases.length,
      missingPlaywrightCandidates: missingPlaywrightCandidates.length,
      missingApiOrUnitCandidates: missingApiOrUnitCandidates.length,
      orphanAutomatedIds: orphanAutomatedIds.length,
    },
    idsByFile,
    coveredCases,
    missingPlaywrightCandidates,
    missingApiOrUnitCandidates,
    orphanAutomatedIds,
  };
}

function printTextReport(report) {
  console.log('UAT E2E coverage');
  console.log('================');
  console.log(`Total UAT cases: ${report.summary.total}`);
  console.log(
    `Automated UAT IDs in Playwright specs: ${report.summary.automatedUatIds}`,
  );
  console.log(
    `Missing Playwright candidates: ${report.summary.missingPlaywrightCandidates}`,
  );
  console.log(
    `Missing API/unit candidates: ${report.summary.missingApiOrUnitCandidates}`,
  );

  if (report.orphanAutomatedIds.length > 0) {
    console.log('\nAutomated IDs not found in Excel');
    for (const id of report.orphanAutomatedIds) {
      console.log(`- ${id}`);
    }
  }

  console.log('\nCovered IDs by spec');
  for (const [filePath, ids] of Object.entries(report.idsByFile)) {
    console.log(`- ${filePath}: ${ids.join(', ')}`);
  }

  console.log('\nNext missing Playwright candidates');
  for (const testCase of report.missingPlaywrightCandidates.slice(0, 30)) {
    console.log(
      `- ${testCase.id}: ${testCase.title || testCase.module || testCase.section || testCase.sheet}`,
    );
  }
}

function main() {
  const args = parseArgs(process.argv);
  const inputPath = path.resolve(process.cwd(), args.input);
  const specDir = path.resolve(process.cwd(), args.specDir);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`UAT Excel file not found: ${inputPath}`);
  }

  const cases = extractCases(inputPath);
  const { allIds, idsByFile } = scanAutomatedIds(specDir);
  const report = buildCoverageReport({
    cases,
    automatedIds: allIds,
    idsByFile,
  });

  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(process.cwd(), args.out)), {
      recursive: true,
    });
    fs.writeFileSync(
      path.resolve(process.cwd(), args.out),
      JSON.stringify(report, null, 2),
    );
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report);
  }
}

main();
