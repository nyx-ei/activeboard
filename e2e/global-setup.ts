import { execFileSync } from 'node:child_process';

export default async function globalSetup() {
  if (process.env.E2E_RESET_QA_SESSIONS !== '1') {
    return;
  }

  execFileSync(
    process.execPath,
    ['scripts/qa-test-data.js', 'reset-sessions'],
    {
      env: process.env,
      stdio: 'inherit',
    },
  );
}
