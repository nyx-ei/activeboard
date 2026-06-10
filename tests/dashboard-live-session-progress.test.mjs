import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dashboardData = readFileSync('lib/demo/data.ts', 'utf8');
const dashboardGroupZone = readFileSync(
  'components/dashboard/dashboard-group-zone.tsx',
  'utf8',
);

test('dashboard live session progress uses the latest launched question', () => {
  assert.match(dashboardData, /currentQuestionNumberBySession/);
  assert.match(dashboardData, /\.not\('launched_at', 'is', null\)/);
  assert.match(dashboardData, /question\.order_index \+ 1/);
  assert.match(dashboardGroupZone, /session\.currentQuestionNumber/);
});
