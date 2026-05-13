#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DEFAULT_INPUT = 'UAT ActiveBoard v1.xlsx';
const DEFAULT_SPEC_DIR = 'e2e/specs';
const TEST_ID_PATTERN = /^(?:[A-Z]{2,5}-\d+(?:\.\d+)*|INT-B\.\d+\.\d+)$/;
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

function walkSpecFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkSpecFiles(fullPath));
    } else if (
      /\.(spec|test)\.(ts|tsx|js|mjs)$/.test(entry.name) &&
      !/uat-excel-manifest\.generated\.spec\./.test(fullPath)
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function scanRunnableUatIds(specDir) {
  const ids = new Set();
  for (const filePath of walkSpecFiles(specDir)) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const id of content.match(UAT_ID_PATTERN) ?? []) {
      ids.add(id);
    }
  }

  return ids;
}

function readUInt32LE(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function unzipXlsx(filePath) {
  const buffer = fs.readFileSync(filePath);
  const entries = new Map();
  let offset = 0;

  while (offset < buffer.length - 30) {
    const signature = readUInt32LE(buffer, offset);
    if (signature !== 0x04034b50) {
      offset += 1;
      continue;
    }

    const compression = buffer.readUInt16LE(offset + 8);
    const compressedSize = readUInt32LE(buffer, offset + 18);
    const uncompressedSize = readUInt32LE(buffer, offset + 22);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + fileNameLength;
    const fileName = buffer.toString('utf8', nameStart, nameEnd);
    const dataStart = nameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;
    const rawData = buffer.subarray(dataStart, dataEnd);

    if (compression === 0) {
      entries.set(fileName, rawData.toString('utf8'));
    } else if (compression === 8) {
      entries.set(fileName, zlib.inflateRawSync(rawData).toString('utf8'));
    } else if (uncompressedSize === 0) {
      entries.set(fileName, '');
    }

    offset = dataEnd;
  }

  return entries;
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function readSharedStrings(entries) {
  const xml = entries.get('xl/sharedStrings.xml');
  if (!xml) {
    return [];
  }

  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    decodeXml(
      [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
        .map((textMatch) => textMatch[1])
        .join(''),
    ),
  );
}

function readWorkbookSheets(entries) {
  const workbook = entries.get('xl/workbook.xml') ?? '';
  const rels = entries.get('xl/_rels/workbook.xml.rels') ?? '';
  const relMap = new Map(
    [
      ...rels.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g),
    ].map(([, id, target]) => [id, target.replace(/^\/?xl\//, '')]),
  );

  return [
    ...workbook.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g),
  ].map(([, name, relId]) => ({
    name: decodeXml(name),
    path: `xl/${relMap.get(relId)}`,
  }));
}

function columnName(cellRef) {
  return cellRef.replace(/\d+/g, '');
}

function readSheetRows(entries, sheetPath, sharedStrings) {
  const xml = entries.get(sheetPath);
  if (!xml) {
    return [];
  }

  return [...xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)].map(
    ([, rowNumber, rowXml]) => {
      const row = { __row: Number(rowNumber) };
      for (const cellMatch of rowXml.matchAll(
        /<c[^>]*r="([^"]+)"([^>]*)>([\s\S]*?)<\/c>/g,
      )) {
        const [, ref, attributes, cellXml] = cellMatch;
        const valueMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/);
        const inlineMatch = cellXml.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        const rawValue = valueMatch?.[1] ?? inlineMatch?.[1] ?? '';
        let value = rawValue;

        if (attributes.includes('t="s"')) {
          value = sharedStrings[Number(rawValue)] ?? '';
        } else if (/^\d+$/.test(rawValue) && sharedStrings[Number(rawValue)]) {
          value = sharedStrings[Number(rawValue)] ?? '';
        }

        row[columnName(ref)] = decodeXml(value);
      }

      return row;
    },
  );
}

function normalize(value) {
  return String(value ?? '').trim();
}

function pickByHeader(row, headers) {
  for (const header of headers) {
    if (row[header]) {
      return row[header];
    }
  }

  const normalizedHeaders = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]),
  );
  for (const header of headers) {
    const value = normalizedHeaders[header.toLowerCase()];
    if (value) {
      return value;
    }
  }

  return '';
}

function isTestId(value) {
  return TEST_ID_PATTERN.test(value);
}

function classifyCase(testCase) {
  const text = [
    testCase.id,
    testCase.sheet,
    testCase.module,
    testCase.title,
    testCase.steps,
    testCase.expected,
    testCase.notes,
  ]
    .join(' ')
    .toLowerCase();
  const status = testCase.status.toLowerCase();

  if (status.includes('blocked')) {
    return {
      automationType: 'blocked-by-product',
      reason:
        'The current UAT status is Blocked; implement product support before browser automation.',
    };
  }

  if (
    /(stripe|payment|billing|email|mail|sms|push|calendar|webhook)/i.test(text)
  ) {
    return {
      automationType: 'external-service',
      reason:
        'Requires an external integration; automate with mocked service or API contract tests first.',
    };
  }

  if (
    /(mobile safari|iphone|android|zoom|teams|physical|manual|camera|notification permission)/i.test(
      text,
    )
  ) {
    return {
      automationType: 'manual-or-device',
      reason:
        'Requires a real device, browser permission, or third-party app behavior.',
    };
  }

  if (
    /(api|deadline|concurrency|database|quota|invite token|security)/i.test(
      text,
    )
  ) {
    return {
      automationType: 'api-or-unit',
      reason:
        'Best covered with API-level deterministic tests plus one browser smoke path.',
    };
  }

  return {
    automationType: 'playwright-candidate',
    reason: 'Good candidate for browser E2E automation.',
  };
}

function extractCases(filePath) {
  const entries = unzipXlsx(filePath);
  const sharedStrings = readSharedStrings(entries);
  const sheets = readWorkbookSheets(entries);
  const cases = [];

  for (const sheet of sheets) {
    const rows = readSheetRows(entries, sheet.path, sharedStrings);
    const headerRow = rows.find((row) =>
      Object.values(row).some((value) => normalize(value) === 'Test ID'),
    );

    if (!headerRow) {
      continue;
    }

    const headerByColumn = new Map(
      Object.entries(headerRow)
        .filter(([key]) => key !== '__row')
        .map(([key, value]) => [key, normalize(value)]),
    );

    for (const row of rows.filter(
      (candidate) => candidate.__row > headerRow.__row,
    )) {
      const byHeader = {};
      for (const [column, header] of headerByColumn.entries()) {
        byHeader[header] = normalize(row[column]);
      }

      const id = byHeader['Test ID'];
      if (!id || !isTestId(id)) {
        continue;
      }

      const testCase = {
        id,
        sheet: sheet.name,
        section: pickByHeader(byHeader, ['Section', 'Area']),
        module: pickByHeader(byHeader, ['Module', 'Feature']),
        title: pickByHeader(byHeader, [
          'Test Case',
          'Title',
          'Scenario',
          'Description',
          'Test Scenario',
          'Case',
          'Sub-section',
        ]),
        steps: pickByHeader(byHeader, [
          'Steps',
          'Test Steps',
          'Procedure',
          'Given / When',
          'Given/When',
        ]),
        expected: pickByHeader(byHeader, [
          'Expected',
          'Expected Result',
          'Expected Results',
          'Expected (Then)',
          'Acceptance Criteria',
        ]),
        status: pickByHeader(byHeader, ['Status', 'Result']),
        notes: pickByHeader(byHeader, ['Notes', 'Comment', 'Comments']),
      };

      cases.push({
        ...testCase,
        ...classifyCase(testCase),
      });
    }
  }

  return cases;
}

function summarize(cases) {
  const summary = {
    total: cases.length,
    byStatus: {},
    byAutomationType: {},
  };

  for (const testCase of cases) {
    summary.byStatus[testCase.status || 'Unspecified'] =
      (summary.byStatus[testCase.status || 'Unspecified'] ?? 0) + 1;
    summary.byAutomationType[testCase.automationType] =
      (summary.byAutomationType[testCase.automationType] ?? 0) + 1;
  }

  return summary;
}

function printTextReport(cases, runnableIds = new Set()) {
  const summary = summarize(cases);
  console.log('UAT E2E automation matrix');
  console.log('=========================');
  console.log(`Total cases: ${summary.total}`);
  console.log(`Runnable Playwright cases: ${runnableIds.size}`);
  console.log('\nBy automation type');
  for (const [type, count] of Object.entries(summary.byAutomationType)) {
    console.log(`- ${type}: ${count}`);
  }
  console.log('\nBy status');
  for (const [status, count] of Object.entries(summary.byStatus)) {
    console.log(`- ${status}: ${count}`);
  }
  console.log('\nNext Playwright candidates not yet runnable');
  for (const testCase of cases
    .filter(
      (item) =>
        item.automationType === 'playwright-candidate' &&
        !runnableIds.has(item.id),
    )
    .slice(0, 25)) {
    console.log(
      `- ${testCase.id}: ${testCase.title || testCase.module || testCase.section}`,
    );
  }
}

function main() {
  const args = parseArgs(process.argv);
  const filePath = path.resolve(process.cwd(), args.input);
  const specDir = path.resolve(process.cwd(), args.specDir);

  if (!fs.existsSync(filePath)) {
    throw new Error(`UAT Excel file not found: ${filePath}`);
  }

  const cases = extractCases(filePath);
  const runnableIds = scanRunnableUatIds(specDir);
  const payload = {
    generatedAt: new Date().toISOString(),
    source: path.basename(filePath),
    summary: summarize(cases),
    runnableIds: [...runnableIds].sort(),
    cases,
  };

  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(process.cwd(), args.out)), {
      recursive: true,
    });
    fs.writeFileSync(
      path.resolve(process.cwd(), args.out),
      JSON.stringify(payload, null, 2),
    );
  }

  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printTextReport(cases, runnableIds);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  extractCases,
  scanRunnableUatIds,
  summarize,
};
