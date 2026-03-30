import { cache } from 'react';

import type { User } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { computeAnswerDistribution } from '@/lib/demo/distribution';

type PublicClient = ReturnType<typeof createSupabaseServerClient>;
type DashboardSession = {
  id: string;
  group_id: string;
  scheduled_at: string;
  share_code: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  timer_seconds: number;
};

type DashboardGroup = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
  role: 'admin' | 'member';
  memberCount: number;
  nextSession: DashboardSession | null;
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

export const getDashboardData = cache(async (user: User) => {
  const supabase = createSupabaseServerClient();

  const [{ data: memberships }, { data: invites }] = await Promise.all([
    supabase.schema('public').from('group_members').select('group_id, role').eq('user_id', user.id),
    supabase
      .schema('public')
      .from('group_invites')
      .select('id, group_id, invited_by, invitee_email, status, created_at')
      .eq('status', 'pending')
      .or(`invitee_user_id.eq.${user.id},invitee_email.eq.${user.email?.toLowerCase() ?? ''}`),
  ]);

  const groupIds = (memberships ?? []).map((membership) => membership.group_id);
  const groups =
    groupIds.length > 0
      ? (
          await supabase
            .schema('public')
            .from('groups')
            .select('id, name, invite_code, created_by, created_at')
            .in('id', groupIds)
        ).data ?? []
      : [];

  const memberCounts =
    groupIds.length > 0
      ? (
          await supabase
            .schema('public')
            .from('group_members')
            .select('group_id')
            .in('group_id', groupIds)
        ).data ?? []
      : [];

  const sessions: DashboardSession[] =
    groupIds.length > 0
      ? (
          await supabase
            .schema('public')
            .from('sessions')
            .select('id, group_id, scheduled_at, share_code, status, timer_seconds')
            .in('group_id', groupIds)
            .order('scheduled_at', { ascending: true })
        ).data ?? []
      : [];

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

  const dashboardGroups = (memberships ?? []).reduce<DashboardGroup[]>((acc, membership) => {
      const group = groupsById.get(membership.group_id);
      if (!group) return acc;

      acc.push({
        ...group,
        role: membership.role,
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
      ? myAnswers.reduce((sum, answer) => sum + (answer.confidence ?? 0), 0) / answeredCount
      : null;
  const successRate = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : null;
  const errorRate = answeredCount > 0 ? Math.round((incorrectCount / answeredCount) * 100) : null;

  const enrichedSessions = sessions.map((session) => ({
    ...session,
    groupName: groupsById.get(session.group_id)?.name ?? null,
  }));

  const nextSession = enrichedSessions.find((session) => session.status !== 'completed' && session.status !== 'cancelled') ?? null;

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
  };
});

export const getGroupData = cache(async (groupId: string, user: User) => {
  const supabase = createSupabaseServerClient();

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id, role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return null;
  }

  const [{ data: group }, { data: members }, { data: invites }, { data: sessions }] = await Promise.all([
    supabase
      .schema('public')
      .from('groups')
      .select('id, name, invite_code, created_by, created_at')
      .eq('id', groupId)
      .single(),
    supabase.schema('public').from('group_members').select('user_id, role, joined_at').eq('group_id', groupId),
    supabase
      .schema('public')
      .from('group_invites')
      .select('id, invitee_email, invited_by, status, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false }),
    supabase
      .schema('public')
      .from('sessions')
      .select('id, scheduled_at, share_code, status, timer_seconds, leader_id, meeting_link')
      .eq('group_id', groupId)
      .order('scheduled_at', { ascending: false }),
  ]);

  const userIds = [...new Set([...(members ?? []).map((member) => member.user_id), ...(invites ?? []).map((invite) => invite.invited_by)])];
  const usersMap = await getUsersMap(supabase, userIds);

  return {
    group,
    membership,
    members: (members ?? []).map((member) => ({
      ...member,
      profile: usersMap.get(member.user_id) ?? null,
    })),
    invites: (invites ?? []).map((invite) => ({
      ...invite,
      invitedByName: usersMap.get(invite.invited_by)?.display_name ?? usersMap.get(invite.invited_by)?.email ?? null,
    })),
    sessions: sessions ?? [],
  };
});

export const getSessionData = cache(async (sessionId: string, user: User) => {
  const supabase = createSupabaseServerClient();

  const { data: session } = await supabase
    .schema('public')
    .from('sessions')
    .select('id, group_id, scheduled_at, share_code, started_at, ended_at, timer_seconds, status, meeting_link, leader_id')
    .eq('id', sessionId)
    .single();

  if (!session) {
    return null;
  }

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id, role')
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
    supabase.schema('public').from('group_members').select('user_id, role').eq('group_id', session.group_id),
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
    .select('group_id, role')
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
      ? myAnswers.reduce((sum, answer) => sum + (answer.confidence ?? 0), 0) / myAnswers.length
      : 0;
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
