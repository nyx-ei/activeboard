import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const opsData = readFileSync('lib/ops/dashboard.ts', 'utf8');
const opsView = readFileSync('components/ops/ops-dashboard-view.tsx', 'utf8');
const answerRoute = readFileSync(
  'app/api/sessions/[sessionId]/answer/route.ts',
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

test('manual answer submit rechecks billing before creating a new paid-quota answer', () => {
  assert.match(answerRoute, /getUserAccessState/);
  assert.match(
    answerRoute,
    /mode === 'submit' && existingAnswer\?\.answer_state !== 'submitted'/,
  );
  assert.match(
    answerRoute,
    /hasUserTierCapability\(accessState, 'canJoinSessions'\)/,
  );
  assert.match(answerRoute, /upgradeRequiredToJoinSession/);
});
