import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const landingPage = readFileSync('app/[locale]/page.tsx', 'utf8');
const landingEnMessages = readFileSync('messages/en.json', 'utf8');
const landingFrMessages = readFileSync('messages/fr.json', 'utf8');
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
const accountOnboardingForms = readFileSync(
  'components/onboarding/trial-onboarding-forms.tsx',
  'utf8',
);
const authCallbackRoute = readFileSync(
  'app/[locale]/auth/callback/route.ts',
  'utf8',
);
const onboardingEmailOtpRoute = readFileSync(
  'app/api/onboarding/email-otp/route.ts',
  'utf8',
);
const authForm = readFileSync('components/auth/auth-form.tsx', 'utf8');
const splitMccqeMigration = readFileSync(
  'supabase/migrations/20260709120000_split_mccqe_exam_language.sql',
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
const autoStartRuntime = readFileSync(
  'components/session/session-auto-start-runtime.tsx',
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
const scheduleRoute = readFileSync(
  'app/api/sessions/[sessionId]/schedule/route.ts',
  'utf8',
);
const initialTestSessions = readFileSync(
  'lib/session/initial-test-sessions.ts',
  'utf8',
);
const createSessionModal = readFileSync(
  'components/sessions/create-session-modal.tsx',
  'utf8',
);
const configureRuntime = readFileSync(
  'components/session/session-configure-runtime.tsx',
  'utf8',
);
const trialDashboard = readFileSync(
  'components/dashboard/trial-dashboard-view.tsx',
  'utf8',
);
const dashboardGroupZone = readFileSync(
  'components/dashboard/dashboard-group-zone.tsx',
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

test('trial profile onboarding uses checkbox qbanks and language-specific MCCQE exam choices', () => {
  assert.match(trialForms, /mccqe_fr: 'MCCQE in French'/);
  assert.match(trialForms, /mccqe_en: 'MCCQE in English'/);
  assert.match(trialForms, /mccqe_fr: 'EACMC en francais'/);
  assert.match(trialForms, /mccqe_en: 'EACMC en anglais'/);
  assert.match(trialForms, /type="checkbox"/);
  assert.match(trialForms, /name="qbank"/);
  assert.match(trialForms, /defaultChecked=\{selectedQbanks\.has\(value\)\}/);
  assert.match(onboardingActions, /formData\s*\.\s*getAll\('qbank'\)/);
  assert.match(onboardingActions, /question_banks: questionBanks/);
  assert.match(onboardingActions, /'mccqe_fr'/);
  assert.match(onboardingActions, /'mccqe_en'/);
  assert.match(splitMccqeMigration, /exam_type in \('mccqe_fr', 'mccqe_en', 'usmle', 'plab', 'other'\)/);
});

test('trial dashboard keeps reliability and candidate metrics side by side on mobile', () => {
  assert.match(trialDashboard, /grid grid-cols-2 rounded-\[24px\]/);
  assert.doesNotMatch(trialDashboard, /sm:grid-cols-2/);
  assert.match(trialDashboard, /w-\[72px\]/);
  assert.match(trialDashboard, /grid-cols-\[auto_minmax\(0,1fr\)_minmax\(60px,auto\)\]/);
  assert.match(trialDashboard, /sm:grid-cols-\[auto_minmax\(0,1fr\)_auto\]/);
  assert.match(trialDashboard, /text-\[12px\] font-bold leading-snug/);
  assert.match(trialDashboard, /sm:min-w-\[110px\]/);
  assert.match(trialDashboard, /<ReliabilityInfo labels=\{labels\} \/>/);
  assert.match(trialDashboard, /reliabilityInfoTitle: 'Score composition'/);
  assert.match(trialDashboard, /\['Attendance', '30%'\]/);
  assert.match(trialDashboard, /\['Reviewed questions', '20%'\]/);
  assert.match(trialDashboard, /\['Peer validation', '10%'\]/);
  assert.match(trialDashboard, /function MetricValue/);
  assert.match(trialDashboard, /TrendingUp/);
  assert.match(trialDashboard, /TrendingDown/);
  assert.match(trialDashboard, /<MetricValue value=\{trueMastery\} direction="up" \/>/);
  assert.match(trialDashboard, /<MetricValue value=\{falseConfidence\} direction="down" \/>/);
  assert.match(dashboardGroupZone, /TrendingUp/);
  assert.match(dashboardGroupZone, /TrendingDown/);
});

test('landing hero stays compact with updated proof copy and wider device visual', () => {
  assert.match(landingEnMessages, /Join 40\+ IMGs seriously preparing for MCCQE1/);
  assert.match(landingEnMessages, /The MCCQE prep period/);
  assert.match(landingEnMessages, /that changes everything/);
  assert.match(landingEnMessages, /Prepare it with candidates as committed as you are\./);
  assert.match(landingEnMessages, /No promises\. Only proof\./);
  assert.match(landingEnMessages, /Free to start/);
  assert.match(landingEnMessages, /Unlock serious study partners/);
  assert.match(landingFrMessages, /Comment ça marche/);
  assert.match(landingEnMessages, /Start Your First Sprint/);
  assert.match(landingFrMessages, /Joigner 40\+ DHCEU/);
  assert.match(landingFrMessages, /La préparation EACMC/);
  assert.match(landingPage, /heroProofLine/);
  assert.match(landingPage, /heroPatternLine/);
  assert.match(landingPage, /howTitle/);
  assert.match(landingPage, /noCreditCard'\)}\. \{t\('heroProofLine/);
  assert.match(landingPage, /xl:text-\[52px\]/);
  assert.match(landingPage, /lg:w-\[min\(54vw,900px\)\]/);
  assert.match(landingPage, /lg:left-1\/2/);
  assert.match(landingPage, /translate\(-50%,-50%\)_rotateY/);
  assert.doesNotMatch(landingPage, /secondaryCta/);
});

test('onboarding email verification returns to the current onboarding step', () => {
  assert.match(accountOnboardingForms, /fetch\('\/api\/onboarding\/email-otp'/);
  assert.match(onboardingEmailOtpRoute, /persistSession: false/);
  assert.match(onboardingEmailOtpRoute, /callbackUrl\.searchParams\.set\('next', `\/\$\{locale\}\/onboarding\/profile`\)/);
  assert.match(onboardingEmailOtpRoute, /callbackUrl\.searchParams\.set\('email', email\)/);
  assert.match(onboardingEmailOtpRoute, /emailRedirectTo: callbackUrl\.toString\(\)/);
  assert.match(authCallbackRoute, /next\?\.startsWith\(`\/\$\{locale\}\/onboarding`\)/);
  assert.match(authCallbackRoute, /await supabase\.auth\.signOut\(\)/);
  assert.match(authCallbackRoute, /actualEmail !== expectedEmail/);
  assert.match(authCallbackRoute, /getOnboardingCompletion\(user\.id, locale\)/);
});

test('login page exposes a back link to the landing page', () => {
  assert.match(authForm, /ArrowLeft/);
  assert.match(authForm, /href="\/"/);
  assert.match(authForm, /Retour à l’accueil/);
});

test('dashboard progression details route is not linked or mounted', () => {
  assert.doesNotMatch(trialDashboard, /dashboard\/progression/);
  assert.doesNotMatch(dashboardGroupZone, /dashboard\/progression/);
  assert.equal(
    existsSync('app/[locale]/dashboard/progression/page.tsx'),
    false,
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
    /href=\{sessionHref\}/,
  );
  assert.match(
    sessionCard,
    /router\.push\(`\/sessions\/\$\{session\.id\}\?stage=progress`\)/,
  );
  assert.match(progressEntryRuntime, /<SessionProgressPanel/);
  assert.doesNotMatch(sessionPage, /\?stage=start/);
  assert.match(sessionPage, /<SessionAutoStartRuntime/);
  assert.match(autoStartRuntime, /\/api\/sessions\/\$\{sessionId\}\/start/);
  assert.match(autoStartRuntime, /router\.replace/);
  assert.match(sessionPage, /sessionHref=\{progressSessionHref\}/);
  assert.match(progressEntryRuntime, /\?stage=feedback/);
  assert.match(progressEntryRuntime, /\?stage=plan-next/);
  assert.match(progressEntryRuntime, /<SessionProgressPanel/);
  assert.match(progressEntryRuntime, /\/>/);
  assert.doesNotMatch(progressEntryRuntime, /sessionDetails/);
  assert.doesNotMatch(progressEntryRuntime, /button-primary/);
  assert.match(progressEntryRuntime, /const canOpenPlanNext = feedbackSubmitted/);
  assert.match(
    progressEntryRuntime,
    /canOpenPlanNext \? `\/sessions\/\$\{sessionId\}\?stage=plan-next` : undefined/,
  );
  assert.match(sessionPage, /feedbackSubmitted=\{searchParams\.feedback === 'done'\}/);
  assert.doesNotMatch(feedbackRuntime, /SessionProgressPanel/);
  assert.doesNotMatch(planNextRuntime, /SessionProgressPanel/);
  assert.match(
    feedbackRuntime,
    /href=\{`\/sessions\/\$\{sessionId\}\?stage=progress`\}/,
  );
  assert.match(
    planNextRuntime,
    /href=\{`\/sessions\/\$\{sessionId\}\?stage=progress&feedback=done`\}/,
  );
  assert.match(progressPanel, /Session progress/);
  assert.match(progressPanel, /sessionActive: 'Sprint'/);
  assert.match(progressPanel, /sessionStatusLabel \?\? t\.statusStarted/);
  assert.match(progressPanel, /grid-cols-\[22px_minmax\(0,1fr\)\]/);
  assert.match(progressPanel, /border-dashed/);
  assert.match(progressPanel, /statusStarted/);
  assert.doesNotMatch(progressPanel, /sm:grid-cols-3/);
  assert.match(progressEntryRuntime, /countdownLabel/);
  assert.match(progressEntryRuntime, /const sessionStatusLabel =/);
  assert.match(progressEntryRuntime, /sessionStatusLabel=\{sessionStatusLabel\}/);
  assert.match(progressEntryRuntime, /sessionMeta=\{`\$\{Math\.min\(answeredCount, questionGoal\)\}\/\$\{questionGoal\}Q - \$\{timerSeconds\} sec/);
  assert.doesNotMatch(progressEntryRuntime, /feedbackMeta=/);
  assert.match(progressPanel, /FeedbackAvatarPreview/);
  assert.match(progressPanel, /\[0, 1, 2, 3\]\.map/);
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
  assert.match(planNextRuntime, /createPayload\?\.message \?\? t\.error/);
  assert.match(
    planNextRuntime,
    /`\/api\/sessions\/\$\{sessionId\}\/finish-review`/,
  );
  assert.match(
    planNextRuntime,
    /stage=progress&feedback=done/,
  );
  assert.match(sessionsRoute, /groupMembers\.length < policy\.minimumGroupMembersToStart\)/);
  assert.doesNotMatch(sessionsRoute, /minimumGroupMembersToStart &&\s*!isContinuityPlan/);
});

test('scheduled sessions auto-start instead of showing the old start screen', () => {
  assert.doesNotMatch(sessionPage, /SessionStartRuntime/);
  assert.match(sessionPage, /SessionAutoStartRuntime/);
  assert.match(autoStartRuntime, /Starting sprint/);
  assert.match(autoStartRuntime, /stage=progress/);
  assert.match(startRuntime, /labels\.startSession/);
});

test('generated test sessions require time and meeting link before sprint', () => {
  assert.match(initialTestSessions, /TEST_SESSION_QUESTION_GOAL = 20/);
  assert.match(initialTestSessions, /date\.setHours\(0, 0, 0, 0\)/);
  assert.doesNotMatch(initialTestSessions, /sendSessionCalendarInvites/);
  assert.match(trialDashboard, /!session\.meeting_link/);
  assert.match(trialDashboard, /\?stage=configure/);
  assert.match(trialDashboard, /<span>XXhXX<\/span>/);
  assert.match(sessionPage, /const isConfigure = searchParams\.stage === 'configure'/);
  assert.match(sessionPage, /<SessionConfigureRuntime/);
  assert.match(sessionPage, /!data\.session\.meeting_link/);
  assert.match(createSessionModal, /existingSession/);
  assert.match(createSessionModal, /wizardStep/);
  assert.match(createSessionModal, /Organisez un groupe WhatsApp/);
  assert.match(createSessionModal, /Avec les membres du groupe, fixez le temps/);
  assert.match(createSessionModal, /Avec les membres du groupe, choisissez le mode de session/);
  assert.match(createSessionModal, /name="sessionName" value=\{name\}/);
  assert.doesNotMatch(createSessionModal, /const modalTitle/);
  assert.match(createSessionModal, /next: 'Suivant'/);
  assert.match(createSessionModal, /copyAction: 'Copier'/);
  assert.match(createSessionModal, /className="button-primary order-\[40\]/);
  assert.match(createSessionModal, /\['per_question', labels\.perQuestionMode\]/);
  assert.match(createSessionModal, /\['global', labels\.globalMode\]/);
  assert.match(createSessionModal, /max-w-\[min\(68vw,340px\)\]/);
  assert.match(createSessionModal, /isValidScheduledAtInput\(\s*scheduledAt,\s*isLockedTestPlan/s);
  assert.doesNotMatch(createSessionModal, /Only the time can be changed/);
  assert.doesNotMatch(createSessionModal, /<textarea/);
  assert.match(configureRuntime, /setIsOpen\(false\)/);
  assert.match(configureRuntime, /router\.replace/);
  assert.match(createSessionModal, /meetingLink/);
  assert.match(createSessionModal, /toScheduledAtPayload/);
  assert.match(createSessionModal, /return date\.toISOString\(\)/);
  assert.match(createSessionModal, /\/api\/sessions\/\$\{existingSession\.id\}\/schedule/);
  assert.match(scheduleRoute, /isSameLocalDay/);
  assert.match(progressPanel, /Planifier la prochaine session/);
  assert.match(progressEntryRuntime, /en direct/);
  assert.match(trialDashboard, /En direct/);
  assert.match(scheduleRoute, /EDIT_LOCK_WINDOW_MS = 60 \* 60 \* 1000/);
  assert.match(scheduleRoute, /candidate_matching_profiles/);
  assert.match(scheduleRoute, /sendSessionCalendarInvites/);
  assert.match(feedbackRuntime, /peerMetrics/);
  assert.match(feedbackRuntime, /questionsTogether/);
});
