import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function getInitials(value: string) {
  return (
    value
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'AB'
  );
}

type DashboardSessionQuestionCountRow = {
  session_id: string | null;
  question_count: number | null;
};

type DashboardSessionAnswerCountRow = {
  user_id: string | null;
  session_id: string | null;
  answered_question_count: number | null;
};

export async function getShellGroupsForUser(userId: string, locale: string) {
  const supabase = createSupabaseServerClient();
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: memberships } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);

  const groupIds = [
    ...new Set((memberships ?? []).map((membership) => membership.group_id)),
  ];
  if (groupIds.length === 0) {
    return [];
  }

  const [
    { data: groups },
    { data: schedules },
    { data: membershipsWithUsers },
  ] = await Promise.all([
    supabase
      .schema('public')
      .from('groups')
      .select('id, name')
      .in('id', groupIds)
      .order('created_at', { ascending: false }),
    supabase
      .schema('public')
      .from('group_weekly_schedules')
      .select('group_id, start_time, end_time, question_goal')
      .in('group_id', groupIds),
    supabaseAdmin
      .schema('public')
      .from('group_members')
      .select('group_id, user_id')
      .in('group_id', groupIds),
  ]);

  const memberIds = [
    ...new Set(
      (membershipsWithUsers ?? []).map((membership) => membership.user_id),
    ),
  ];
  const { data: memberProfiles } =
    memberIds.length > 0
      ? await supabaseAdmin
          .schema('public')
          .from('users')
          .select('id, display_name, email, avatar_url')
          .in('id', memberIds)
      : { data: [] };
  const memberProfileById = new Map(
    (memberProfiles ?? []).map((profile) => [profile.id, profile]),
  );

  return (groups ?? []).map((group) => {
    const groupSchedules = (schedules ?? []).filter(
      (schedule) => schedule.group_id === group.id,
    );
    const firstSchedule = groupSchedules[0];
    const weeklyQuestions = groupSchedules.reduce(
      (sum, schedule) => sum + (schedule.question_goal ?? 0),
      0,
    );
    const groupMemberships = (membershipsWithUsers ?? []).filter(
      (membership) => membership.group_id === group.id,
    );
    const membersPreview = groupMemberships.slice(0, 4).map((membership) => {
      const profile = memberProfileById.get(membership.user_id);
      const displayLabel = profile?.display_name ?? profile?.email ?? 'AB';

      return {
        id: membership.user_id,
        initials: getInitials(displayLabel),
        avatarUrl: profile?.avatar_url ?? null,
      };
    });

    return {
      id: group.id,
      name: group.name,
      language: locale.toUpperCase(),
      memberCount: groupMemberships.length,
      scheduleLabel: firstSchedule
        ? `${firstSchedule.start_time?.slice(0, 5) ?? '--:--'} - ${firstSchedule.end_time?.slice(0, 5) ?? '--:--'}`
        : '',
      weeklyQuestions,
      membersPreview,
    };
  });
}

export async function getGroupMemberPerformance(
  groupId: string,
  fallbackEmail = '',
) {
  const supabase = createSupabaseServerClient();
  const supabaseAdmin = createSupabaseAdminClient();
  const [{ data: members }, { data: sessions }] = await Promise.all([
    supabase
      .schema('public')
      .from('group_members')
      .select('user_id, is_founder')
      .eq('group_id', groupId),
    supabase
      .schema('public')
      .from('sessions')
      .select('id, scheduled_at, status')
      .eq('group_id', groupId),
  ]);

  const safeMembers = members ?? [];
  const safeSessions = (sessions ?? []).filter(
    (session) => session.status !== 'cancelled',
  );
  const sessionIds = safeSessions
    .map((session) => session.id)
    .filter((id): id is string => Boolean(id));
  const [questionCountsResult, answerCountsResult] =
    sessionIds.length > 0
      ? await Promise.all([
          supabase
            .schema('public')
            .from('dashboard_session_question_counts')
            .select('session_id, question_count')
            .in('session_id', sessionIds),
          supabase
            .schema('public')
            .from('dashboard_user_session_answer_counts')
            .select('user_id, session_id, answered_question_count')
            .in('session_id', sessionIds),
        ])
      : [
          { data: [] as DashboardSessionQuestionCountRow[] },
          { data: [] as DashboardSessionAnswerCountRow[] },
        ];

  const memberIds = [...new Set(safeMembers.map((member) => member.user_id))];
  const { data: memberProfiles } =
    memberIds.length > 0
      ? await supabaseAdmin
          .schema('public')
          .from('users')
          .select('id, display_name, email')
          .in('id', memberIds)
      : { data: [] };
  const usersMap = new Map(
    (memberProfiles ?? []).map((profile) => [profile.id, profile]),
  );

  const questionCountBySession = new Map(
    ((questionCountsResult.data ?? []) as DashboardSessionQuestionCountRow[])
      .filter((row) => row.session_id)
      .map((row) => [row.session_id as string, row.question_count ?? 0]),
  );
  const answersByUser = new Map<
    string,
    { totalAnswers: number; sessionIds: Set<string> }
  >();
  for (const answerCount of (answerCountsResult.data ??
    []) as DashboardSessionAnswerCountRow[]) {
    if (!answerCount.user_id || !answerCount.session_id) {
      continue;
    }

    const current = answersByUser.get(answerCount.user_id) ?? {
      totalAnswers: 0,
      sessionIds: new Set<string>(),
    };
    const answeredQuestionCount = answerCount.answered_question_count ?? 0;
    current.totalAnswers += answeredQuestionCount;
    if (answeredQuestionCount > 0) {
      current.sessionIds.add(answerCount.session_id);
    }
    answersByUser.set(answerCount.user_id, current);
  }

  const sessionsById = new Map(
    safeSessions.map((session) => [session.id, session]),
  );
  const totalTrackableSessions = safeSessions.length;
  const totalTrackableQuestions = safeSessions.reduce(
    (sum, session) => sum + (questionCountBySession.get(session.id) ?? 0),
    0,
  );

  return safeMembers.map((member) => {
    const profile = usersMap.get(member.user_id);
    const name =
      profile?.display_name ?? profile?.email ?? fallbackEmail ?? 'Member';
    const answerStats = answersByUser.get(member.user_id);
    const totalAnswers = answerStats?.totalAnswers ?? 0;
    const activeWeekKeys = new Set(
      [...(answerStats?.sessionIds ?? [])].map((sessionId) => {
        const scheduledAt = sessionsById.get(sessionId)?.scheduled_at;
        return scheduledAt ? scheduledAt.slice(0, 10) : sessionId;
      }),
    );

    return {
      userId: member.user_id,
      name,
      email: profile?.email ?? '',
      initials: getInitials(name),
      presenceRate:
        totalTrackableSessions > 0
          ? Math.round(
              ((answerStats?.sessionIds.size ?? 0) / totalTrackableSessions) *
                100,
            )
          : 0,
      completionRate:
        totalTrackableQuestions > 0
          ? Math.round((totalAnswers / totalTrackableQuestions) * 100)
          : 0,
      averageWeeklyQuestions: Math.round(
        totalAnswers / Math.max(1, activeWeekKeys.size),
      ),
      totalAnswers,
      status: ((answerStats?.sessionIds.size ?? 0) === 0 && totalAnswers === 0
        ? 'setup'
        : 'active') as 'setup' | 'active',
    };
  });
}

export async function getGroupWeeklyProgress(groupId: string) {
  const supabase = createSupabaseServerClient();
  const currentWeekStart = new Date();
  const currentDay = currentWeekStart.getDay();
  const offsetToMonday = currentDay === 0 ? 6 : currentDay - 1;
  currentWeekStart.setDate(currentWeekStart.getDate() - offsetToMonday);
  currentWeekStart.setHours(0, 0, 0, 0);

  const [{ data: members }, { data: sessions }, { data: schedules }] =
    await Promise.all([
      supabase
        .schema('public')
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId),
      supabase
        .schema('public')
        .from('sessions')
        .select('id, scheduled_at, status')
        .eq('group_id', groupId)
        .neq('status', 'cancelled')
        .gte('scheduled_at', currentWeekStart.toISOString()),
      supabase
        .schema('public')
        .from('group_weekly_schedules')
        .select('question_goal')
        .eq('group_id', groupId),
    ]);

  const safeMembers = members ?? [];
  const safeSessions = sessions ?? [];
  const weeklyTargetQuestions = (schedules ?? []).reduce(
    (sum, schedule) => sum + (schedule.question_goal ?? 0),
    0,
  );
  const qualifyingGroupSize =
    safeMembers.length >= 2 && safeMembers.length <= 5;

  if (!qualifyingGroupSize || safeSessions.length === 0) {
    return {
      weeklyCompletedQuestions: 0,
      weeklyTargetQuestions,
    };
  }

  const weeklySessionIds = safeSessions.map((session) => session.id);

  if (weeklySessionIds.length === 0) {
    return {
      weeklyCompletedQuestions: 0,
      weeklyTargetQuestions,
    };
  }

  const { data: questions } = await supabase
    .schema('public')
    .from('questions')
    .select('id')
    .in('session_id', weeklySessionIds);

  const questionIds = (questions ?? []).map((question) => question.id);
  if (questionIds.length === 0) {
    return {
      weeklyCompletedQuestions: 0,
      weeklyTargetQuestions,
    };
  }

  const { data: answers } = await supabase
    .schema('public')
    .from('answers')
    .select('question_id')
    .in('question_id', questionIds);

  const questionAnswerCounts = new Map<string, number>();
  for (const answer of answers ?? []) {
    questionAnswerCounts.set(
      answer.question_id,
      (questionAnswerCounts.get(answer.question_id) ?? 0) + 1,
    );
  }

  return {
    weeklyCompletedQuestions: questionIds.filter(
      (questionId) =>
        (questionAnswerCounts.get(questionId) ?? 0) >= safeMembers.length,
    ).length,
    weeklyTargetQuestions,
  };
}

export async function getLiveGroupsForUser(userId: string, locale: string) {
  const supabase = createSupabaseServerClient();
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: memberships } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);
  const currentGroupIds = new Set(
    (memberships ?? []).map((membership) => membership.group_id),
  );

  const { data: candidateGroups } = await supabaseAdmin
    .schema('public')
    .from('groups')
    .select('id, name, invite_code, max_members, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  const availableGroups = (candidateGroups ?? []).filter(
    (group) => !currentGroupIds.has(group.id),
  );
  const availableGroupIds = availableGroups.map((group) => group.id);
  if (availableGroupIds.length === 0) {
    return [];
  }

  const [{ data: memberRows }, { data: schedules }] = await Promise.all([
    supabaseAdmin
      .schema('public')
      .from('group_members')
      .select('group_id, user_id')
      .in('group_id', availableGroupIds),
    supabaseAdmin
      .schema('public')
      .from('group_weekly_schedules')
      .select('group_id, question_goal')
      .in('group_id', availableGroupIds),
  ]);

  const memberIds = [
    ...new Set((memberRows ?? []).map((membership) => membership.user_id)),
  ];
  const { data: users } =
    memberIds.length > 0
      ? await supabaseAdmin
          .schema('public')
          .from('users')
          .select('id, display_name, email')
          .in('id', memberIds)
      : { data: [] };
  const usersMap = new Map(
    (users ?? []).map((profile) => [profile.id, profile]),
  );

  const membersByGroup = new Map<string, Array<{ user_id: string }>>();
  for (const membership of memberRows ?? []) {
    const current = membersByGroup.get(membership.group_id) ?? [];
    current.push({ user_id: membership.user_id });
    membersByGroup.set(membership.group_id, current);
  }

  const weeklyByGroup = new Map<string, number>();
  for (const schedule of schedules ?? []) {
    weeklyByGroup.set(
      schedule.group_id,
      (weeklyByGroup.get(schedule.group_id) ?? 0) + schedule.question_goal,
    );
  }

  return availableGroups
    .map((group) => {
      const members = membersByGroup.get(group.id) ?? [];
      return {
        id: group.id,
        name: group.name,
        inviteCode: group.invite_code,
        memberCount: members.length,
        maxMembers: group.max_members,
        language: locale.toUpperCase(),
        timezone: '',
        weeklyQuestions: weeklyByGroup.get(group.id) ?? 0,
        minutesAgo: Math.max(
          1,
          Math.round(
            (Date.now() - new Date(group.created_at).getTime()) / 60000,
          ),
        ),
        compatible: true,
        members: members.slice(0, 5).map((member) => {
          const profile = usersMap.get(member.user_id);
          const label = profile?.display_name ?? profile?.email ?? 'AB';
          return { id: member.user_id, initials: getInitials(label) };
        }),
      };
    })
    .filter((group) => group.memberCount < group.maxMembers);
}
