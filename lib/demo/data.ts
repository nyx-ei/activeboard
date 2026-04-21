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
  meeting_link: string | null;
  max_members: number;
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
  averageWeeklyQuestions: number;
  totalAnswers: number;
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

function computeHeatmapFromDailyCounts(dailyCounts: { answered_on: string | null; answer_count: number | null }[]): HeatmapDay[] {
  const countsByDay = new Map<string, number>();

  for (const row of dailyCounts) {
    if (!row.answered_on) continue;
    countsByDay.set(row.answered_on, row.answer_count ?? 0);
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

function buildEmptyProfileAnalytics(answeredCount = 0, heatmap: HeatmapDay[] = []): ProfileAnalyticsData {
  return {
    trialProgress: {
      current: Math.min(answeredCount, TRIAL_QUESTION_LIMIT),
      total: TRIAL_QUESTION_LIMIT,
      remaining: Math.max(TRIAL_QUESTION_LIMIT - answeredCount, 0),
      warningThreshold: TRIAL_WARNING_THRESHOLD,
      showWarning: answeredCount >= TRIAL_WARNING_THRESHOLD && answeredCount < TRIAL_QUESTION_LIMIT,
      isComplete: answeredCount >= TRIAL_QUESTION_LIMIT,
    },
    heatmap,
    physicianActivityAccuracy: [],
    dimensionOfCareAccuracy: [],
    blueprintGrid: [],
    confidenceCalibration: [],
    errorTypeBreakdown: [],
    weeklyTrend: [],
  };
}

async function getProfileAnalytics(userId: string, answeredCount: number, heatmap: HeatmapDay[]) {
  const supabase = createSupabaseServerClient();
  const { data: answers } = await supabase
    .schema('public')
    .from('answers')
    .select('question_id, answered_at, is_correct, confidence')
    .eq('user_id', userId);

  const safeAnswers = answers ?? [];
  if (safeAnswers.length === 0) {
    return buildEmptyProfileAnalytics(answeredCount, heatmap);
  }

  const questionIds = [...new Set(safeAnswers.map((answer) => answer.question_id))];
  const [{ data: questions }, { data: classifications }, { data: reflections }] = await Promise.all([
    supabase
      .schema('public')
      .from('questions')
      .select('id, session_id')
      .in('id', questionIds),
    supabase
      .schema('public')
      .from('question_classifications')
      .select('question_id, physician_activity, dimension_of_care')
      .in('question_id', questionIds),
    supabase
      .schema('public')
      .from('personal_reflections')
      .select('question_id, error_type')
      .eq('user_id', userId)
      .in('question_id', questionIds),
  ]);

  const sessionIds = [...new Set((questions ?? []).map((question) => question.session_id))];
  const { data: sessions } =
    sessionIds.length > 0
      ? await supabase.schema('public').from('sessions').select('id, scheduled_at').in('id', sessionIds)
      : { data: [] as { id: string; scheduled_at: string }[] };

  const questionById = new Map((questions ?? []).map((question) => [question.id, question]));
  const classificationByQuestionId = new Map((classifications ?? []).map((classification) => [classification.question_id, classification]));
  const sessionById = new Map((sessions ?? []).map((session) => [session.id, session]));

  const physicianActivityTotals = new Map<PhysicianActivity, { total: number; correct: number }>();
  const dimensionOfCareTotals = new Map<DimensionOfCare, { total: number; correct: number }>();
  const blueprintTotals = new Map<string, { total: number; correct: number }>();
  const confidenceTotals = new Map<ConfidenceLevel, { total: number; correct: number }>();
  const errorTypeTotals = new Map<ErrorType, number>();
  const weeklyTotals = new Map<string, { total: number; correct: number }>();

  for (const reflection of reflections ?? []) {
    if (!reflection.error_type) continue;
    errorTypeTotals.set(reflection.error_type, (errorTypeTotals.get(reflection.error_type) ?? 0) + 1);
  }

  for (const answer of safeAnswers) {
    const classification = classificationByQuestionId.get(answer.question_id);
    const isCorrect = Boolean(answer.is_correct);

    if (classification) {
      const physicianTotals = physicianActivityTotals.get(classification.physician_activity) ?? { total: 0, correct: 0 };
      physicianTotals.total += 1;
      physicianTotals.correct += isCorrect ? 1 : 0;
      physicianActivityTotals.set(classification.physician_activity, physicianTotals);

      const dimensionTotals = dimensionOfCareTotals.get(classification.dimension_of_care) ?? { total: 0, correct: 0 };
      dimensionTotals.total += 1;
      dimensionTotals.correct += isCorrect ? 1 : 0;
      dimensionOfCareTotals.set(classification.dimension_of_care, dimensionTotals);

      const blueprintKey = `${classification.physician_activity}:${classification.dimension_of_care}`;
      const blueprintCell = blueprintTotals.get(blueprintKey) ?? { total: 0, correct: 0 };
      blueprintCell.total += 1;
      blueprintCell.correct += isCorrect ? 1 : 0;
      blueprintTotals.set(blueprintKey, blueprintCell);
    }

    if (answer.confidence) {
      const confidenceTotal = confidenceTotals.get(answer.confidence) ?? { total: 0, correct: 0 };
      confidenceTotal.total += 1;
      confidenceTotal.correct += isCorrect ? 1 : 0;
      confidenceTotals.set(answer.confidence, confidenceTotal);
    }

    const sessionId = questionById.get(answer.question_id)?.session_id;
    const scheduledAt = sessionId ? sessionById.get(sessionId)?.scheduled_at : null;
    const weekSource = scheduledAt ?? answer.answered_at;
    const weekKey = toIsoDay(startOfWeek(new Date(weekSource)));
    const weeklyTotal = weeklyTotals.get(weekKey) ?? { total: 0, correct: 0 };
    weeklyTotal.total += 1;
    weeklyTotal.correct += isCorrect ? 1 : 0;
    weeklyTotals.set(weekKey, weeklyTotal);
  }

  const physicianActivityAccuracy = PHYSICIAN_ACTIVITY_OPTIONS.map((category) => {
    const totals = physicianActivityTotals.get(category) ?? { total: 0, correct: 0 };
    return {
      category,
      total: totals.total,
      correct: totals.correct,
      accuracy: totals.total > 0 ? Math.round((totals.correct / totals.total) * 100) : 0,
    };
  });

  const dimensionOfCareAccuracy = DIMENSION_OF_CARE_OPTIONS.map((category) => {
    const totals = dimensionOfCareTotals.get(category) ?? { total: 0, correct: 0 };
    return {
      category,
      total: totals.total,
      correct: totals.correct,
      accuracy: totals.total > 0 ? Math.round((totals.correct / totals.total) * 100) : 0,
    };
  });

  const blueprintGrid = PHYSICIAN_ACTIVITY_OPTIONS.flatMap((physicianActivity) =>
    DIMENSION_OF_CARE_OPTIONS.map((dimensionOfCare) => {
      const totals = blueprintTotals.get(`${physicianActivity}:${dimensionOfCare}`) ?? { total: 0, correct: 0 };
      return {
        physicianActivity,
        dimensionOfCare,
        total: totals.total,
        correct: totals.correct,
        accuracy: totals.total > 0 ? Math.round((totals.correct / totals.total) * 100) : null,
      };
    }),
  );

  const confidenceCalibration = (['low', 'medium', 'high'] as ConfidenceLevel[]).map((confidence) => {
    const totals = confidenceTotals.get(confidence) ?? { total: 0, correct: 0 };
    return {
      confidence,
      total: totals.total,
      correct: totals.correct,
      accuracy: totals.total > 0 ? Math.round((totals.correct / totals.total) * 100) : 0,
    };
  });

  const errorTypeBreakdown = ERROR_TYPE_OPTIONS.map((errorType) => ({
    errorType,
    count: errorTypeTotals.get(errorType) ?? 0,
  }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count);

  const weeklyTrend = [...weeklyTotals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-8)
    .map(([label, totals]) => ({
      label,
      total: totals.total,
      accuracy: totals.total > 0 ? Math.round((totals.correct / totals.total) * 100) : null,
    }));

  return {
    trialProgress: {
      current: Math.min(answeredCount, TRIAL_QUESTION_LIMIT),
      total: TRIAL_QUESTION_LIMIT,
      remaining: Math.max(TRIAL_QUESTION_LIMIT - answeredCount, 0),
      warningThreshold: TRIAL_WARNING_THRESHOLD,
      showWarning: answeredCount >= TRIAL_WARNING_THRESHOLD && answeredCount < TRIAL_QUESTION_LIMIT,
      isComplete: answeredCount >= TRIAL_QUESTION_LIMIT,
    },
    heatmap,
    physicianActivityAccuracy,
    dimensionOfCareAccuracy,
    blueprintGrid,
    confidenceCalibration,
    errorTypeBreakdown,
    weeklyTrend,
  } satisfies ProfileAnalyticsData;
}

async function getUserSchedule(userId: string) {
  const { data: userSchedule } = await createSupabaseServerClient()
    .schema('public')
    .from('user_schedules')
    .select('user_id, timezone, availability_grid, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  return userSchedule
    ? {
        ...userSchedule,
        availability_grid: normalizeAvailabilityGrid(userSchedule.availability_grid),
        slotCount: getAvailabilitySlotCount(normalizeAvailabilityGrid(userSchedule.availability_grid)),
      }
    : null;
}

async function getDashboardCore(userId: string) {
  const supabase = createSupabaseServerClient();
  const { data: memberships } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id, is_founder')
    .eq('user_id', userId);

  const groupIds = (memberships ?? []).map((membership) => membership.group_id);
  if (groupIds.length === 0) {
    return {
      groups: [] as DashboardGroup[],
      groupsById: new Map<string, { name: string }>(),
      sessions: [] as DashboardSession[],
      activeSessions: [] as DashboardSession[],
      completedSessionsCount: 0,
    };
  }

  const [groups, memberCounts, sessions] = await Promise.all([
    supabase
      .schema('public')
      .from('groups')
      .select('id, name, invite_code, created_by, created_at, meeting_link, max_members')
      .in('id', groupIds)
      .then((result) => result.data ?? []),
    supabase
      .schema('public')
      .from('group_members')
      .select('group_id')
      .in('group_id', groupIds)
      .then((result) => result.data ?? []),
    supabase
      .schema('public')
      .from('sessions')
      .select('id, group_id, name, scheduled_at, share_code, status, timer_mode, timer_seconds, leader_id, question_goal')
      .in('group_id', groupIds)
      .order('scheduled_at', { ascending: true })
      .then((result) => (result.data ?? []) as DashboardSession[]),
  ]);

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

  return {
    groups: (memberships ?? []).reduce<DashboardGroup[]>((acc, membership) => {
      const group = groupsById.get(membership.group_id);
      if (!group) return acc;

      acc.push({
        ...group,
        is_founder: membership.is_founder,
        memberCount: countsByGroup.get(group.id) ?? 0,
        nextSession: upcomingByGroup.get(group.id) ?? null,
      });

      return acc;
    }, []),
    groupsById,
    sessions,
    activeSessions: sessions.filter((session) => session.status === 'active'),
    completedSessionsCount: sessions.filter((session) => session.status === 'completed').length,
  };
}

async function getCompletedSessionsCount(userId: string) {
  const supabase = createSupabaseServerClient();
  const { data: memberships } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);

  const groupIds = (memberships ?? []).map((membership) => membership.group_id);
  if (groupIds.length === 0) {
    return 0;
  }

  const { data: sessions } = await supabase
    .schema('public')
    .from('sessions')
    .select('status')
    .in('group_id', groupIds)
    .eq('status', 'completed');

  return sessions?.length ?? 0;
}

async function getDashboardSessionCounts(userId: string, sessionIds: string[]) {
  if (sessionIds.length === 0) {
    return {
      questionCountBySession: new Map<string, number>(),
      answeredQuestionCountBySession: new Map<string, number>(),
    };
  }

  const supabase = createSupabaseServerClient();
  const [{ data: questionCounts }, { data: answeredCounts }] = await Promise.all([
    supabase
      .schema('public')
      .from('dashboard_session_question_counts')
      .select('session_id, question_count')
      .in('session_id', sessionIds),
    supabase
      .schema('public')
      .from('dashboard_user_session_answer_counts')
      .select('session_id, answered_question_count')
      .eq('user_id', userId)
      .in('session_id', sessionIds),
  ]);

  return {
    questionCountBySession: new Map(
      (questionCounts ?? []).flatMap((row) => (row.session_id ? [[row.session_id, row.question_count]] : [])),
    ),
    answeredQuestionCountBySession: new Map(
      (answeredCounts ?? []).flatMap((row) => (row.session_id ? [[row.session_id, row.answered_question_count]] : [])),
    ),
  };
}

async function getPrimaryGroupDashboard(primaryGroup: DashboardGroup | null, sessions: DashboardSession[]) {
  if (!primaryGroup) {
    return {
      group: null,
      schedules: [],
      weeklyProgressPercentage: 0,
      weeklyCompletedQuestions: 0,
      weeklyTargetQuestions: 0,
      memberPerformance: [],
    } satisfies GroupDashboardData;
  }

  const supabase = createSupabaseServerClient();
  const primaryGroupSessions = sessions.filter((session) => session.group_id === primaryGroup.id);
  const currentWeekStart = new Date();
  const currentDay = currentWeekStart.getDay();
  const offsetToMonday = currentDay === 0 ? 6 : currentDay - 1;
  currentWeekStart.setDate(currentWeekStart.getDate() - offsetToMonday);
  currentWeekStart.setHours(0, 0, 0, 0);

  const weeklySessions = primaryGroupSessions.filter((session) => {
    if (session.status === 'cancelled') return false;
    return new Date(session.scheduled_at).getTime() >= currentWeekStart.getTime();
  });

  const weeklySessionIds = weeklySessions.map((session) => session.id);
  const [{ data: schedules }, { data: weeklyQuestions }] = await Promise.all([
    supabase
      .schema('public')
      .from('group_weekly_schedules')
      .select('id, weekday, start_time, end_time, question_goal')
      .eq('group_id', primaryGroup.id)
      .order('weekday', { ascending: true })
      .order('start_time', { ascending: true }),
    weeklySessionIds.length > 0
      ? supabase.schema('public').from('questions').select('id, session_id').in('session_id', weeklySessionIds)
      : Promise.resolve({ data: [] as { id: string; session_id: string }[] }),
  ]);

  const safeWeeklyQuestions = weeklyQuestions ?? [];
  const weeklyQuestionIds = safeWeeklyQuestions.map((question) => question.id);
  const { data: weeklyAnswers } =
    weeklyQuestionIds.length > 0
      ? await supabase
          .schema('public')
          .from('answers')
          .select('question_id')
          .in('question_id', weeklyQuestionIds)
      : { data: [] as { question_id: string }[] };

  const weeklyTargetQuestions = (schedules ?? []).reduce((sum, schedule) => sum + schedule.question_goal, 0);
  const qualifyingGroupSize = primaryGroup.memberCount >= 2 && primaryGroup.memberCount <= 5;
  const questionAnswerCounts = new Map<string, number>();
  for (const answer of weeklyAnswers ?? []) {
    questionAnswerCounts.set(answer.question_id, (questionAnswerCounts.get(answer.question_id) ?? 0) + 1);
  }

  const weeklyCompletedQuestions = qualifyingGroupSize
    ? safeWeeklyQuestions.filter((question) => (questionAnswerCounts.get(question.id) ?? 0) >= primaryGroup.memberCount).length
    : 0;

  return {
    group: primaryGroup,
    schedules: sortWeeklySchedules(schedules ?? []),
    weeklyProgressPercentage:
      weeklyTargetQuestions > 0 ? Math.min(100, Math.round((weeklyCompletedQuestions / weeklyTargetQuestions) * 100)) : 0,
    weeklyCompletedQuestions,
    weeklyTargetQuestions,
    memberPerformance: [],
  } satisfies GroupDashboardData;
}

export const getDashboardSessionsData = cache(async (user: User, activeGroupId?: string | null) => {
  const perf = createPerfTracker(`getDashboardSessionsData:${user.id}`);
  const core = await getDashboardCore(user.id);
  perf.step('dashboard_core_loaded');

  const sessionIds = core.sessions.map((session) => session.id);
  const { questionCountBySession, answeredQuestionCountBySession } = await getDashboardSessionCounts(user.id, sessionIds);
  perf.step('session_rollups_loaded');

  const enrichedSessions = core.sessions.map((session) => ({
    ...session,
    groupName: core.groupsById.get(session.group_id)?.name ?? null,
    answeredQuestionCount: answeredQuestionCountBySession.get(session.id) ?? 0,
    questionCount: questionCountBySession.get(session.id) ?? 0,
  }));

  const primaryGroup =
    (activeGroupId ? core.groups.find((group) => group.id === activeGroupId) : null) ??
    core.groups.find((group) => group.is_founder) ??
    core.groups[0] ??
    null;

  const groupDashboard = await getPrimaryGroupDashboard(primaryGroup, core.sessions);
  perf.step('group_dashboard_loaded');

  const dedupedSessions = dedupeDashboardSessions(enrichedSessions.filter((session) => session.status !== 'cancelled'));
  const nextSession = enrichedSessions.find((session) => session.status !== 'completed' && session.status !== 'cancelled') ?? null;

  perf.done({
    groups: core.groups.length,
    sessions: dedupedSessions.length,
  });

  return {
    groups: core.groups,
    sessions: dedupedSessions,
    activeSessions: core.activeSessions,
    nextSession,
    groupDashboard,
  };
});

export const getDashboardPerformanceData = cache(async (userId: string) => {
  const perf = createPerfTracker(`getDashboardPerformanceData:${userId}`);
  const supabase = createSupabaseServerClient();
  const completedSessionsCount = await getCompletedSessionsCount(userId);
  perf.step('completed_sessions_loaded');

  const [{ data: metricsRow }, { data: dailyCounts }] = await Promise.all([
    supabase
      .schema('public')
      .from('dashboard_user_answer_metrics')
      .select('answered_count, correct_count, incorrect_count, average_confidence_score')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .schema('public')
      .from('dashboard_user_answer_daily_counts')
      .select('answered_on, answer_count')
      .eq('user_id', userId),
  ]);
  perf.step('analytics_views_loaded');

  const answeredCount = metricsRow?.answered_count ?? 0;
  const correctCount = metricsRow?.correct_count ?? 0;
  const incorrectCount = metricsRow?.incorrect_count ?? 0;
  const averageConfidence =
    answeredCount > 0 && metricsRow?.average_confidence_score
      ? scoreToConfidenceLevel(metricsRow.average_confidence_score)
      : null;

  const heatmap = computeHeatmapFromDailyCounts(dailyCounts ?? []);
  const profileAnalytics = await getProfileAnalytics(userId, answeredCount, heatmap);
  perf.done({
    answeredCount,
    completedSessionsCount,
  });

  return {
    metrics: {
      answeredCount,
      completedSessionsCount,
      successRate: answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : null,
      errorRate: answeredCount > 0 ? Math.round((incorrectCount / answeredCount) * 100) : null,
      averageConfidence,
      leagueProgress: Math.min(100, Math.round((answeredCount / 300) * 100)),
    },
    profileAnalytics,
  };
});

export const getUserScheduleData = cache(async (userId: string) => getUserSchedule(userId));

export const getDashboardData = cache(
  async (
    user: User,
    includeGroupDashboard = false,
    includeProfileAnalytics = false,
    _includeMemberPerformance = includeGroupDashboard,
    includeUserSchedule = true,
    activeGroupId?: string | null,
  ) => {
    void _includeMemberPerformance;
    const [sessionsData, performanceData, userSchedule] = await Promise.all([
      includeGroupDashboard ? getDashboardSessionsData(user, activeGroupId) : null,
      includeProfileAnalytics ? getDashboardPerformanceData(user.id) : null,
      includeUserSchedule ? getUserScheduleData(user.id) : null,
    ]);

    return {
      groups: sessionsData?.groups ?? [],
      pendingInvites: [] as PendingInvite[],
      userSchedule,
      metrics:
        performanceData?.metrics ?? {
          answeredCount: 0,
          completedSessionsCount: 0,
          successRate: null,
          errorRate: null,
          averageConfidence: null,
          leagueProgress: 0,
        },
      profileAnalytics: performanceData?.profileAnalytics ?? buildEmptyProfileAnalytics(),
      sessions: sessionsData?.sessions ?? [],
      activeSessions: sessionsData?.activeSessions ?? [],
      nextSession: sessionsData?.nextSession ?? null,
      groupDashboard:
        sessionsData?.groupDashboard ??
        ({
          group: null,
          schedules: [],
          weeklyProgressPercentage: 0,
          weeklyCompletedQuestions: 0,
          weeklyTargetQuestions: 0,
          memberPerformance: [],
        } satisfies GroupDashboardData),
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
      .select('id, name, invite_code, created_by, created_at, meeting_link, max_members')
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
  const safeMembers = members ?? [];
  const safeSessions = sessions ?? [];
  const safeWeeklySchedules = sortWeeklySchedules(weeklySchedules ?? []);
  const userIds = [...new Set([...safeMembers.map((member) => member.user_id), ...safeInvites.map((invite) => invite.invited_by)])];
  const usersMap = await getUsersMap(supabase, userIds);

  const sessionIds = safeSessions.map((session) => session.id);
  const currentWeekStart = new Date();
  const currentDay = currentWeekStart.getDay();
  const offsetToMonday = currentDay === 0 ? 6 : currentDay - 1;
  currentWeekStart.setDate(currentWeekStart.getDate() - offsetToMonday);
  currentWeekStart.setHours(0, 0, 0, 0);

  const weeklySessions = safeSessions.filter((session) => {
    if (session.status === 'cancelled') return false;
    return new Date(session.scheduled_at).getTime() >= currentWeekStart.getTime();
  });
  const weeklySessionIds = new Set(weeklySessions.map((session) => session.id));

  const { data: groupQuestions } =
    sessionIds.length > 0
      ? await supabase
          .schema('public')
          .from('questions')
          .select('id, session_id')
          .in('session_id', sessionIds)
      : { data: [] as { id: string; session_id: string }[] };
  const groupQuestionIds = (groupQuestions ?? []).map((question) => question.id);

  const { data: groupAnswers } =
    groupQuestionIds.length > 0
      ? await supabase
          .schema('public')
          .from('answers')
          .select('question_id, user_id')
          .in('question_id', groupQuestionIds)
      : { data: [] as { question_id: string; user_id: string }[] };

  const questionSessionById = new Map((groupQuestions ?? []).map((question) => [question.id, question.session_id]));
  const weeklyQuestionIds = new Set(
    (groupQuestions ?? [])
      .filter((question) => weeklySessionIds.has(question.session_id))
      .map((question) => question.id),
  );
  const weeklyAnswers = (groupAnswers ?? []).filter((answer) => weeklyQuestionIds.has(answer.question_id));
  const questionAnswerCounts = new Map<string, number>();
  for (const answer of weeklyAnswers) {
    questionAnswerCounts.set(answer.question_id, (questionAnswerCounts.get(answer.question_id) ?? 0) + 1);
  }

  const weeklyTargetQuestions = safeWeeklySchedules.reduce((sum, schedule) => sum + schedule.question_goal, 0);
  const qualifyingGroupSize = safeMembers.length >= 2 && safeMembers.length <= 5;
  const weeklyCompletedQuestions = qualifyingGroupSize
    ? (groupQuestions ?? []).filter(
        (question) => weeklyQuestionIds.has(question.id) && (questionAnswerCounts.get(question.id) ?? 0) >= safeMembers.length,
      ).length
    : 0;

  const answersByUser = new Map<string, { questionIds: Set<string>; sessionIds: Set<string> }>();
  for (const answer of groupAnswers ?? []) {
    const current = answersByUser.get(answer.user_id) ?? { questionIds: new Set<string>(), sessionIds: new Set<string>() };
    current.questionIds.add(answer.question_id);
    const sessionId = questionSessionById.get(answer.question_id);
    if (sessionId) current.sessionIds.add(sessionId);
    answersByUser.set(answer.user_id, current);
  }

  const sessionsById = new Map(safeSessions.map((session) => [session.id, session]));
  const totalTrackableSessions = safeSessions.filter((session) => session.status !== 'cancelled').length;
  const totalTrackableQuestions = groupQuestionIds.length;
  const memberPerformance = safeMembers.map((member) => {
    const profile = usersMap.get(member.user_id);
    const name = profile?.display_name ?? profile?.email ?? user.email ?? 'Member';
    const answerStats = answersByUser.get(member.user_id);
    const totalAnswers = answerStats?.questionIds.size ?? 0;
    const activeWeekKeys = new Set(
      [...(answerStats?.sessionIds ?? [])].map((sessionId) => {
        const scheduledAt = sessionsById.get(sessionId)?.scheduled_at;
        return scheduledAt ? toIsoDay(startOfWeek(new Date(scheduledAt))) : sessionId;
      }),
    );

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
      presenceRate: totalTrackableSessions > 0 ? Math.round(((answerStats?.sessionIds.size ?? 0) / totalTrackableSessions) * 100) : 0,
      completionRate: totalTrackableQuestions > 0 ? Math.round(((answerStats?.questionIds.size ?? 0) / totalTrackableQuestions) * 100) : 0,
      averageWeeklyQuestions: Math.round(totalAnswers / Math.max(1, activeWeekKeys.size)),
      totalAnswers,
      status: (answerStats?.sessionIds.size ?? 0) === 0 && (answerStats?.questionIds.size ?? 0) === 0 ? 'setup' : 'active',
    };
  });

  const currentCaptainId =
    safeSessions.find((session) => session.status === 'active')?.leader_id ??
    safeSessions.find((session) => session.status === 'scheduled')?.leader_id ??
    null;

  perf.done({
    members: safeMembers.length,
    invites: safeInvites.length,
    sessions: safeSessions.length,
    weeklySchedules: safeWeeklySchedules.length,
  });

  return {
    group: group
      ? {
          ...group,
          is_founder: membership.is_founder,
          memberCount: safeMembers.length,
        }
      : null,
    membership,
    members: safeMembers.map((member) => ({
      ...member,
      profile: usersMap.get(member.user_id) ?? null,
    })),
    invites: safeInvites.map((invite) => ({
      ...invite,
      invitedByName: usersMap.get(invite.invited_by)?.display_name ?? usersMap.get(invite.invited_by)?.email ?? null,
    })),
    sessions: safeSessions,
    weeklySchedules: safeWeeklySchedules,
    weeklyCompletedQuestions,
    weeklyTargetQuestions,
    weeklyProgressPercentage:
      weeklyTargetQuestions > 0 ? Math.min(100, Math.round((weeklyCompletedQuestions / weeklyTargetQuestions) * 100)) : 0,
    memberPerformance,
    currentCaptainId,
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
