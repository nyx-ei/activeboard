import 'server-only';

import type { AppPolicySettings } from '@/lib/policy/defaults';
import { expirePastScheduledSessionsForGroups } from '@/lib/session/expired-sessions';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { generateInviteCode } from '@/lib/utils';

const TEST_SESSION_TARGET = 3;
const TEST_SESSION_SPACING_DAYS = 2;
const TEST_SESSION_QUESTION_GOAL = 20;

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type UserRow = { id: string };
type TestSessionSlotRow = { name: string | null };
export async function ensureInitialTestSessions(
  user: UserRow,
  policy: Pick<AppPolicySettings, 'perQuestionTimerDefaultSeconds'>,
  options: { replaceExpired?: boolean } = {},
) {
  const admin = createSupabaseAdminClient();
  const groupId = await getOrCreateTestGroup(admin, user);
  await expirePastScheduledSessionsForGroups(admin, [groupId]);
  const [existingSessions, totalCount] = await Promise.all([
    listExistingTestWindowSessions(admin, groupId),
    countAllTestSessions(admin, groupId),
  ]);
  const existingCount = Math.min(existingSessions.length, TEST_SESSION_TARGET);
  const missingCount = TEST_SESSION_TARGET - existingCount;

  if (missingCount <= 0 || (totalCount > 0 && !options.replaceExpired)) {
    return;
  }

  const occupiedSessionNumbers = getOccupiedTestSessionNumbers(existingSessions);
  const missingSessionNumbers = Array.from(
    { length: TEST_SESSION_TARGET },
    (_, index) => index + 1,
  )
    .filter((sessionNumber) => !occupiedSessionNumbers.has(sessionNumber))
    .slice(0, missingCount);

  if (missingSessionNumbers.length === 0) {
    return;
  }

  const now = new Date();
  const sessions = missingSessionNumbers.map((sessionNumber) => ({
      group_id: groupId,
      name: `Session test ${sessionNumber}`,
      scheduled_at: getDefaultTestSessionDate(now, sessionNumber).toISOString(),
      timer_mode: 'per_question' as const,
      timer_seconds: policy.perQuestionTimerDefaultSeconds,
      question_goal: TEST_SESSION_QUESTION_GOAL,
      created_by: user.id,
      leader_id: user.id,
      status: 'scheduled' as const,
    }));

  const { error } = await admin
    .schema('public')
    .from('sessions')
    .insert(sessions);

  if (error) {
    throw error;
  }
}

async function countAllTestSessions(admin: AdminClient, groupId: string) {
  const { count } = await admin
    .schema('public')
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId);

  return count ?? 0;
}

async function listExistingTestWindowSessions(
  admin: AdminClient,
  groupId: string,
) {
  const { data } = await admin
    .schema('public')
    .from('sessions')
    .select('name')
    .eq('group_id', groupId)
    .not('status', 'in', '("cancelled","expired")');

  return (data ?? []) as TestSessionSlotRow[];
}

function getOccupiedTestSessionNumbers(sessions: TestSessionSlotRow[]) {
  const occupied = new Set<number>();
  let unnamedSessionCount = 0;

  for (const session of sessions) {
    const sessionNumber = extractTestSessionNumber(session.name);
    if (sessionNumber && sessionNumber <= TEST_SESSION_TARGET) {
      occupied.add(sessionNumber);
      continue;
    }

    unnamedSessionCount += 1;
  }

  for (
    let sessionNumber = 1;
    sessionNumber <= TEST_SESSION_TARGET;
    sessionNumber += 1
  ) {
    if (unnamedSessionCount <= 0) {
      break;
    }

    if (!occupied.has(sessionNumber)) {
      occupied.add(sessionNumber);
      unnamedSessionCount -= 1;
    }
  }

  return occupied;
}

function extractTestSessionNumber(name: string | null | undefined) {
  const match = name?.match(/session\s*test\D*(\d+)/i);
  return match?.[1] ? Number(match[1]) : null;
}

async function getOrCreateTestGroup(admin: AdminClient, user: UserRow) {
  const { data: existingTestMembership } = await admin
    .schema('public')
    .from('group_members')
    .select('group_id, groups!inner(id, group_kind)')
    .eq('user_id', user.id)
    .eq('groups.group_kind', 'session_test')
    .limit(1)
    .maybeSingle();

  if (existingTestMembership?.group_id) {
    return existingTestMembership.group_id;
  }

  const inviteCode = await createUniqueInviteCode(admin);
  const fallbackName = getFallbackTestGroupName(user);
  const { data: createdGroup } = await admin
    .schema('public')
    .from('groups')
    .insert({
      name: fallbackName,
      invite_code: inviteCode,
      created_by: user.id,
      difficulty_level: 'medium',
      group_kind: 'session_test',
      max_members: 5,
    })
    .select('id')
    .single();

  if (!createdGroup?.id) {
    throw new Error('Unable to create initial test group');
  }

  await admin.schema('public').from('group_members').upsert(
    {
      group_id: createdGroup.id,
      user_id: user.id,
      is_founder: true,
    },
    { onConflict: 'group_id,user_id' },
  );

  return createdGroup.id;
}

async function createUniqueInviteCode(admin: AdminClient) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generateInviteCode();
    const { data } = await admin
      .schema('public')
      .from('groups')
      .select('id')
      .eq('invite_code', candidate)
      .maybeSingle();

    if (!data) {
      return candidate;
    }
  }

  return generateInviteCode();
}

function getDefaultTestSessionDate(now: Date, sessionNumber: number) {
  const date = new Date(now);
  date.setDate(now.getDate() + 1 + (sessionNumber - 1) * TEST_SESSION_SPACING_DAYS);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getFallbackTestGroupName(user: UserRow) {
  return `${user.id.slice(0, 8)} - test`;
}
