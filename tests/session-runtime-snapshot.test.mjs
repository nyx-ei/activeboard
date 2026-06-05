import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  'supabase/migrations/20260605154500_session_runtime_snapshot_rpc.sql',
  'utf8',
);
const runtimeRoute = readFileSync(
  'app/api/sessions/[sessionId]/runtime/route.ts',
  'utf8',
);

test('session runtime is loaded through one snapshot RPC', () => {
  assert.match(
    migration,
    /create or replace function public\.activeboard_get_session_runtime/,
  );
  assert.match(runtimeRoute, /rpc\('activeboard_get_session_runtime'/);
  assert.doesNotMatch(runtimeRoute, /\.from\('answers'\)/);
  assert.doesNotMatch(runtimeRoute, /\.from\('questions'\)/);
  assert.doesNotMatch(runtimeRoute, /count: 'exact'/);
});
