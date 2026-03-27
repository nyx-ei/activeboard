import { cache } from 'react';

import type { User } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { computeAnswerDistribution } from '@/lib/demo/distribution';

type PublicClient = ReturnType<typeof createSupabaseServerClient>;

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

  const sessions =
    groupIds.length > 0
      ? (
          await supabase
            .schema('public')
            .from('sessions')
            .select('id, group_id, scheduled_at, status, timer_seconds')
            .in('group_id', groupIds)
            .order('scheduled_at', { ascending: true })
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

  const inviterIds = [...new Set((invites ?? []).map((invite) => invite.invited_by))];
  const inviteUsers = await getUsersMap(supabase, inviterIds);

  const dashboardGroups = (memberships ?? [])
    .map((membership) => {
      const group = groupsById.get(membership.group_id);
      if (!group) return null;

      return {
        ...group,
        role: membership.role,
        memberCount: countsByGroup.get(group.id) ?? 0,
        nextSession: upcomingByGroup.get(group.id) ?? null,
      };
    })
    .filter(
      (
        value,
      ): value is {
        id: string;
        name: string;
        invite_code: string;
        created_by: string | null;
        created_at: string;
        role: 'admin' | 'member';
        memberCount: number;
        nextSession: {
          id: string;
          group_id: string;
          scheduled_at: string;
          status: 'scheduled' | 'active' | 'completed' | 'cancelled';
          timer_seconds: number;
        } | null;
      } => value !== null,
    );

  const pendingInvites = (invites ?? []).map((invite) => ({
    ...invite,
    groupName: groupsById.get(invite.group_id)?.name ?? null,
    invitedByName:
      inviteUsers.get(invite.invited_by)?.display_name ?? inviteUsers.get(invite.invited_by)?.email ?? null,
  }));

  return { groups: dashboardGroups, pendingInvites };
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
      .select('id, scheduled_at, status, timer_seconds, leader_id, meeting_link')
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
    .select('id, group_id, scheduled_at, started_at, ended_at, timer_seconds, status, meeting_link, leader_id')
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
