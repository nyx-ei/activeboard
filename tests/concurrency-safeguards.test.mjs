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
const atomicAdvanceMigration = readFileSync(
  'supabase/migrations/20260605150000_atomic_session_advance_rpc.sql',
  'utf8',
);
const globalAdvanceDeadlineMigration = readFileSync(
  'supabase/migrations/20260713120000_fix_global_exam_advance_deadline.sql',
  'utf8',
);
const advanceRoute = readFileSync(
  'app/api/sessions/[sessionId]/advance/route.ts',
  'utf8',
);
const reviewAnswerRoute = readFileSync(
  'app/api/sessions/[sessionId]/review-answer/route.ts',
  'utf8',
);

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

test('question advance is handled by an atomic session RPC', () => {
  assert.match(
    atomicAdvanceMigration,
    /create or replace function public\.activeboard_advance_session_question/,
  );
  assert.match(atomicAdvanceMigration, /for update of s/);
  assert.match(
    atomicAdvanceMigration,
    /on conflict \(session_id, order_index\)/,
  );
  assert.match(
    advanceRoute,
    /rpc\('activeboard_advance_session_question'/,
  );
  assert.doesNotMatch(advanceRoute, /ensureQuestion\(/);
});

test('global exam advance refreshes stale question deadlines', () => {
  assert.match(
    globalAdvanceDeadlineMigration,
    /create or replace function public\.activeboard_advance_session_question/,
  );
  assert.match(
    globalAdvanceDeadlineMigration,
    /when session_row\.timer_mode = 'global'\s+then excluded\.answer_deadline_at/,
  );
  assert.match(
    globalAdvanceDeadlineMigration,
    /else coalesce\(public\.questions\.answer_deadline_at, excluded\.answer_deadline_at\)/,
  );
});

test('per-question review prepares the next question through server privileges', () => {
  assert.match(reviewAnswerRoute, /saveReviewSnapshot\(/);
  assert.match(reviewAnswerRoute, /session\.timer_mode === 'per_question'/);
  assert.match(reviewAnswerRoute, /createSupabaseAdminClient\(\)/);
  assert.match(reviewAnswerRoute, /precreateQuestionShell\(\s*admin,/);
  assert.doesNotMatch(reviewAnswerRoute, /ensureQuestion\(\s*admin,/);
});
