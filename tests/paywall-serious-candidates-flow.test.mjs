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

test('dashboard triggers serious-candidate paywall after trial sessions', () => {
  assert.match(seriousPanel, /completedTestSessions >= requiredTestSessions/);
  assert.match(seriousPanel, /!isUnlocked/);
  assert.match(seriousPanel, /Unlock serious candidates/);
  assert.match(seriousPanel, /href="\/billing"/);
  assert.match(trialDashboard, /<SeriousCandidatesPanel/);
});

test('serious candidates are gated, ranked, and expose reliability indicators', () => {
  assert.match(candidatesRoute, /getPlanNextAccess\(user\.id\)/);
  assert.match(candidatesRoute, /!access\.canInviteCandidates/);
  assert.match(candidatesRoute, /isActiveOrReliableCandidate/);
  assert.match(candidatesRoute, /compatibilityScore/);
  assert.match(candidatesRoute, /profileScore/);
  assert.match(candidatesRoute, /punctualityRate/);
  assert.match(candidatesRoute, /lastActiveAt/);
  assert.match(seriousPanel, /positivePeerVotes/);
  assert.match(seriousPanel, /nextSessionsPlanned/);
  assert.match(seriousPanel, /questionsReviewed/);
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
