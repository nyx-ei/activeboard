import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  'supabase/migrations/20260504130000_concurrency_safeguards.sql',
  'utf8',
);
const answerRoute = readFileSync(
  'app/api/sessions/[sessionId]/answer/route.ts',
  'utf8',
);
const sessionClient = readFileSync(
  'components/session/session-flow-client.tsx',
  'utf8',
);
const captainTransfer = readFileSync('lib/session/captain-transfer.ts', 'utf8');

test('captain transfer uses expected leader conditional update', () => {
  assert.match(
    migration,
    /create or replace function public\.activeboard_transfer_session_captain/,
  );
  assert.match(migration, /expected_leader_id uuid/);
  assert.match(
    migration,
    /s\.leader_id is not distinct from expected_leader_id/,
  );
  assert.match(captainTransfer, /expected_leader_id: input\.expectedLeaderId/);
});

test('answer save records request sequence and mode in the database contract', () => {
  assert.match(migration, /answer_request_sequence bigint not null default 0/);
  assert.match(migration, /answer_request_mode text not null default 'submit'/);
  assert.match(
    migration,
    /create or replace function public\.activeboard_save_session_answer_concurrent/,
  );
  assert.match(answerRoute, /request_sequence_input: requestSequence/);
  assert.match(sessionClient, /const requestSequence = Date\.now\(\)/);
});

test('timeout writes cannot overwrite an existing manual submit', () => {
  assert.match(
    migration,
    /excluded\.answer_request_mode = 'submit'\s+and public\.answers\.answer_request_mode = 'timeout'/,
  );
  assert.doesNotMatch(
    migration,
    /excluded\.answer_request_mode = 'timeout'\s+and public\.answers\.answer_request_mode = 'submit'/,
  );
});
