# ActiveBoard UAT E2E

This folder contains browser-level checks for UAT coverage. The suite uses
Playwright and intentionally reuses the existing QA data contract from
`scripts/qa-test-data.js`.

## QA Data

Seed or refresh the shared QA dataset only when needed:

```bash
npm run seed:qa-test-data
```

The E2E tests do not create duplicate users or groups by default. They assume
the seeded accounts and groups already exist.

Default QA password:

```text
TestActiveboard123!
```

## Commands

Generate a UAT coverage matrix from the local Excel file:

```bash
npm run uat:e2e:matrix
```

Compare the Excel cases with Playwright spec titles:

```bash
npm run uat:e2e:coverage
```

Generate the manifest spec that represents every Excel row not yet covered by
an executable Playwright journey:

```bash
npm run uat:e2e:manifest
```

Run the E2E suite against local development:

```bash
npm run test:e2e
```

Run the E2E suite against Vercel:

```bash
E2E_BASE_URL=https://activeboard.vercel.app npm run test:e2e
```

On Windows PowerShell:

```powershell
$env:E2E_BASE_URL='https://activeboard.vercel.app'; npm run test:e2e
```

## Scope

The current tests are the foundation layer: landing signup, authentication, and
dashboard tab reachability. The generated manifest makes the whole workbook
visible to Playwright without pretending that blocked, external-service, or
manual-device cases have passed. Those rows are represented as skipped tests
with their automation reason, while executable journeys live in hand-written
spec files.

When the UAT workbook is replaced with a newer version, rerun:

```bash
npm run uat:e2e:manifest
npm run uat:e2e:matrix
npm run uat:e2e:coverage
```

The coverage script scans UAT IDs directly from test names, so each new E2E test
should include the matching Excel ID, for example `REV-4.13`. Once a real
journey is implemented for an ID, regenerate the manifest so that ID disappears
from `uat-excel-manifest.generated.spec.ts` and is counted as runnable coverage.
