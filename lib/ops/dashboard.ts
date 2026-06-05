import { unstable_noStore as noStore } from 'next/cache';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type OpsRange = '24h' | '7d' | '14d' | '30d';

export type OpsAdoptionStatus = 'active' | 'follow_up' | 'inactive' | 'new';

export type OpsAdoptionMember = {
  id: string;
  groupId: string;
  groupName: string;
  memberId: string;
  memberName: string;
  email: string;
  initials: string;
  isLeader: boolean;
  joinedAt: string;
  lastActivityAt: string | null;
  questionsDone: number;
  questionsReviewed: number;
  scheduledSessions: number;
  totalQuestionsAnswered: number;
  hasPayment: boolean;
  subscriptionStatus: string;
  userTier: string;
  status: OpsAdoptionStatus;
};

export type OpsAdoptionGroup = {
  id: string;
  name: string;
  membersCount: number;
  leaderNames: string[];
  scheduledSessions: number;
  questionsDone: number;
  questionsReviewed: number;
  lastActivityAt: string | null;
  followUpCount: number;
};

export type OpsDashboardRangeData = {
  label: string;
  summary: {
    groupsCount: number;
    membersCount: number;
    activeMembersCount: number;
    followUpMembersCount: number;
    inactiveMembersCount: number;
    questionsDone: number;
    questionsReviewed: number;
    scheduledSessions: number;
  };
  groups: OpsAdoptionGroup[];
  members: OpsAdoptionMember[];
};

export type OpsDashboardData = {
  generatedAt: string;
  defaultRange: OpsRange;
  ranges: Record<OpsRange, OpsDashboardRangeData>;
};

type GroupRow = {
  id: string;
  name: string;
  created_at: string;
};

type GroupMemberRow = {
  group_id: string;
  user_id: string;
  is_founder: boolean;
  joined_at: string;
};

type UserRow = {
  id: string;
  display_name: string | null;
  email: string;
  created_at: string;
  questions_answered: number;
  has_valid_payment_method: boolean;
  subscription_status: string;
  user_tier: string;
  stripe_default_payment_method_id: string | null;
};

type SessionRow = {
  id: string;
  group_id: string;
  leader_id: string | null;
  scheduled_at: string;
  started_at: string | null;
  ended_at: string | null;
  status: 'scheduled' | 'active' | 'incomplete' | 'completed' | 'cancelled';
};

type QuestionRow = {
  id: string;
  session_id: string;
  phase: 'draft' | 'answering' | 'review' | 'closed';
  correct_option: string | null;
};

type AnswerRow = {
  question_id: string;
  user_id: string;
  answered_at: string;
  answer_state: string;
};

type SessionEventRow = {
  actor_id: string | null;
  group_id: string;
  created_at: string;
};

const RANGE_DAYS: Record<OpsRange, number> = {
  '24h': 1,
  '7d': 7,
  '14d': 14,
  '30d': 30,
};

const RANGE_LABELS: Record<OpsRange, string> = {
  '24h': '24H',
  '7d': '7D',
  '14d': '14D',
  '30d': '30D',
};

function rangeStart(range: OpsRange, now: Date) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - RANGE_DAYS[range]);
  return date.toISOString();
}

function isWithin(value: string | null | undefined, start: string) {
  return Boolean(value && value >= start);
}

function getInitials(name: string, email: string) {
  const source = name.trim() || email.trim();
  const parts = source
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean);

  return (parts[0]?.[0] ?? 'A').concat(parts[1]?.[0] ?? '').toUpperCase();
}

function maxIso(values: Array<string | null | undefined>) {
  const dates = values.filter(Boolean) as string[];
  if (dates.length === 0) return null;
  return dates.reduce((latest, value) => (value > latest ? value : latest));
}

function hasUserPayment(user: UserRow) {
  return (
    user.has_valid_payment_method ||
    Boolean(user.stripe_default_payment_method_id) ||
    user.subscription_status === 'active' ||
    user.subscription_status === 'trialing' ||
    user.user_tier === 'active'
  );
}

function buildStatus({
  joinedAt,
  lastActivityAt,
  questionsDone,
  scheduledSessions,
  now,
}: {
  joinedAt: string;
  lastActivityAt: string | null;
  questionsDone: number;
  scheduledSessions: number;
  now: Date;
}): OpsAdoptionStatus {
  const joinedMs = new Date(joinedAt).getTime();
  const lastActivityMs = lastActivityAt
    ? new Date(lastActivityAt).getTime()
    : 0;
  const ageDays = (now.getTime() - joinedMs) / 86_400_000;
  const idleDays = lastActivityMs
    ? (now.getTime() - lastActivityMs) / 86_400_000
    : Number.POSITIVE_INFINITY;

  if (ageDays <= 3 && questionsDone === 0) return 'new';
  if (questionsDone > 0 && idleDays <= 7) return 'active';
  if (questionsDone === 0 && ageDays > 3) return 'follow_up';
  if (scheduledSessions > 0 && idleDays > 7) return 'follow_up';
  if (idleDays > 14) return 'inactive';
  return 'follow_up';
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function fetchInChunks<T>(
  ids: string[],
  fetcher: (ids: string[]) => Promise<T[]>,
) {
  const results = await Promise.all(chunk(ids, 500).map(fetcher));
  return results.flat();
}

async function getOpsSourceData() {
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const oldestActivity = rangeStart('30d', now);

  const [groupsResult, membershipsResult] = await Promise.all([
    admin
      .schema('public')
      .from('groups')
      .select('id,name,created_at')
      .order('created_at', { ascending: false })
      .limit(2000),
    admin
      .schema('public')
      .from('group_members')
      .select('group_id,user_id,is_founder,joined_at')
      .order('joined_at', { ascending: false })
      .limit(10000),
  ]);

  const groups = (groupsResult.data ?? []) as GroupRow[];
  const memberships = (membershipsResult.data ?? []) as GroupMemberRow[];
  const groupIds = [...new Set(groups.map((group) => group.id))];
  const userIds = [...new Set(memberships.map((member) => member.user_id))];

  const [users, sessions, stateEvents] = await Promise.all([
    fetchInChunks(userIds, async (ids) => {
      const result = await admin
        .schema('public')
        .from('users')
        .select(
          'id,display_name,email,created_at,questions_answered,has_valid_payment_method,subscription_status,user_tier,stripe_default_payment_method_id',
        )
        .in('id', ids);
      return (result.data ?? []) as UserRow[];
    }),
    fetchInChunks(groupIds, async (ids) => {
      const result = await admin
        .schema('public')
        .from('sessions')
        .select('id,group_id,leader_id,scheduled_at,started_at,ended_at,status')
        .in('group_id', ids)
        .order('scheduled_at', { ascending: false })
        .limit(5000);
      return (result.data ?? []) as SessionRow[];
    }),
    fetchInChunks(groupIds, async (ids) => {
      const result = await admin
        .schema('public')
        .from('session_state_events')
        .select('actor_id,group_id,created_at')
        .in('group_id', ids)
        .gte('created_at', oldestActivity)
        .order('created_at', { ascending: false })
        .limit(10000);
      return (result.data ?? []) as SessionEventRow[];
    }),
  ]);

  const sessionIds = sessions.map((session) => session.id);
  const questions = await fetchInChunks(sessionIds, async (ids) => {
    const result = await admin
      .schema('public')
      .from('questions')
      .select('id,session_id,phase,correct_option')
      .in('session_id', ids)
      .limit(20000);
    return (result.data ?? []) as QuestionRow[];
  });
  const questionIds = questions.map((question) => question.id);
  const answers = await fetchInChunks(questionIds, async (ids) => {
    const result = await admin
      .schema('public')
      .from('answers')
      .select('question_id,user_id,answered_at,answer_state')
      .in('question_id', ids)
      .eq('answer_state', 'submitted')
      .order('answered_at', { ascending: false })
      .limit(30000);
    return (result.data ?? []) as AnswerRow[];
  });

  return {
    now,
    groups,
    memberships,
    users,
    sessions,
    questions,
    answers,
    stateEvents,
  };
}

function buildRangeData({
  range,
  now,
  groups,
  memberships,
  users,
  sessions,
  questions,
  answers,
  stateEvents,
}: Awaited<ReturnType<typeof getOpsSourceData>> & {
  range: OpsRange;
}): OpsDashboardRangeData {
  const start = rangeStart(range, now);
  const userById = new Map(users.map((user) => [user.id, user]));
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const sessionsById = new Map(
    sessions.map((session) => [session.id, session]),
  );
  const questionById = new Map(
    questions.map((question) => [question.id, question]),
  );
  const futureScheduledSessions = sessions.filter(
    (session) =>
      session.status === 'scheduled' &&
      session.scheduled_at >= now.toISOString(),
  );

  const memberStats = new Map<
    string,
    {
      questionsDone: number;
      questionsReviewed: number;
      answerDates: string[];
      eventDates: string[];
      activityDates: string[];
    }
  >();

  for (const membership of memberships) {
    memberStats.set(`${membership.group_id}:${membership.user_id}`, {
      questionsDone: 0,
      questionsReviewed: 0,
      answerDates: [],
      eventDates: [],
      activityDates: [],
    });
  }

  for (const answer of answers) {
    const question = questionById.get(answer.question_id);
    if (!question) continue;
    const session = sessionsById.get(question.session_id);
    if (!session) continue;
    const stats = memberStats.get(`${session.group_id}:${answer.user_id}`);
    if (!stats) continue;

    stats.activityDates.push(answer.answered_at);
    if (!isWithin(answer.answered_at, start)) continue;

    stats.questionsDone += 1;
    stats.answerDates.push(answer.answered_at);

    if (
      question.correct_option ||
      question.phase === 'review' ||
      question.phase === 'closed'
    ) {
      stats.questionsReviewed += 1;
    }
  }

  for (const event of stateEvents) {
    if (!event.actor_id) continue;
    const stats = memberStats.get(`${event.group_id}:${event.actor_id}`);
    if (stats) {
      stats.activityDates.push(event.created_at);
    }
    if (!isWithin(event.created_at, start)) continue;
    if (stats) {
      stats.eventDates.push(event.created_at);
    }
  }

  const members: OpsAdoptionMember[] = memberships
    .map((membership) => {
      const user = userById.get(membership.user_id);
      const group = groupById.get(membership.group_id);
      if (!user || !group) return null;

      const stats = memberStats.get(
        `${membership.group_id}:${membership.user_id}`,
      ) ?? {
        questionsDone: 0,
        questionsReviewed: 0,
        answerDates: [],
        eventDates: [],
        activityDates: [],
      };
      const groupScheduledSessions = futureScheduledSessions.filter(
        (session) => session.group_id === membership.group_id,
      ).length;
      const leaderActivity = sessions
        .filter(
          (session) =>
            session.group_id === membership.group_id &&
            session.leader_id === membership.user_id,
        )
        .map((session) =>
          maxIso([session.started_at, session.ended_at, session.scheduled_at]),
        );
      const lastActivityAt = maxIso([
        ...stats.activityDates,
        ...leaderActivity,
      ]);
      const memberName =
        user.display_name?.trim() || user.email.split('@')[0] || 'ActiveBoard';
      const status = buildStatus({
        joinedAt: membership.joined_at,
        lastActivityAt,
        questionsDone: stats.questionsDone,
        scheduledSessions: groupScheduledSessions,
        now,
      });

      return {
        id: `${membership.group_id}:${membership.user_id}`,
        groupId: membership.group_id,
        groupName: group.name,
        memberId: membership.user_id,
        memberName,
        email: user.email,
        initials: getInitials(memberName, user.email),
        isLeader: membership.is_founder,
        joinedAt: membership.joined_at,
        lastActivityAt,
        questionsDone: stats.questionsDone,
        questionsReviewed: stats.questionsReviewed,
        scheduledSessions: groupScheduledSessions,
        totalQuestionsAnswered: user.questions_answered ?? 0,
        hasPayment: hasUserPayment(user),
        subscriptionStatus: user.subscription_status ?? 'none',
        userTier: user.user_tier ?? 'trial',
        status,
      };
    })
    .filter(Boolean) as OpsAdoptionMember[];

  const groupsView = groups
    .map((group) => {
      const groupMembers = members.filter(
        (member) => member.groupId === group.id,
      );
      const lastActivityAt = maxIso(
        groupMembers.map((member) => member.lastActivityAt),
      );

      return {
        id: group.id,
        name: group.name,
        membersCount: groupMembers.length,
        leaderNames: groupMembers
          .filter((member) => member.isLeader)
          .map((member) => member.memberName),
        scheduledSessions: futureScheduledSessions.filter(
          (session) => session.group_id === group.id,
        ).length,
        questionsDone: groupMembers.reduce(
          (sum, member) => sum + member.questionsDone,
          0,
        ),
        questionsReviewed: groupMembers.reduce(
          (sum, member) => sum + member.questionsReviewed,
          0,
        ),
        lastActivityAt,
        followUpCount: groupMembers.filter(
          (member) => member.status === 'follow_up',
        ).length,
      };
    })
    .filter((group) => group.membersCount > 0)
    .sort((first, second) => {
      if (second.followUpCount !== first.followUpCount) {
        return second.followUpCount - first.followUpCount;
      }
      return (second.lastActivityAt ?? '').localeCompare(
        first.lastActivityAt ?? '',
      );
    });

  return {
    label: RANGE_LABELS[range],
    summary: {
      groupsCount: groupsView.length,
      membersCount: members.length,
      activeMembersCount: members.filter((member) => member.status === 'active')
        .length,
      followUpMembersCount: members.filter(
        (member) => member.status === 'follow_up',
      ).length,
      inactiveMembersCount: members.filter(
        (member) => member.status === 'inactive',
      ).length,
      questionsDone: members.reduce(
        (sum, member) => sum + member.questionsDone,
        0,
      ),
      questionsReviewed: members.reduce(
        (sum, member) => sum + member.questionsReviewed,
        0,
      ),
      scheduledSessions: futureScheduledSessions.length,
    },
    groups: groupsView,
    members: members.sort((first, second) => {
      const statusWeight: Record<OpsAdoptionStatus, number> = {
        follow_up: 0,
        inactive: 1,
        new: 2,
        active: 3,
      };
      const statusDelta =
        statusWeight[first.status] - statusWeight[second.status];
      if (statusDelta !== 0) return statusDelta;
      return (
        first.groupName.localeCompare(second.groupName) ||
        first.memberName.localeCompare(second.memberName)
      );
    }),
  };
}

export async function getOpsDashboardData(): Promise<OpsDashboardData> {
  noStore();

  const source = await getOpsSourceData();

  return {
    generatedAt: source.now.toISOString(),
    defaultRange: '7d',
    ranges: {
      '24h': buildRangeData({ ...source, range: '24h' }),
      '7d': buildRangeData({ ...source, range: '7d' }),
      '14d': buildRangeData({ ...source, range: '14d' }),
      '30d': buildRangeData({ ...source, range: '30d' }),
    },
  };
}
