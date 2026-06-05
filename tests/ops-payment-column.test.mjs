import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const opsData = readFileSync('lib/ops/dashboard.ts', 'utf8');
const opsView = readFileSync('components/ops/ops-dashboard-view.tsx', 'utf8');
const answerRoute = readFileSync(
  'app/api/sessions/[sessionId]/answer/route.ts',
  'utf8',
);
const fastQuotaGuardMigration = readFileSync(
  'supabase/migrations/20260605120000_fast_answer_quota_guard.sql',
  'utf8',
);

test('ops member activity exposes payment status from billing fields', () => {
  assert.match(
    opsData,
    /questions_answered,has_valid_payment_method,subscription_status,user_tier,stripe_default_payment_method_id/,
  );
  assert.match(opsData, /hasPayment: hasUserPayment\(user\)/);
  assert.match(opsView, /function PaymentPill/);
  assert.match(opsView, /Paiement\s*<\/th>/);
});

test('manual answer submit keeps the route fast and checks quota inside the save RPC', () => {
  assert.doesNotMatch(answerRoute, /getUserAccessState/);
  assert.doesNotMatch(answerRoute, /billing_access_loaded/);
  assert.match(
    fastQuotaGuardMigration,
    /create or replace function public\.activeboard_save_session_answer_concurrent/,
  );
  assert.match(
    fastQuotaGuardMigration,
    /normalized_mode = 'submit'[\s\S]*existing_answer\.answer_state is distinct from 'submitted'::public\.answer_state/,
  );
  assert.match(
    fastQuotaGuardMigration,
    /from public\.users u[\s\S]*for update/,
  );
  assert.match(
    fastQuotaGuardMigration,
    /coalesce\(billing_row\.questions_answered, 0\) >= 100/,
  );
  assert.match(answerRoute, /upgradeRequiredToJoinSession/);
});
