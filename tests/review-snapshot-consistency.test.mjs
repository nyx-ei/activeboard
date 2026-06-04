import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  'supabase/migrations/20260504140000_review_snapshot_consistency.sql',
  'utf8',
);
const userScopedMigration = readFileSync(
  'supabase/migrations/20260604120000_user_scoped_review_answers.sql',
  'utf8',
);
const reviewVersionTypeFixMigration = readFileSync(
  'supabase/migrations/20260604213000_fix_review_snapshot_version_types.sql',
  'utf8',
);
const reviewQuestionRoute = readFileSync(
  'app/api/sessions/[sessionId]/review-question/route.ts',
  'utf8',
);
const reviewAnswerRoute = readFileSync(
  'app/api/sessions/[sessionId]/review-answer/route.ts',
  'utf8',
);

test('review fetch uses a single snapshot RPC for question and answers', () => {
  assert.match(
    migration,
    /create or replace function public\.activeboard_get_review_question_snapshot/,
  );
  assert.match(migration, /jsonb_build_object\(\s*'id', q\.id/);
  assert.match(migration, /where a\.question_id = q\.id/);
  assert.match(reviewQuestionRoute, /getReviewQuestionSnapshot/);
  assert.doesNotMatch(reviewQuestionRoute, /\.from\('answers'\)/);
});

test('review reveal saves question and answer correctness through one RPC', () => {
  assert.match(
    migration,
    /create or replace function public\.activeboard_save_review_snapshot/,
  );
  assert.match(migration, /correct_option = normalized_correct_option/);
  assert.match(
    migration,
    /set is_correct = upper\(coalesce\(a\.selected_option, ''\)\) = normalized_correct_option/,
  );
  assert.match(reviewAnswerRoute, /saveReviewSnapshot/);
  assert.doesNotMatch(reviewAnswerRoute, /\.from\('answers'\)/);
});

test('review snapshots expose a monotonically increasing review version', () => {
  assert.match(migration, /add column if not exists review_version bigint/);
  assert.match(migration, /review_version = q\.review_version \+ 1/);
  assert.match(migration, /'review_version', q\.review_version/);
});

test('user-scoped review RPCs keep review version return types aligned with questions.review_version', () => {
  assert.match(userScopedMigration, /add column if not exists reviewed_at/);
  assert.match(
    reviewVersionTypeFixMigration,
    /drop function if exists public\.activeboard_save_review_snapshot\(uuid, uuid, text\)/,
  );
  assert.match(
    reviewVersionTypeFixMigration,
    /drop function if exists public\.activeboard_get_review_question_snapshot\(uuid, uuid\)/,
  );
  assert.match(
    reviewVersionTypeFixMigration,
    /review_version bigint[\s\S]*reviewed_question_count bigint/,
  );
  assert.doesNotMatch(reviewVersionTypeFixMigration, /review_version integer/);
});
