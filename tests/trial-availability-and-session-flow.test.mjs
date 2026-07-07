import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const availabilityPage = readFileSync(
  'app/[locale]/onboarding/availability/page.tsx',
  'utf8',
);
const trialForms = readFileSync(
  'components/onboarding/trial-onboarding-forms.tsx',
  'utf8',
);
const sessionPage = readFileSync(
  'app/[locale]/sessions/[sessionId]/page.tsx',
  'utf8',
);
const reviewRuntime = readFileSync(
  'components/session/session-review-runtime.tsx',
  'utf8',
);
const startRuntime = readFileSync(
  'components/session/session-start-runtime.tsx',
  'utf8',
);
const feedbackRuntime = readFileSync(
  'components/session/session-peer-feedback-runtime.tsx',
  'utf8',
);
const planNextRuntime = readFileSync(
  'components/session/session-plan-next-runtime.tsx',
  'utf8',
);

test('availability edit mode preloads saved schedule grid', () => {
  assert.match(availabilityPage, /\.select\('timezone, availability_grid'\)/);
  assert.match(
    availabilityPage,
    /initialAvailabilityGrid=\{schedule\?\.availability_grid \?\? null\}/,
  );
  assert.match(
    trialForms,
    /initialAvailabilityGrid\?: AvailabilityGrid \| null/,
  );
  assert.match(
    trialForms,
    /getInitialAvailabilitySlots\(initialAvailabilityGrid\)/,
  );
  assert.match(trialForms, /hour >= 6 && hour < 12/);
  assert.match(trialForms, /hour >= 18 && hour <= 22/);
});

test('trial session review to feedback to plan-next to dashboard remains reachable', () => {
  assert.match(
    sessionPage,
    /const isFeedback = searchParams\.stage === 'feedback'/,
  );
  assert.match(
    sessionPage,
    /const isPlanNext = searchParams\.stage === 'plan-next'/,
  );
  assert.match(sessionPage, /<SessionPeerFeedbackRuntime/);
  assert.match(sessionPage, /<SessionPlanNextRuntime/);
  assert.match(
    reviewRuntime,
    /href=\{`\/sessions\/\$\{sessionId\}\?stage=feedback`\}/,
  );
  assert.match(
    feedbackRuntime,
    /router\.replace\(`\/\$\{language\}\/sessions\/\$\{sessionId\}\?stage=plan-next`\)/,
  );
  assert.match(planNextRuntime, /continuitySessionId: sessionId/);
  assert.match(
    planNextRuntime,
    /`\/api\/sessions\/\$\{sessionId\}\/finish-review`/,
  );
  assert.match(
    planNextRuntime,
    /router\.replace\(`\/\$\{language\}\/dashboard`\)/,
  );
});

test('start session screen exposes meeting link and sprint CTA copy', () => {
  assert.match(sessionPage, /meetingLink=\{data\.session\.meeting_link\}/);
  assert.match(sessionPage, /meetingLink: t\('meetingLink'\)/);
  assert.match(sessionPage, /joinCall: t\('joinCall'\)/);
  assert.match(startRuntime, /href=\{meetingLink\}/);
  assert.match(startRuntime, /labels\.joinCall/);
});
