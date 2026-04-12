import { cache } from 'react';

import type { User } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TRIAL_QUESTION_LIMIT } from '@/lib/billing/user-tier';
import { computeAnswerDistribution } from '@/lib/demo/distribution';
import { confidenceToScore, scoreToConfidenceLevel, type ConfidenceLevel } from '@/lib/demo/confidence';
import { createPerfTracker } from '@/lib/observability/perf';
import { getAvailabilitySlotCount, normalizeAvailabilityGrid } from '@/lib/schedule/availability';
import {
  DIMENSION_OF_CARE_OPTIONS,
  ERROR_TYPE_OPTIONS,
  PHYSICIAN_ACTIVITY_OPTIONS,
  type DimensionOfCare,
  type ErrorType,
  type PhysicianActivity,
} from '@/lib/types/demo';

type PublicClient = ReturnType<typeof createSupabaseServerClient>;
type DashboardSession = {
  id: string;
  group_id: string;
  name: string | null;
  scheduled_at: string;
  share_code: string;
  status: 'scheduled' | 'active' | 'incomplete' | 'completed' | 'cancelled';
  timer_mode: 'per_question' | 'global';
  timer_seconds: number;
  leader_id: string | null;
  question_goal: number;
  answeredQuestionCount?: number;
  questionCount?: number;
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

type PendingInvite = {
  id: string;
  group_id: string;
  invited_by: string;
  invitee_email: string;
  status: string;
  created_at: string;
  groupName: string | null;
  invitedByName: string | null;
};

type TrialProgressData = {
  current: number;
  total: number;
  remaining: number;
  warningThreshold: number;
  showWarning: boolean;
  isComplete: boolean;
};

type HeatmapDay = {
  date: string;
  count: number;
  intensity: 0 | 1 | 2 | 3 | 4;
};

type CategoryAccuracyItem<TCategory extends string> = {
  category: TCategory;
  total: number;
  correct: number;
  accuracy: number;
};

type BlueprintGridCell = {
  physicianActivity: PhysicianActivity;
  dimensionOfCare: DimensionOfCare;
  total: number;
  correct: number;
  accuracy: number | null;
};

type ConfidenceCalibrationItem = {
  confidence: ConfidenceLevel;
  total: number;
  correct: number;
  accuracy: number;
};

type ErrorTypeBreakdownItem = {
  errorType: ErrorType;
  count: number;
};

type TrendPoint = {
  label: string;
  total: number;
  accuracy: number | null;
};

type ProfileAnalyticsData = {
  trialProgress: TrialProgressData;
  heatmap: HeatmapDay[];
  physicianActivityAccuracy: CategoryAccuracyItem<PhysicianActivity>[];
  dimensionOfCareAccuracy: CategoryAccuracyItem<DimensionOfCare>[];
  blueprintGrid: BlueprintGridCell[];
  confidenceCalibration: ConfidenceCalibrationItem[];
  errorTypeBreakdown: ErrorTypeBreakdownItem[];
  weeklyTrend: TrendPoint[];
};

const TRIAL_WARNING_THRESHOLD = 85;

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

function dedupeDashboardSessions<T extends DashboardSession & { groupName: string | null }>(sessions: T[]) {
  const byLogicalSession = new Map<string, T>();
  const statusWeight: Record<DashboardSession['status'], number> = {
    active: 5,
    incomplete: 4,
    scheduled: 3,
    completed: 2,
    cancelled: 1,
  };

  for (const session of sessions) {
    const logicalName = (session.name ?? session.groupName ?? session.id).trim().toLowerCase();
    const key = `${session.group_id}:${logicalName}`;
    const current = byLogicalSession.get(key);

    if (!current) {
      byLogicalSession.set(key, session);
      continue;
    }

    const currentWeight = statusWeight[current.status];
    const nextWeight = statusWeight[session.status];
    const currentTime = new Date(current.scheduled_at).getTime();
    const nextTime = new Date(session.scheduled_at).getTime();

    if (nextWeight > currentWeight || (nextWeight === currentWeight && nextTime >= currentTime)) {
      byLogicalSession.set(key, session);
    }
  }

  return Array.from(byLogicalSession.values()).sort(
    (left, right) => new Date(right.scheduled_at).getTime() - new Date(left.scheduled_at).getTime(),
  );
}

function toIsoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const currentDay = next.getUTCDay();
  const offsetToMonday = currentDay === 0 ? 6 : currentDay - 1;
  next.setUTCDate(next.getUTCDate() - offsetToMonday);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function computeHeatmap(answers: { answered_at: string | null }[]): HeatmapDay[] {
  const countsByDay = new Map<string, number>();

  for (const answer of answers) {
    if (!answer.answered_at) continue;
    const dayKey = answer.answered_at.slice(0, 10);
    countsByDay.set(dayKey, (countsByDay.get(dayKey) ?? 0) + 1);
  }

  const days: HeatmapDay[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const range = 112;
  let maxCount = 0;

  for (let offset = range - 1; offset >= 0; offset -= 1) {
    const current = new Date(today);
    current.setUTCDate(today.getUTCDate() - offset);
    const date = toIsoDay(current);
    const count = countsByDay.get(date) ?? 0;
    maxCount = Math.max(maxCount, count);
    days.push({ date, count, intensity: 0 });
  }

  return days.map((day) => {
    if (day.count === 0 || maxCount === 0) {
      return day;
    }

    const ratio = day.count / maxCount;
    const intensity = ratio >= 0.75 ? 4 : ratio >= 0.5 ? 3 : ratio >= 0.25 ? 2 : 1;
    return { ...day, intensity };
  });
}

function buildCategoryAccuracy<TCategory extends string>(
  categories: readonly TCategory[],
  rows: Array<{ category: TCategory; isCorrect: boolean | null }>,
): CategoryAccuracyItem<TCategory>[] {
  return categories.map((category) => {
    const matching = rows.filter((row) => row.category === category);
    const total = matching.length;
    const correct = matching.filter((row) => row.isCorrect === true).length;
    return {
      category,
      total,
      correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    };
  });
}

function buildWeeklyTrend(
  answers: { answered_at: string | null; is_correct: boolean | null }[],
  weeks = 8,
): TrendPoint[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const currentWeekStart = startOfWeek(today);
  const weeklyBuckets = new Map<string, { total: number; correct: number }>();

  for (let index = weeks - 1; index >= 0; index -= 1) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setUTCDate(currentWeekStart.getUTCDate() - index * 7);
    weeklyBuckets.set(toIsoDay(weekStart), { total: 0, correct: 0 });
  }

  for (const answer of answers) {
    if (!answer.answered_at) continue;
    const answeredAt = new Date(answer.answered_at);
    const bucketKey = toIsoDay(startOfWeek(answeredAt));
    const bucket = weeklyBuckets.get(bucketKey);
    if (!bucket) continue;
    bucket.total += 1;
    if (answer.is_correct === true) {
      bucket.correct += 1;
    }
  }

  return Array.from(weeklyBuckets.entries()).map(([weekStart, bucket]) => {
    const label = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
      new Date(weekStart),
    );

    return {
      label,
      total: bucket.total,
      accuracy: bucket.total > 0 ? Math.round((bucket.correct / bucket.total) * 100) : null,
    };
  });
}

export const getDashboardData = cache(
  async (
    user: User,
    includeGroupDashboard = false,
    includeProfileAnalytics = false,
    includeMemberPerformance = includeGroupDashboard,
    includeUserSchedule = true,
  ) => {
  const perf = createPerfTracker(`getDashboardData:${user.id}`);
  const supabase = createSupabaseServerClient();

  const [{ data: memberships }, { data: userSchedule }] = await Promise.all([
    supabase
      .schema('public')
      .from('group_members')
      .select('group_id, is_founder')
      .eq('user_id', user.id),
    includeUserSchedule
      ? supabase
          .schema('public')
          .from('user_schedules')
          .select('user_id, timezone, availability_grid, updated_at')
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
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
            .select('id, group_id, name, scheduled_at, share_code, status, timer_mode, timer_seconds, leader_id, question_goal')
            .in('group_id', groupIds)
            .order('scheduled_at', { ascending: true })
            .then((result) => (result.data ?? []) as DashboardSession[]),
        ])
      : [[], [], [], [] as DashboardSession[]];
  perf.step('dashboard_core_loaded');

  const myAnswers =
    (
      await supabase
        .schema('public')
        .from('answers')
        .select('question_id, confidence, is_correct, answered_at')
        .eq('user_id', user.id)
        .order('answered_at', { ascending: true })
    ).data ?? [];
  const sessionIds = sessions.map((session) => session.id);
  const sessionQuestions =
    sessionIds.length > 0
      ? (
          await supabase
            .schema('public')
            .from('questions')
            .select('id, session_id')
            .in('session_id', sessionIds)
        ).data ?? []
      : [];
  const answeredQuestionIds = myAnswers.map((answer) => answer.question_id);
  const [classifications, reflections] =
    includeProfileAnalytics && answeredQuestionIds.length > 0
      ? await Promise.all([
          supabase
            .schema('public')
            .from('question_classifications')
            .select('question_id, physician_activity, dimension_of_care')
            .in('question_id', answeredQuestionIds)
            .then((result) => result.data ?? []),
          supabase
            .schema('public')
            .from('personal_reflections')
            .select('question_id, error_type')
            .eq('user_id', user.id)
            .in('question_id', answeredQuestionIds)
            .then((result) => result.data ?? []),
        ])
      : [[], []];
  perf.step('profile_analytics_loaded');

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

  const pendingInvites: PendingInvite[] = [];

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
  const classificationByQuestionId = new Map(
    classifications.map((classification) => [classification.question_id, classification]),
  );
  const profileAnalytics: ProfileAnalyticsData = includeProfileAnalytics
    ? (() => {
        const activityRows = myAnswers.flatMap((answer) => {
          const classification = classificationByQuestionId.get(answer.question_id);
          return classification
            ? [{ category: classification.physician_activity, isCorrect: answer.is_correct }]
            : [];
        });
        const dimensionRows = myAnswers.flatMap((answer) => {
          const classification = classificationByQuestionId.get(answer.question_id);
          return classification
            ? [{ category: classification.dimension_of_care, isCorrect: answer.is_correct }]
            : [];
        });
        const confidenceCalibration: ConfidenceCalibrationItem[] = (['low', 'medium', 'high'] as const).map(
          (confidence) => {
            const matching = myAnswers.filter((answer) => answer.confidence === confidence);
            const total = matching.length;
            const correct = matching.filter((answer) => answer.is_correct === true).length;
            return {
              confidence,
              total,
              correct,
              accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
            };
          },
        );
        const errorTypeBreakdown = ERROR_TYPE_OPTIONS.map((errorType) => ({
          errorType,
          count: reflections.filter((reflection) => reflection.error_type === errorType).length,
        })).filter((item) => item.count > 0);
        const trialProgress: TrialProgressData = {
          current: Math.min(answeredCount, TRIAL_QUESTION_LIMIT),
          total: TRIAL_QUESTION_LIMIT,
          remaining: Math.max(TRIAL_QUESTION_LIMIT - answeredCount, 0),
          warningThreshold: TRIAL_WARNING_THRESHOLD,
          showWarning: answeredCount >= TRIAL_WARNING_THRESHOLD && answeredCount < TRIAL_QUESTION_LIMIT,
          isComplete: answeredCount >= TRIAL_QUESTION_LIMIT,
        };
        const blueprintGrid: BlueprintGridCell[] = PHYSICIAN_ACTIVITY_OPTIONS.flatMap((physicianActivity) =>
          DIMENSION_OF_CARE_OPTIONS.map((dimensionOfCare) => {
            const matchingAnswers = myAnswers.filter((answer) => {
              const classification = classificationByQuestionId.get(answer.question_id);
              return (
                classification?.physician_activity === physicianActivity &&
                classification.dimension_of_care === dimensionOfCare
              );
            });
            const total = matchingAnswers.length;
            const correct = matchingAnswers.filter((answer) => answer.is_correct === true).length;

            return {
              physicianActivity,
              dimensionOfCare,
              total,
              correct,
              accuracy: total > 0 ? Math.round((correct / total) * 100) : null,
            };
          }),
        );

        return {
          trialProgress,
          heatmap: computeHeatmap(myAnswers),
          physicianActivityAccuracy: buildCategoryAccuracy(PHYSICIAN_ACTIVITY_OPTIONS, activityRows),
          dimensionOfCareAccuracy: buildCategoryAccuracy(DIMENSION_OF_CARE_OPTIONS, dimensionRows),
          blueprintGrid,
          confidenceCalibration,
          errorTypeBreakdown,
          weeklyTrend: buildWeeklyTrend(myAnswers),
        };
      })()
    : {
        trialProgress: {
          current: Math.min(answeredCount, TRIAL_QUESTION_LIMIT),
          total: TRIAL_QUESTION_LIMIT,
          remaining: Math.max(TRIAL_QUESTION_LIMIT - answeredCount, 0),
          warningThreshold: TRIAL_WARNING_THRESHOLD,
          showWarning: false,
          isComplete: answeredCount >= TRIAL_QUESTION_LIMIT,
        },
        heatmap: [],
        physicianActivityAccuracy: [],
        dimensionOfCareAccuracy: [],
        blueprintGrid: [],
        confidenceCalibration: [],
        errorTypeBreakdown: [],
        weeklyTrend: [],
      };

  const sessionByQuestionId = new Map(sessionQuestions.map((question) => [question.id, question.session_id]));
  const questionCountBySession = new Map<string, number>();
  const answeredQuestionCountBySession = new Map<string, number>();

  for (const question of sessionQuestions) {
    questionCountBySession.set(question.session_id, (questionCountBySession.get(question.session_id) ?? 0) + 1);
  }

  for (const answer of myAnswers) {
    const sessionId = sessionByQuestionId.get(answer.question_id);
    if (!sessionId) continue;
    answeredQuestionCountBySession.set(sessionId, (answeredQuestionCountBySession.get(sessionId) ?? 0) + 1);
  }

  const enrichedSessions = sessions.map((session) => ({
    ...session,
    groupName: groupsById.get(session.group_id)?.name ?? null,
    answeredQuestionCount: answeredQuestionCountBySession.get(session.id) ?? 0,
    questionCount: questionCountBySession.get(session.id) ?? 0,
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
    const questionSessionIds = includeMemberPerformance ? primaryGroupSessionIds : Array.from(weeklySessionIds);
    const [{ data: groupMembers }, { data: groupQuestions }] = await Promise.all([
      includeMemberPerformance
        ? supabase
            .schema('public')
            .from('group_members')
            .select('group_id, user_id, is_founder')
            .eq('group_id', primaryGroup.id)
        : Promise.resolve({ data: [] as { group_id: string; user_id: string; is_founder: boolean }[] }),
      questionSessionIds.length > 0
        ? supabase
            .schema('public')
            .from('questions')
            .select('id, session_id')
            .in('session_id', questionSessionIds)
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

    const memberIds = includeMemberPerformance ? [...new Set((groupMembers ?? []).map((member) => member.user_id))] : [];
    const groupUsers = includeMemberPerformance ? await getUsersMap(supabase, memberIds) : new Map();
    const questionSessionById = new Map(primaryGroupQuestions.map((question) => [question.id, question.session_id]));

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
      memberPerformance: includeMemberPerformance ? (groupMembers ?? []).map((member) => {
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
              .map((part: string) => part[0])
              .join('')
              .slice(0, 2)
              .toUpperCase() || 'AB',
          is_founder: member.is_founder,
          presenceRate,
          completionRate,
          status:
            (answerStats?.sessionIds.size ?? 0) === 0 && (answerStats?.questionIds.size ?? 0) === 0 ? 'setup' : 'active',
        };
      }) : [],
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
    userSchedule: userSchedule
      ? {
          ...userSchedule,
          availability_grid: normalizeAvailabilityGrid(userSchedule.availability_grid),
          slotCount: getAvailabilitySlotCount(normalizeAvailabilityGrid(userSchedule.availability_grid)),
        }
      : null,
    metrics: {
      answeredCount,
      completedSessionsCount: completedSessions.length,
      successRate,
      errorRate,
      averageConfidence,
      leagueProgress: Math.min(100, Math.round((answeredCount / 300) * 100)),
    },
    profileAnalytics,
    sessions: dedupeDashboardSessions(enrichedSessions.filter((session) => session.status !== 'cancelled')),
    activeSessions,
    nextSession,
    groupDashboard,
  };
  },
);

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
    .select('id, group_id, name, scheduled_at, share_code, started_at, ended_at, timer_mode, timer_seconds, status, meeting_link, leader_id, question_goal')
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
      .order('order_index', { ascending: true }),
  ]);

  const currentQuestion = (questions ?? []).find((question) => question.phase === 'answering' || question.phase === 'review') ?? (questions ?? [])[0] ?? null;
  const questionIds = (questions ?? []).map((question) => question.id);

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
  const allAnswers =
    questionIds.length > 0
      ? (
          await supabase
            .schema('public')
            .from('answers')
            .select('id, question_id, user_id, selected_option, confidence, is_correct, answered_at')
            .in('question_id', questionIds)
        ).data ?? []
      : [];

  const allClassifications =
    questionIds.length > 0
      ? (
          await supabase
            .schema('public')
            .from('question_classifications')
            .select(
              'id, question_id, session_id, classified_by, correct_answer, physician_activity, dimension_of_care, frequent_error_type, classified_at',
            )
            .in('question_id', questionIds)
        ).data ?? []
      : [];

  const allReflections =
    questionIds.length > 0
      ? (
          await supabase
            .schema('public')
            .from('personal_reflections')
            .select('id, question_id, user_id, error_type, private_note, created_at, updated_at')
            .in('question_id', questionIds)
            .eq('user_id', user.id)
        ).data ?? []
      : [];

  const sharedClassification =
    currentQuestion
      ? (
          await supabase
            .schema('public')
            .from('question_classifications')
            .select(
              'id, question_id, session_id, classified_by, correct_answer, physician_activity, dimension_of_care, frequent_error_type, classified_at',
            )
            .eq('question_id', currentQuestion.id)
            .maybeSingle()
        ).data ?? null
      : null;

  const myReflection =
    currentQuestion
      ? (
          await supabase
            .schema('public')
            .from('personal_reflections')
            .select('id, question_id, user_id, error_type, private_note, created_at, updated_at')
            .eq('question_id', currentQuestion.id)
            .eq('user_id', user.id)
            .maybeSingle()
        ).data ?? null
      : null;

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
    allAnswers,
    allClassifications,
    allReflections,
    myAnswer,
    sharedClassification,
    myReflection,
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

  const classifications =
    questionIds.length > 0
      ? (
          await supabase
            .schema('public')
            .from('question_classifications')
            .select(
              'id, question_id, session_id, classified_by, correct_answer, physician_activity, dimension_of_care, classified_at',
            )
            .in('question_id', questionIds)
        ).data ?? []
      : [];

  const reflections =
    questionIds.length > 0
      ? (
          await supabase
            .schema('public')
            .from('personal_reflections')
            .select('id, question_id, user_id, error_type, private_note, created_at, updated_at')
            .in('question_id', questionIds)
            .eq('user_id', user.id)
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
    const classification = classifications.find((item) => item.question_id === question.id) ?? null;
    const reflection = reflections.find((item) => item.question_id === question.id) ?? null;

    return {
      ...question,
      classification,
      reflection,
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
