#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const { extractCases, summarize } = require('./uat-e2e-matrix');
const { scanAutomatedIds } = require('./uat-e2e-coverage');

const DEFAULT_INPUT = 'UAT ActiveBoard v1.xlsx';
const DEFAULT_SPEC_DIR = 'e2e/specs';
const DEFAULT_OUT = 'e2e/specs/uat-excel-manifest.generated.spec.ts';

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    specDir: DEFAULT_SPEC_DIR,
    out: DEFAULT_OUT,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') {
      args.input = argv[index + 1] ?? args.input;
      index += 1;
    } else if (arg === '--spec-dir') {
      args.specDir = argv[index + 1] ?? args.specDir;
      index += 1;
    } else if (arg === '--out') {
      args.out = argv[index + 1] ?? args.out;
      index += 1;
    }
  }

  return args;
}

function normalizeTitle(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s().:;,'"?!/-]/g, '')
    .trim()
    .slice(0, 140);
}

function skipReason(testCase) {
  if (testCase.automationType === 'playwright-candidate') {
    return 'UAT workbook manifest: browser path identified but not yet implemented as an executable Playwright journey.';
  }

  if (testCase.automationType === 'api-or-unit') {
    return 'UAT workbook manifest: deterministic API/unit coverage required before this is promoted to an executable browser journey.';
  }

  if (testCase.automationType === 'external-service') {
    return 'UAT workbook manifest: external service behavior must be mocked or contract-tested before a reliable browser run.';
  }

  if (testCase.automationType === 'manual-or-device') {
    return 'UAT workbook manifest: this case requires real-device or manual validation beyond headless browser automation.';
  }

  return (
    testCase.reason ||
    'UAT workbook manifest: product support is required before automation.'
  );
}

function renderCase(testCase) {
  const title = normalizeTitle(
    testCase.title || testCase.module || testCase.section || testCase.sheet,
  );
  const testTitle = `${testCase.id} [${testCase.automationType}] ${title}`;
  const reason = skipReason(testCase);

  return [
    `test(${JSON.stringify(testTitle)}, async ({}, testInfo) => {`,
    `  testInfo.annotations.push({ type: 'uat-status', description: ${JSON.stringify(testCase.status || 'Unspecified')} });`,
    `  testInfo.annotations.push({ type: 'uat-sheet', description: ${JSON.stringify(testCase.sheet)} });`,
    `  testInfo.annotations.push({ type: 'automation-type', description: ${JSON.stringify(testCase.automationType)} });`,
    `  test.skip(true, ${JSON.stringify(reason)});`,
    `});`,
  ].join('\n');
}

function renderSpec({ cases, source, alreadyRunnableIds }) {
  const manifestCases = cases.filter(
    (testCase) => !alreadyRunnableIds.has(testCase.id),
  );
  const summary = summarize(cases);

  return `${[
    "import { test } from '@playwright/test';",
    '',
    '// This file is generated from the local UAT workbook.',
    '// Do not edit manually. Run `npm run uat:e2e:manifest` after replacing the Excel file.',
    `// Source: ${source}`,
    `// Total UAT cases: ${summary.total}`,
    `// Runnable IDs already implemented elsewhere: ${alreadyRunnableIds.size}`,
    `// Manifest-only IDs represented here: ${manifestCases.length}`,
    '',
    "test.describe('UAT workbook manifest coverage', () => {",
    "  test.describe.configure({ mode: 'serial' });",
    '',
    manifestCases.map(renderCase).join('\n\n'),
    '});',
    '',
  ].join('\n')}`;
}

function main() {
  const args = parseArgs(process.argv);
  const inputPath = path.resolve(process.cwd(), args.input);
  const specDir = path.resolve(process.cwd(), args.specDir);
  const outPath = path.resolve(process.cwd(), args.out);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`UAT Excel file not found: ${inputPath}`);
  }

  const cases = extractCases(inputPath);
  const { allIds: alreadyRunnableIds } = scanAutomatedIds(specDir, {
    exclude: [/uat-excel-manifest\.generated\.spec\./],
  });
  const content = renderSpec({
    cases,
    source: path.basename(inputPath),
    alreadyRunnableIds,
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content);

  console.log(
    `Generated ${path.relative(process.cwd(), outPath)} with ${
      cases.length - alreadyRunnableIds.size
    } manifest-only UAT cases.`,
  );
}

main();
