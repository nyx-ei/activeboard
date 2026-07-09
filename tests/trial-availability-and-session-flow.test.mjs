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
const onboardingActions = readFileSync(
  'app/[locale]/onboarding/actions.ts',
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
const progressEntryRuntime = readFileSync(
  'components/session/session-progress-entry-runtime.tsx',
  'utf8',
);
const progressPanel = readFileSync(
  'components/session/session-progress-panel.tsx',
  'utf8',
);
const feedbackRuntime = readFileSync(
  'components/session/session-peer-feedback-runtime.tsx',
  'utf8',
);
const activeRuntime = readFileSync(
  'components/session/session-active-runtime.tsx',
  'utf8',
);
const planNextRuntime = readFileSync(
  'components/session/session-plan-next-runtime.tsx',
  'utf8',
);
const advanceRoute = readFileSync(
  'app/api/sessions/[sessionId]/advance/route.ts',
  'utf8',
);
const sessionsRoute = readFileSync('app/api/sessions/route.ts', 'utf8');
const trialDashboard = readFileSync(
  'components/dashboard/trial-dashboard-view.tsx',
  'utf8',
);
const sessionCard = readFileSync(
  'components/sessions/session-card.tsx',
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

test('availability onboarding requires 5 slots and recommends 7 with status colors', () => {
  assert.match(trialForms, /const MIN_AVAILABILITY_SLOTS = 5/);
  assert.match(trialForms, /const STRONG_AVAILABILITY_SLOTS = 7/);
  assert.match(trialForms, /availabilitySubtitle: 'Choose at least 5 slots'/);
  assert.match(trialForms, /selected: '\{count\}\/\{target\} slots selected'/);
  assert.match(
    trialForms,
    /const hasMinimumSlots = selectedCount >= MIN_AVAILABILITY_SLOTS/,
  );
  assert.match(
    trialForms,
    /const hasStrongAvailability = selectedCount >= STRONG_AVAILABILITY_SLOTS/,
  );
  assert.match(trialForms, /text-amber-300/);
  assert.match(trialForms, /text-brand/);
  assert.match(onboardingActions, /const MIN_AVAILABILITY_SLOTS = 5/);
  assert.match(
    onboardingActions,
    /getSlotCount\(grid\) < MIN_AVAILABILITY_SLOTS/,
  );
});

test('trial session review to feedback to plan-next to dashboard remains reachable', () => {
  assert.match(sessionPage, /<SessionProgressEntryRuntime/);
  assert.match(
    sessionPage,
    /const isProgress = searchParams\.stage === 'progress'/,
  );
  assert.match(
    trialDashboard,
    /href=\{`\/sessions\/\$\{session\.id\}\?stage=progress`\}/,
  );
  assert.match(
    trialDashboard,
    /href=\{`\/sessions\/\$\{firstActionableSession\.id\}\?stage=progress`\}/,
  );
  assert.match(
    sessionCard,
    /router\.push\(`\/sessions\/\$\{session\.id\}\?stage=progress`\)/,
  );
  assert.match(progressEntryRuntime, /<SessionProgressPanel/);
  assert.match(sessionPage, /\?stage=start/);
  assert.match(sessionPage, /sessionHref=\{progressSessionHref\}/);
  assert.match(progressEntryRuntime, /\?stage=feedback/);
  assert.match(progressEntryRuntime, /\?stage=plan-next/);
  assert.match(progressEntryRuntime, /<SessionProgressPanel/);
  assert.match(progressEntryRuntime, /\/>/);
  assert.doesNotMatch(progressEntryRuntime, /sessionDetails/);
  assert.doesNotMatch(progressEntryRuntime, /button-primary/);
  assert.match(sessionPage, /feedbackSubmitted=\{searchParams\.feedback === 'done'\}/);
  assert.match(feedbackRuntime, /<SessionProgressPanel/);
  assert.match(planNextRuntime, /<SessionProgressPanel/);
  assert.match(progressPanel, /Session progress/);
  assert.match(progressPanel, /sessionActive: 'Sprint'/);
  assert.match(progressPanel, /grid-cols-\[22px_minmax\(0,1fr\)\]/);
  assert.match(progressPanel, /border-dashed/);
  assert.match(progressPanel, /statusStarted/);
  assert.doesNotMatch(progressPanel, /sm:grid-cols-3/);
  assert.match(progressEntryRuntime, /sessionMeta=\{`\$\{Math\.min\(answeredCount, questionGoal\)\}\/\$\{questionGoal\}Q - \$\{timerSeconds\} sec`\}/);
  assert.match(
    activeRuntime,
    /const reviewHref = `\/\$\{locale\}\/sessions\/\$\{sessionId\}\?stage=review&q=\$\{runtimeQuestionIndex\}`/,
  );
  assert.match(
    activeRuntime,
    /redirectTo=\{`\/\$\{locale\}\/sessions\/\$\{sessionId\}\?stage=progress`\}/,
  );
  assert.match(
    activeRuntime,
    /href=\{`\/sessions\/\$\{sessionId\}\?stage=review`\}/,
  );
  assert.match(
    advanceRoute,
    /const reviewHref = `\/\$\{locale\}\/sessions\/\$\{sessionId\}\?stage=review&q=\$\{questionIndex\}`/,
  );
  assert.match(advanceRoute, /redirectTo: reviewHref/);
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
    /stage=progress&feedback=done/,
  );
  assert.match(planNextRuntime, /continuitySessionId: sessionId/);
  assert.match(
    planNextRuntime,
    /`\/api\/sessions\/\$\{sessionId\}\/finish-review`/,
  );
  assert.match(
    planNextRuntime,
    /stage=progress&feedback=done/,
  );
  assert.match(sessionsRoute, /groupMembers\.length < policy\.minimumGroupMembersToStart &&\s*!isContinuityPlan/);
});

test('start session screen exposes meeting link and sprint CTA copy', () => {
  assert.match(sessionPage, /meetingLink=\{data\.session\.meeting_link\}/);
  assert.match(sessionPage, /meetingLink: t\('meetingLink'\)/);
  assert.match(sessionPage, /joinCall: t\('joinCall'\)/);
  assert.match(startRuntime, /href=\{meetingLink\}/);
  assert.match(startRuntime, /labels\.joinCall/);
});
