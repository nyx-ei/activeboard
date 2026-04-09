import { cache } from 'react';

import type { User } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { computeAnswerDistribution } from '@/lib/demo/distribution';
import { confidenceToScore, scoreToConfidenceLevel } from '@/lib/demo/confidence';
import { createPerfTracker } from '@/lib/observability/perf';

type PublicClient = ReturnType<typeof createSupabaseServerClient>;
type DashboardSession = {
  id: string;
  group_id: string;
  name: string | null;
  scheduled_at: string;
  share_code: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  timer_mode: 'per_question' | 'global';
  timer_seconds: number;
};

type GroupWeeklySchedule = {
  id: string;
  weekday: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  start_time: string;
  end_time: string;
  question_goal: number;
};

type DashboardGroup = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
  is_founder: boolean;
  memberCount: number;
  nextSession: DashboardSession | null;
};

type GroupMemberPerformance = {
  userId: string;
  name: string;
  email: string;
  initials: string;
  is_founder: boolean;
  presenceRate: number;
  completionRate: number;
  status: 'setup' | 'active';
};

type GroupDashboardData = {
  group: DashboardGroup | null;
  schedules: GroupWeeklySchedule[];
  weeklyProgressPercentage: number;
  weeklyCompletedQuestions: number;
  weeklyTargetQuestions: number;
  memberPerformance: GroupMemberPerformance[];
};

async function getUsersMap(supabase: PublicClient, userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, { id: string; display_name: string | null; email: string; avatar_url: string | null }>();
  }

  const { data } = await supabase
    .schema('public')
    .from('users')
    .select('id, display_name, email, avatar_url')
    .in('id', userIds);

  return new Map((data ?? []).map((user) => [user.id, user]));
}

const WEEKDAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

function sortWeeklySchedules<T extends { weekday: (typeof WEEKDAY_ORDER)[number]; start_time: string }>(schedules: T[]) {
  return [...schedules].sort((left, right) => {
    const weekdayDelta = WEEKDAY_ORDER.indexOf(left.weekday) - WEEKDAY_ORDER.indexOf(right.weekday);
    if (weekdayDelta !== 0) return weekdayDelta;
    return left.start_time.localeCompare(right.start_time);
  });
}

export const getDashboardData = cache(async (user: User, includeGroupDashboard = false) => {
  const perf = createPerfTracker(`getDashboardData:${user.id}`);
  const supabase = createSupabaseServerClient();

  const [{ data: memberships }, { data: invites }] = await Promise.all([
    supabase.schema('public').from('group_members').select('group_id, is_founder').eq('user_id', user.id),
    supabase
      .schema('public')
      .from('group_invites')
      .select('id, group_id, invited_by, invitee_email, status, created_at')
      .eq('status', 'pending')
      .or(`invitee_user_id.eq.${user.id},invitee_email.eq.${user.email?.toLowerCase() ?? ''}`),
  ]);

  const groupIds = (memberships ?? []).map((membership) => membership.group_id);
  perf.step('memberships_loaded');

  const [groups, memberCounts, weeklySchedules, sessions] =
    groupIds.length > 0
      ? await Promise.all([
          supabase
            .schema('public')
            .from('groups')
            .select('id, name, invite_code, created_by, created_at')
            .in('id', groupIds)
            .then((result) => result.data ?? []),
          supabase
            .schema('public')
            .from('group_members')
            .select('group_id')
            .in('group_id', groupIds)
            .then((result) => result.data ?? []),
          includeGroupDashboard
            ? supabase
                .schema('public')
                .from('group_weekly_schedules')
                .select('id, group_id, weekday, start_time, end_time, question_goal')
                .in('group_id', groupIds)
                .order('weekday', { ascending: true })
                .order('start_time', { ascending: true })
                .then((result) => result.data ?? [])
            : Promise.resolve([]),
          supabase
            .schema('public')
            .from('sessions')
            .select('id, group_id, name, scheduled_at, share_code, status, timer_mode, timer_seconds')
            .in('group_id', groupIds)
            .order('scheduled_at', { ascending: true })
            .then((result) => (result.data ?? []) as DashboardSession[]),
        ])
      : [[], [], [], [] as DashboardSession[]];
  perf.step('dashboard_core_loaded');

  const sessionIds = sessions.map((session) => session.id);
  const questions =
    sessionIds.length > 0
      ? (
          await supabase
            .schema('public')
            .from('questions')
            .select('id, session_id')
            .in('session_id', sessionIds)
        ).data ?? []
      : [];

  const questionIds = questions.map((question) => question.id);
  const myAnswers =
    questionIds.length > 0
      ? (
          await supabase
            .schema('public')
            .from('answers')
            .select('question_id, confidence, is_correct')
            .eq('user_id', user.id)
            .in('question_id', questionIds)
        ).data ?? []
      : [];

  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const weeklySchedulesByGroup = new Map<string, typeof weeklySchedules>();
  for (const schedule of weeklySchedules) {
    const current = weeklySchedulesByGroup.get(schedule.group_id) ?? [];
    current.push(schedule);
    weeklySchedulesByGroup.set(schedule.group_id, current);
  }
  const countsByGroup = new Map<string, number>();
  for (const item of memberCounts) {
    countsByGroup.set(item.group_id, (countsByGroup.get(item.group_id) ?? 0) + 1);
  }

  const upcomingByGroup = new Map(
    sessions
      .filter((session) => session.status !== 'completed' && session.status !== 'cancelled')
      .map((session) => [session.group_id, session]),
  );
  const activeSessions = sessions.filter((session) => session.status === 'active');
  const completedSessions = sessions.filter((session) => session.status === 'completed');

  const inviterIds = [...new Set((invites ?? []).map((invite) => invite.invited_by))];
  const inviteUsers = await getUsersMap(supabase, inviterIds);
  perf.step('invite_users_loaded');

  const dashboardGroups = (memberships ?? []).reduce<DashboardGroup[]>((acc, membership) => {
      const group = groupsById.get(membership.group_id);
      if (!group) return acc;

      acc.push({
        ...group,
        is_founder: membership.is_founder,
        memberCount: countsByGroup.get(group.id) ?? 0,
        nextSession: upcomingByGroup.get(group.id) ?? null,
      });

      return acc;
    }, []);

  const pendingInvites = (invites ?? []).map((invite) => ({
    ...invite,
    groupName: groupsById.get(invite.group_id)?.name ?? null,
    invitedByName:
      inviteUsers.get(invite.invited_by)?.display_name ?? inviteUsers.get(invite.invited_by)?.email ?? null,
  }));

  const answeredCount = myAnswers.length;
  const correctCount = myAnswers.filter((answer) => answer.is_correct).length;
  const incorrectCount = myAnswers.filter((answer) => answer.is_correct === false).length;
  const averageConfidence =
    answeredCount > 0
      ? scoreToConfidenceLevel(
          myAnswers.reduce((sum, answer) => sum + confidenceToScore(answer.confidence), 0) / answeredCount,
        )
      : null;
  const successRate = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : null;
  const errorRate = answeredCount > 0 ? Math.round((incorrectCount / answeredCount) * 100) : null;

  const enrichedSessions = sessions.map((session) => ({
    ...session,
    groupName: groupsById.get(session.group_id)?.name ?? null,
  }));

  const nextSession = enrichedSessions.find((session) => session.status !== 'completed' && session.status !== 'cancelled') ?? null;

  const primaryGroup =
    dashboardGroups.find((group) => group.is_founder) ??
    dashboardGroups[0] ??
    null;

  let groupDashboard: GroupDashboardData = {
    group: primaryGroup,
    schedules: [],
    weeklyProgressPercentage: 0,
    weeklyCompletedQuestions: 0,
    weeklyTargetQuestions: 0,
    memberPerformance: [],
  };

  if (includeGroupDashboard && primaryGroup) {
    const primaryGroupSchedules = sortWeeklySchedules(
      (weeklySchedulesByGroup.get(primaryGroup.id) ?? []).map((schedule) => ({
        id: schedule.id,
        weekday: schedule.weekday,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        question_goal: schedule.question_goal,
      })),
    );
    const primaryGroupSessions = sessions.filter((session) => session.group_id === primaryGroup.id);
    const primaryGroupSessionIds = primaryGroupSessions.map((session) => session.id);
    const [{ data: groupMembers }, { data: groupQuestions }] = await Promise.all([
      supabase
        .schema('public')
        .from('group_members')
        .select('group_id, user_id, is_founder')
        .eq('group_id', primaryGroup.id),
      primaryGroupSessionIds.length > 0
        ? supabase
            .schema('public')
            .from('questions')
            .select('id, session_id')
            .in('session_id', primaryGroupSessionIds)
        : Promise.resolve({ data: [] as { id: string; session_id: string }[] }),
    ]);

    const primaryGroupQuestions = (groupQuestions ?? []).filter((question) =>
      primaryGroupSessionIds.includes(question.session_id),
    );
    const primaryGroupQuestionIds = primaryGroupQuestions.map((question) => question.id);

    const { data: primaryGroupAnswers } =
      primaryGroupQuestionIds.length > 0
        ? await supabase
            .schema('public')
            .from('answers')
            .select('question_id, user_id, is_correct')
            .in('question_id', primaryGroupQuestionIds)
        : { data: [] as { question_id: string; user_id: string; is_correct: boolean | null }[] };

    const memberIds = [...new Set((groupMembers ?? []).map((member) => member.user_id))];
    const groupUsers = await getUsersMap(supabase, memberIds);
    const questionSessionById = new Map(primaryGroupQuestions.map((question) => [question.id, question.session_id]));

    const startOfWeek = new Date();
    const currentDay = startOfWeek.getDay();
    const offsetToMonday = currentDay === 0 ? 6 : currentDay - 1;
    startOfWeek.setDate(startOfWeek.getDate() - offsetToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const weeklySessions = primaryGroupSessions.filter((session) => {
      if (session.status === 'cancelled') return false;
      return new Date(session.scheduled_at).getTime() >= startOfWeek.getTime();
    });
    const weeklySessionIds = new Set(weeklySessions.map((session) => session.id));
    const weeklyQuestions = primaryGroupQuestions.filter((question) => weeklySessionIds.has(question.session_id));
    const weeklyQuestionIds = new Set(weeklyQuestions.map((question) => question.id));
    const weeklyAnswers = (primaryGroupAnswers ?? []).filter((answer) => weeklyQuestionIds.has(answer.question_id));

    const qualifyingGroupSize = primaryGroup.memberCount >= 2 && primaryGroup.memberCount <= 5;
    const weeklyTargetQuestions = primaryGroupSchedules.reduce((sum, schedule) => sum + schedule.question_goal, 0);
    const questionAnswerCounts = new Map<string, number>();
    for (const answer of weeklyAnswers) {
      questionAnswerCounts.set(answer.question_id, (questionAnswerCounts.get(answer.question_id) ?? 0) + 1);
    }

    const weeklyCompletedQuestions = qualifyingGroupSize
      ? weeklyQuestions.filter((question) => (questionAnswerCounts.get(question.id) ?? 0) >= primaryGroup.memberCount).length
      : 0;

    const answersByUser = new Map<string, { questionIds: Set<string>; sessionIds: Set<string> }>();
    for (const answer of primaryGroupAnswers ?? []) {
      const current = answersByUser.get(answer.user_id) ?? { questionIds: new Set<string>(), sessionIds: new Set<string>() };
      current.questionIds.add(answer.question_id);
      const sessionId = questionSessionById.get(answer.question_id);
      if (sessionId) current.sessionIds.add(sessionId);
      answersByUser.set(answer.user_id, current);
    }

    const totalTrackableSessions = primaryGroupSessions.filter((session) => session.status !== 'cancelled').length;
    const totalTrackableQuestions = primaryGroupQuestions.length;

    groupDashboard = {
      group: primaryGroup,
      schedules: primaryGroupSchedules,
      weeklyProgressPercentage:
        weeklyTargetQuestions > 0 ? Math.min(100, Math.round((weeklyCompletedQuestions / weeklyTargetQuestions) * 100)) : 0,
      weeklyCompletedQuestions,
      weeklyTargetQuestions,
      memberPerformance: (groupMembers ?? []).map((member) => {
        const profile = groupUsers.get(member.user_id);
        const name = profile?.display_name ?? profile?.email ?? user.email ?? 'Member';
        const answerStats = answersByUser.get(member.user_id);
        const presenceRate =
          totalTrackableSessions > 0
            ? Math.round((((answerStats?.sessionIds.size ?? 0) / totalTrackableSessions) * 100))
            : 0;
        const completionRate =
          totalTrackableQuestions > 0
            ? Math.round((((answerStats?.questionIds.size ?? 0) / totalTrackableQuestions) * 100))
            : 0;

        return {
          userId: member.user_id,
          name,
          email: profile?.email ?? '',
          initials:
            name
              .split(' ')
              .map((part) => part[0])
              .join('')
              .slice(0, 2)
              .toUpperCase() || 'AB',
          is_founder: member.is_founder,
          presenceRate,
          completionRate,
          status:
            (answerStats?.sessionIds.size ?? 0) === 0 && (answerStats?.questionIds.size ?? 0) === 0 ? 'setup' : 'active',
        };
      }),
    };
  }

  perf.done({
    groups: dashboardGroups.length,
    sessions: enrichedSessions.length,
    invites: pendingInvites.length,
    includeGroupDashboard,
  });

  return {
    groups: dashboardGroups,
    pendingInvites,
    metrics: {
      answeredCount,
      completedSessionsCount: completedSessions.length,
      successRate,
      errorRate,
      averageConfidence,
      leagueProgress: Math.min(100, Math.round((answeredCount / 300) * 100)),
    },
    sessions: enrichedSessions,
    activeSessions,
    nextSession,
    groupDashboard,
  };
});

export const getGroupData = cache(async (groupId: string, user: User) => {
  const perf = createPerfTracker(`getGroupData:${groupId}`);
  const supabase = createSupabaseServerClient();

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id, is_founder')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return null;
  }

  const [{ data: group }, { data: members }, { data: invites }, { data: sessions }, { data: weeklySchedules }] = await Promise.all([
    supabase
      .schema('public')
      .from('groups')
      .select('id, name, invite_code, created_by, created_at')
      .eq('id', groupId)
      .single(),
    supabase.schema('public').from('group_members').select('user_id, is_founder, joined_at').eq('group_id', groupId),
    supabase
      .schema('public')
      .from('group_invites')
      .select('id, invitee_email, invited_by, status, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false }),
    supabase
      .schema('public')
      .from('sessions')
      .select('id, name, scheduled_at, share_code, status, timer_mode, timer_seconds, leader_id, meeting_link')
      .eq('group_id', groupId)
      .order('scheduled_at', { ascending: false }),
    supabase
      .schema('public')
      .from('group_weekly_schedules')
      .select('id, weekday, start_time, end_time, question_goal')
      .eq('group_id', groupId)
      .order('weekday', { ascending: true })
      .order('start_time', { ascending: true }),
  ]);
  const safeInvites = invites ?? [];
  const userIds = [...new Set([...(members ?? []).map((member) => member.user_id), ...safeInvites.map((invite) => invite.invited_by)])];
  const usersMap = await getUsersMap(supabase, userIds);
  perf.done({
    members: members?.length ?? 0,
    invites: safeInvites.length,
    sessions: sessions?.length ?? 0,
    weeklySchedules: weeklySchedules?.length ?? 0,
  });

  return {
    group,
    membership,
    members: (members ?? []).map((member) => ({
      ...member,
      profile: usersMap.get(member.user_id) ?? null,
    })),
    invites: safeInvites.map((invite) => ({
      ...invite,
      invitedByName: usersMap.get(invite.invited_by)?.display_name ?? usersMap.get(invite.invited_by)?.email ?? null,
    })),
    sessions: sessions ?? [],
    weeklySchedules: sortWeeklySchedules(weeklySchedules ?? []),
  };
});

export const getSessionData = cache(async (sessionId: string, user: User) => {
  const supabase = createSupabaseServerClient();

  const { data: session } = await supabase
    .schema('public')
    .from('sessions')
    .select('id, group_id, name, scheduled_at, share_code, started_at, ended_at, timer_mode, timer_seconds, status, meeting_link, leader_id')
    .eq('id', sessionId)
    .single();

  if (!session) {
    return null;
  }

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id, is_founder')
    .eq('group_id', session.group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return null;
  }

  const [{ data: group }, { data: members }, { data: questions }] = await Promise.all([
    supabase
      .schema('public')
      .from('groups')
      .select('id, name, invite_code')
      .eq('id', session.group_id)
      .single(),
    supabase.schema('public').from('group_members').select('user_id, is_founder').eq('group_id', session.group_id),
    supabase
      .schema('public')
      .from('questions')
      .select(
        'id, body, options, order_index, phase, launched_at, answer_deadline_at, correct_option, asked_by',
      )
      .eq('session_id', sessionId)
      .order('order_index', { ascending: false }),
  ]);

  const currentQuestion = (questions ?? []).find((question) => question.phase === 'answering' || question.phase === 'review') ?? (questions ?? [])[0] ?? null;

  const answers =
    currentQuestion
      ? (
          await supabase
            .schema('public')
            .from('answers')
            .select('id, user_id, selected_option, confidence, is_correct, answered_at')
            .eq('question_id', currentQuestion.id)
        ).data ?? []
      : [];

  const userIds = [...new Set([...(members ?? []).map((member) => member.user_id), session.leader_id].filter(Boolean) as string[])];
  const usersMap = await getUsersMap(supabase, userIds);
  const myAnswer = answers.find((answer) => answer.user_id === user.id) ?? null;
  const memberCount = members?.length ?? 0;

  return {
    session,
    group,
    membership,
    members: (members ?? []).map((member) => ({
      ...member,
      profile: usersMap.get(member.user_id) ?? null,
    })),
    leader: session.leader_id ? usersMap.get(session.leader_id) ?? null : null,
    questions: questions ?? [],
    currentQuestion,
    answers,
    myAnswer,
    distribution: currentQuestion ? computeAnswerDistribution(answers, memberCount) : null,
  };
});

export const getSessionSummaryData = cache(async (sessionId: string, user: User) => {
  const supabase = createSupabaseServerClient();

  const { data: session } = await supabase
    .schema('public')
    .from('sessions')
    .select('id, group_id, scheduled_at, started_at, ended_at, status')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) {
    return null;
  }

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id, is_founder')
    .eq('group_id', session.group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return null;
  }

  const [{ data: group }, { data: members }, { data: questions }] = await Promise.all([
    supabase.schema('public').from('groups').select('id, name').eq('id', session.group_id).maybeSingle(),
    supabase.schema('public').from('group_members').select('user_id').eq('group_id', session.group_id),
    supabase
      .schema('public')
      .from('questions')
      .select('id, body, order_index, correct_option, phase')
      .eq('session_id', sessionId)
      .order('order_index', { ascending: true }),
  ]);

  const questionIds = (questions ?? []).map((question) => question.id);
  const answers =
    questionIds.length > 0
      ? (
          await supabase
            .schema('public')
            .from('answers')
            .select('question_id, user_id, selected_option, confidence, is_correct')
            .in('question_id', questionIds)
        ).data ?? []
      : [];

  const memberCount = members?.length ?? 0;
  const myAnswers = answers.filter((answer) => answer.user_id === user.id);
  const correctCount = myAnswers.filter((answer) => answer.is_correct).length;
  const totalQuestions = questions?.length ?? 0;
  const answeredCount = myAnswers.length;
  const averageConfidence =
    myAnswers.length > 0
      ? scoreToConfidenceLevel(
          myAnswers.reduce((sum, answer) => sum + confidenceToScore(answer.confidence), 0) / myAnswers.length,
        )
      : null;
  const totalDurationMinutes =
    session.started_at && session.ended_at
      ? Math.max(
          0,
          Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000),
        )
      : 0;

  const breakdown = (questions ?? []).map((question) => {
    const questionAnswers = answers.filter((answer) => answer.question_id === question.id);
    const myAnswer = questionAnswers.find((answer) => answer.user_id === user.id) ?? null;
    const groupCorrectCount = questionAnswers.filter((answer) => answer.is_correct).length;

    return {
      ...question,
      myAnswer,
      groupAverage:
        memberCount > 0 ? Math.round((groupCorrectCount / memberCount) * 100) : 0,
    };
  });

  return {
    session,
    group,
    membership,
    totalQuestions,
    answeredCount,
    correctCount,
    accuracy: totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0,
    averageConfidence,
    totalDurationMinutes,
    breakdown,
  };
});
