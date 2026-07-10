import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const seriousPanel = readFileSync(
  'components/dashboard/serious-candidates-panel.tsx',
  'utf8',
);
const trialDashboard = readFileSync(
  'components/dashboard/trial-dashboard-view.tsx',
  'utf8',
);
const candidatesRoute = readFileSync('app/api/session-candidates/route.ts', 'utf8');
const seriousGroupsRoute = readFileSync('app/api/serious-groups/route.ts', 'utf8');
const rankedCandidates = readFileSync('lib/matching/serious-candidates.ts', 'utf8');
const lookupPage = readFileSync('app/[locale]/lookup/page.tsx', 'utf8');
const dashboardPage = readFileSync('app/[locale]/dashboard/page.tsx', 'utf8');

test('dashboard triggers serious-candidate paywall after trial sessions', () => {
  assert.match(seriousPanel, /completedTestSessions >= requiredTestSessions/);
  assert.match(seriousPanel, /!isUnlocked/);
  assert.match(seriousPanel, /Unlock serious candidates/);
  assert.match(seriousPanel, /href="\/billing"/);
  assert.match(trialDashboard, /<SeriousCandidatesPanel/);
  assert.match(trialDashboard, /seriousUnlocked/);
  assert.match(trialDashboard, /activeboard:open-create-session/);
});

test('serious candidates are gated, ranked, and expose reliability indicators', () => {
  assert.match(candidatesRoute, /getPlanNextAccess\(user\.id\)/);
  assert.match(candidatesRoute, /!access\.canInviteCandidates/);
  assert.match(candidatesRoute, /getRankedSeriousCandidates/);
  assert.match(rankedCandidates, /isActiveOrReliableCandidate/);
  assert.match(rankedCandidates, /compatibilityScore/);
  assert.match(rankedCandidates, /profileScore/);
  assert.match(rankedCandidates, /punctualityRate/);
  assert.match(rankedCandidates, /lastActiveAt/);
  assert.match(seriousPanel, /positivePeerVotes/);
  assert.match(seriousPanel, /nextSessionsPlanned/);
  assert.match(seriousPanel, /questionsReviewed/);
});

test('lookup preview is reachable before payment and masks contact details', () => {
  assert.match(dashboardPage, /liveGroupsHref: `\/\$\{locale\}\/lookup`/);
  assert.doesNotMatch(lookupPage, /redirect\(`\/\$\{locale\}\/billing`\)/);
  assert.match(lookupPage, /canRevealProfiles = planNextAccess\.canInviteCandidates/);
  assert.match(lookupPage, /profileScore/);
  assert.match(lookupPage, /maskPersonName/);
  assert.match(lookupPage, /href="\/billing"/);
  assert.match(lookupPage, /href="\/dashboard"/);
  assert.match(lookupPage, /fixed inset-0/);
  assert.match(lookupPage, /backdrop-blur-sm/);
  assert.doesNotMatch(lookupPage, /candidate\.email/);
  assert.doesNotMatch(lookupPage, /phoneNumber/);
  assert.doesNotMatch(lookupPage, /sessionsAttended/);
  assert.doesNotMatch(lookupPage, /questionsReviewed/);
});

test('paid users can create max-five serious study groups from eligible candidates', () => {
  assert.match(seriousGroupsRoute, /const MAX_GROUP_MEMBERS = 5/);
  assert.match(seriousGroupsRoute, /!access\.canInviteCandidates/);
  assert.match(seriousGroupsRoute, /group_kind: 'solidified'/);
  assert.match(seriousGroupsRoute, /max_members: MAX_GROUP_MEMBERS/);
  assert.match(seriousGroupsRoute, /isActiveOrReliableCandidate/);
  assert.match(seriousGroupsRoute, /sendGroupInviteEmail/);
  assert.match(seriousPanel, /current\.length >= 4/);
  assert.match(seriousPanel, /\/api\/serious-groups/);
});

test('dashboard keeps the unlock card compact and hides operator shortcuts', () => {
  assert.match(trialDashboard, /truncate whitespace-nowrap/);
  assert.match(trialDashboard, /px-2\.5 py-1\.5/);
  assert.match(trialDashboard, /disabled=\{!seriousUnlocked\}/);
  assert.doesNotMatch(dashboardPage, /Admin console/);
  assert.doesNotMatch(dashboardPage, /Ops dashboard/);
  assert.doesNotMatch(dashboardPage, /canOpenOpsDashboard/);
  assert.doesNotMatch(dashboardPage, /canOpenAdminConsole/);
});

test('dashboard archives completed sessions and uses dynamic single-user badges', () => {
  assert.match(trialDashboard, /selectArchivedSessions/);
  assert.match(trialDashboard, /session\.status !== 'completed'/);
  assert.match(trialDashboard, /showArchivedSessions/);
  assert.match(trialDashboard, /<Archive/);
  assert.match(trialDashboard, /getSessionMemberCount/);
  assert.match(trialDashboard, /Array\.from\(\{ length: visibleCount \}\)/);
  assert.match(trialDashboard, /activeCandidates - 1/);
  assert.match(trialDashboard, /<UserRound/);
  assert.doesNotMatch(trialDashboard, /<Users/);
});
