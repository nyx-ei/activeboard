import { cache } from 'react';

import type { User } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TRIAL_QUESTION_LIMIT } from '@/lib/billing/user-tier';
import { computeAnswerDistribution } from '@/lib/demo/distribution';
import { confidenceToScore, scoreToConfidenceLevel, type ConfidenceLevel } from '@/lib/demo/confidence';
import { createPerfTracker } from '@/lib/observability/perf';
import { getAvailabilitySlotCount, normalizeAvailabilityGrid } from '@/lib/schedule/availability';
import {
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

type SessionConfidenceBreakdownItem = {
  sessionId: string;
  sessionName: string;
  scheduledAt: string;
  low: number;
  medium: number;
  high: number;
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

type MaterializedProfileAnalyticsRow = {
  heatmap_data: unknown;
  physician_activity_accuracy: unknown;
  dimension_of_care_accuracy: unknown;
  blueprint_grid: unknown;
  confidence_calibration: unknown;
  error_type_breakdown: unknown;
  weekly_trend: unknown;
};

type MaterializedSessionConfidenceBreakdownRow = {
  session_id: string | null;
  session_name: string | null;
  scheduled_at: string | null;
  low_count: number | null;
  medium_count: number | null;
  high_count: number | null;
};

type GroupMemberStatsRow = {
  group_id: string | null;
  member_count: number | null;
  founder_user_id: string | null;
};

type DashboardUserGroupRow = {
  group_id: string | null;
  is_founder: boolean | null;
  name: string | null;
  member_count: number | null;
};

type DashboardUserSessionRow = {
  id: string | null;
  group_id: string | null;
  name: string | null;
  scheduled_at: string | null;
  share_code: string | null;
  status: DashboardSession['status'] | null;
  timer_mode: DashboardSession['timer_mode'] | null;
  timer_seconds: number | null;
  leader_id: string | null;
  question_goal: number | null;
  question_count: number | null;
  answered_question_count: number | null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseArray<T>(value: unknown, mapper: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => mapper(item))
    .filter((item): item is T => item !== null);
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function parseHeatmapDay(value: unknown): HeatmapDay | null {
  if (!isRecord(value)) return null;

  const date = readString(value.date);
  const count = readNumber(value.count);
  const intensity = readNumber(value.intensity);

  if (!date || count === null || intensity === null || intensity < 0 || intensity > 4) {
    return null;
  }

  return {
    date,
    count,
    intensity: intensity as HeatmapDay['intensity'],
  };
}

function parseCategoryAccuracyItem<TCategory extends string>(
  value: unknown,
  key: 'category',
): CategoryAccuracyItem<TCategory> | null {
  if (!isRecord(value)) return null;

  const category = readString(value[key]);
  const total = readNumber(value.total);
  const correct = readNumber(value.correct);
  const accuracy = readNumber(value.accuracy);

  if (!category || total === null || correct === null || accuracy === null) {
    return null;
  }

  return {
    category: category as TCategory,
    total,
    correct,
    accuracy,
  };
}

function parseBlueprintGridCell(value: unknown): BlueprintGridCell | null {
  if (!isRecord(value)) return null;

  const physicianActivity = readString(value.physicianActivity);
  const dimensionOfCare = readString(value.dimensionOfCare);
  const total = readNumber(value.total);
  const correct = readNumber(value.correct);
  const accuracyValue = value.accuracy;
  const accuracy = accuracyValue === null ? null : readNumber(accuracyValue);

  if (!physicianActivity || !dimensionOfCare || total === null || correct === null || accuracy === undefined) {
    return null;
  }

  return {
    physicianActivity: physicianActivity as PhysicianActivity,
    dimensionOfCare: dimensionOfCare as DimensionOfCare,
    total,
    correct,
    accuracy,
  };
}

function parseConfidenceCalibrationItem(value: unknown): ConfidenceCalibrationItem | null {
  if (!isRecord(value)) return null;

  const confidence = readString(value.confidence);
  const total = readNumber(value.total);
  const correct = readNumber(value.correct);
  const accuracy = readNumber(value.accuracy);

  if (!confidence || total === null || correct === null || accuracy === null) {
    return null;
  }

  return {
    confidence: confidence as ConfidenceLevel,
    total,
    correct,
    accuracy,
  };
}

function parseErrorTypeBreakdownItem(value: unknown): ErrorTypeBreakdownItem | null {
  if (!isRecord(value)) return null;

  const errorType = readString(value.errorType);
  const count = readNumber(value.count);

  if (!errorType || count === null) {
    return null;
  }

  return {
    errorType: errorType as ErrorType,
    count,
  };
}

function parseTrendPoint(value: unknown): TrendPoint | null {
  if (!isRecord(value)) return null;

  const label = readString(value.label);
  const total = readNumber(value.total);
  const accuracyValue = value.accuracy;
  const accuracy = accuracyValue === null ? null : readNumber(accuracyValue);

  if (!label || total === null || accuracy === undefined) {
    return null;
  }

  return {
    label,
    total,
    accuracy,
  };
}

function buildTrialProgress(answeredCount: number): TrialProgressData {
  return {
    current: Math.min(answeredCount, TRIAL_QUESTION_LIMIT),
    total: TRIAL_QUESTION_LIMIT,
    remaining: Math.max(TRIAL_QUESTION_LIMIT - answeredCount, 0),
    warningThreshold: TRIAL_WARNING_THRESHOLD,
    showWarning: answeredCount >= TRIAL_WARNING_THRESHOLD && answeredCount < TRIAL_QUESTION_LIMIT,
    isComplete: answeredCount >= TRIAL_QUESTION_LIMIT,
  };
}

function parseMaterializedProfileAnalytics(
  row: {
    heatmap_data: unknown;
    physician_activity_accuracy: unknown;
    dimension_of_care_accuracy: unknown;
    blueprint_grid: unknown;
    confidence_calibration: unknown;
    error_type_breakdown: unknown;
    weekly_trend: unknown;
  } | null,
  answeredCount: number,
): ProfileAnalyticsData {
  if (!row) {
    return buildEmptyProfileAnalytics(answeredCount, []);
  }

  return {
    trialProgress: buildTrialProgress(answeredCount),
    heatmap: parseArray(row.heatmap_data, parseHeatmapDay),
    physicianActivityAccuracy: parseArray(row.physician_activity_accuracy, (item) =>
      parseCategoryAccuracyItem<PhysicianActivity>(item, 'category'),
    ),
    dimensionOfCareAccuracy: parseArray(row.dimension_of_care_accuracy, (item) =>
      parseCategoryAccuracyItem<DimensionOfCare>(item, 'category'),
    ),
    blueprintGrid: parseArray(row.blueprint_grid, parseBlueprintGridCell),
    confidenceCalibration: parseArray(row.confidence_calibration, parseConfidenceCalibrationItem),
    errorTypeBreakdown: parseArray(row.error_type_breakdown, parseErrorTypeBreakdownItem),
    weeklyTrend: parseArray(row.weekly_trend, parseTrendPoint),
  };
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
  const dashboardViewsClient = supabase as unknown as {
    schema: (schemaName: string) => {
      from: (relation: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            order?: (
              orderColumn: string,
              options: { ascending: boolean },
            ) => Promise<{ data: DashboardUserSessionRow[] | null }>;
          };
        };
      };
    };
  };

  const userGroupsPromise = (dashboardViewsClient
    .schema('public')
    .from('dashboard_user_groups')
    .select('group_id, is_founder, name, member_count') as {
      eq: (column: string, value: string) => Promise<{ data: DashboardUserGroupRow[] | null }>;
    })
    .eq('user_id', userId);

  const dashboardUserSessionsRelation = dashboardViewsClient
    .schema('public')
    .from('dashboard_user_sessions')
    .select(
      'id, group_id, name, scheduled_at, share_code, status, timer_mode, timer_seconds, leader_id, question_goal, question_count, answered_question_count',
    ) as {
    eq: (
      column: string,
      value: string,
    ) => { order: (orderColumn: string, options: { ascending: boolean }) => Promise<{ data: DashboardUserSessionRow[] | null }> };
  };

  const userSessionsPromise = dashboardUserSessionsRelation
    .eq('user_id', userId)
    .order('scheduled_at', { ascending: true })
    .then((result) => result.data ?? []);

  const [userGroups, userSessions] = await Promise.all([userGroupsPromise, userSessionsPromise]);

  if ((userGroups.data ?? []).length === 0) {
    return {
      groups: [] as DashboardGroup[],
      groupsById: new Map<string, { name: string }>(),
      sessions: [] as DashboardSession[],
      activeSessions: [] as DashboardSession[],
    };
  }

  const groupsById = new Map<string, { name: string }>();
  const groups: DashboardGroup[] = [];

  for (const row of userGroups.data ?? []) {
    if (!row.group_id || !row.name) {
      continue;
    }

    groupsById.set(row.group_id, { name: row.name });
    groups.push({
      id: row.group_id,
      name: row.name,
      is_founder: Boolean(row.is_founder),
      memberCount: row.member_count ?? 0,
      nextSession: null,
    });
  }

  const sessions: DashboardSession[] = [];
  for (const row of userSessions) {
    if (
      !row.id ||
      !row.group_id ||
      !row.scheduled_at ||
      !row.share_code ||
      !row.status ||
      !row.timer_mode ||
      typeof row.timer_seconds !== 'number' ||
      typeof row.question_goal !== 'number'
    ) {
      continue;
    }

    if (row.status === 'cancelled') {
      continue;
    }

    sessions.push({
      id: row.id,
      group_id: row.group_id,
      name: row.name,
      scheduled_at: row.scheduled_at,
      share_code: row.share_code,
      status: row.status,
      timer_mode: row.timer_mode,
      timer_seconds: row.timer_seconds,
      leader_id: row.leader_id,
      question_goal: row.question_goal,
      questionCount: row.question_count ?? 0,
      answeredQuestionCount: row.answered_question_count ?? 0,
    });
  }

  const upcomingByGroup = new Map(
    sessions
      .filter((session) => session.status !== 'completed')
      .map((session) => [session.group_id, session]),
  );

  for (const group of groups) {
    group.nextSession = upcomingByGroup.get(group.id) ?? null;
  }

  return {
    groups,
    groupsById,
    sessions,
    activeSessions: sessions.filter((session) => session.status === 'active'),
  };
}

async function getCompletedSessionsCount(userId: string) {
  const supabase = createSupabaseServerClient();
  const { count } = await (supabase as unknown as {
    schema: (schemaName: string) => {
      from: (relation: string) => {
        select: (columns: string, options: { count: 'exact'; head: true }) => {
          eq: (column: string, value: string) => {
            eq: (statusColumn: string, statusValue: string) => Promise<{ count: number | null }>;
          };
        };
      };
    };
  })
    .schema('public')
    .from('dashboard_user_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed');

  return count ?? 0;
}

export const getDashboardSessionsData = cache(async (user: User, activeGroupId?: string | null) => {
  const perf = createPerfTracker(`getDashboardSessionsData:${user.id}`, {
    userId: user.id,
    minDurationMs: 250,
    metadata: {
      trace_group: 'dashboard',
      trace_kind: 'sessions',
    },
  });
  const core = await getDashboardCore(user.id);
  perf.step('dashboard_core_loaded');

  void activeGroupId;
  perf.step('session_rollups_loaded');

  const enrichedSessions = core.sessions.map((session) => ({
    ...session,
    groupName: core.groupsById.get(session.group_id)?.name ?? null,
  }));

  const dedupedSessions = dedupeDashboardSessions(enrichedSessions);
  const nextSession = enrichedSessions.find((session) => session.status !== 'completed') ?? null;

  perf.done({
    groups: core.groups.length,
    sessions: dedupedSessions.length,
  });

  return {
    groups: core.groups,
    sessions: dedupedSessions,
    activeSessions: core.activeSessions,
    nextSession,
    groupDashboard: {
      group: null,
      schedules: [],
      weeklyProgressPercentage: 0,
      weeklyCompletedQuestions: 0,
      weeklyTargetQuestions: 0,
      memberPerformance: [],
    } satisfies GroupDashboardData,
  };
});

export const getDashboardPerformanceData = cache(async (userId: string) => {
  const perf = createPerfTracker(`getDashboardPerformanceData:${userId}`, {
    userId,
    minDurationMs: 250,
    metadata: {
      trace_group: 'dashboard',
      trace_kind: 'performance',
    },
  });
  const supabase = createSupabaseServerClient();
  const completedSessionsCountPromise = getCompletedSessionsCount(userId);
  const sessionConfidenceBreakdownPromise = (supabase as unknown as {
    schema: (schemaName: string) => {
      from: (relation: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            order: (column: string, options: { ascending: boolean }) => Promise<{
              data: MaterializedSessionConfidenceBreakdownRow[] | null;
            }>;
          };
        };
      };
    };
  })
    .schema('public')
    .from('dashboard_user_session_confidence_breakdown')
    .select('session_id, session_name, scheduled_at, low_count, medium_count, high_count')
    .eq('user_id', userId)
    .order('scheduled_at', { ascending: false });
  const metricsPromise = supabase
    .schema('public')
    .from('dashboard_user_answer_metrics')
    .select('answered_count, correct_count, incorrect_count, average_confidence_score')
    .eq('user_id', userId)
    .maybeSingle();
  const profileAnalyticsPromise = supabase
    .schema('public')
    .from('dashboard_user_profile_analytics')
    .select(
      [
        'heatmap_data',
        'physician_activity_accuracy',
        'dimension_of_care_accuracy',
        'blueprint_grid',
        'confidence_calibration',
        'error_type_breakdown',
        'weekly_trend',
      ].join(', '),
    )
    .eq('user_id', userId)
    .maybeSingle();

  const [completedSessionsCount, sessionConfidenceBreakdownResult, metricsResult, profileAnalyticsResult] = await Promise.all([
    completedSessionsCountPromise,
    sessionConfidenceBreakdownPromise,
    metricsPromise,
    profileAnalyticsPromise,
  ]);
  perf.step('analytics_views_loaded');

  const metricsRow = metricsResult.data;
  const profileAnalyticsRow = profileAnalyticsResult.data as MaterializedProfileAnalyticsRow | null;

  const answeredCount = metricsRow?.answered_count ?? 0;
  const correctCount = metricsRow?.correct_count ?? 0;
  const incorrectCount = metricsRow?.incorrect_count ?? 0;
  const sessionConfidenceBreakdown: SessionConfidenceBreakdownItem[] = [];
  for (const row of sessionConfidenceBreakdownResult.data ?? []) {
    if (
      typeof row.session_id !== 'string' ||
      typeof row.session_name !== 'string' ||
      typeof row.scheduled_at !== 'string'
    ) {
      continue;
    }

    sessionConfidenceBreakdown.push({
      sessionId: row.session_id,
      sessionName: row.session_name,
      scheduledAt: row.scheduled_at,
      low: row.low_count ?? 0,
      medium: row.medium_count ?? 0,
      high: row.high_count ?? 0,
    });
  }
  const averageConfidence =
    answeredCount > 0 && metricsRow?.average_confidence_score
      ? scoreToConfidenceLevel(metricsRow.average_confidence_score)
      : null;

  const profileAnalytics = parseMaterializedProfileAnalytics(profileAnalyticsRow, answeredCount);
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
    sessionConfidenceBreakdown,
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

export const getGroupCoreData = cache(async (groupId: string, user: User) => {
  const perf = createPerfTracker(`getGroupCoreData:${groupId}`, {
    userId: user.id,
    groupId,
    minDurationMs: 250,
    metadata: {
      trace_group: 'groups',
      trace_kind: 'group_core',
    },
  });
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

  const memberStatsPromise = (supabase as unknown as {
    schema: (schemaName: string) => {
      from: (relation: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            maybeSingle: () => Promise<{
              data: GroupMemberStatsRow | null;
            }>;
          };
        };
      };
    };
  })
    .schema('public')
    .from('group_member_stats')
    .select('group_id, member_count, founder_user_id')
    .eq('group_id', groupId)
    .maybeSingle();

  const [{ data: group }, { data: memberStats }, { data: sessions }, { data: weeklySchedules }] = await Promise.all([
    supabase
      .schema('public')
      .from('groups')
      .select('id, name, invite_code, created_by, created_at, meeting_link, max_members')
      .eq('id', groupId)
      .single(),
    memberStatsPromise,
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

  const safeSessions = sessions ?? [];
  const safeWeeklySchedules = sortWeeklySchedules(weeklySchedules ?? []);
  const memberCount = memberStats?.member_count ?? 0;
  const founderCaptainId = memberStats?.founder_user_id ?? null;
  const sessionLeaderId =
    safeSessions.find((session) => session.status === 'active')?.leader_id ??
    safeSessions.find((session) => session.status === 'scheduled')?.leader_id ??
    null;

  perf.done({
    members: memberCount,
    sessions: safeSessions.length,
    weeklySchedules: safeWeeklySchedules.length,
  });

  return {
    group: group
      ? {
          ...group,
          is_founder: membership.is_founder,
          memberCount,
        }
      : null,
    membership,
    sessions: safeSessions,
    weeklySchedules: safeWeeklySchedules,
    currentCaptainId: founderCaptainId ?? sessionLeaderId ?? null,
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
      status: ((answerStats?.sessionIds.size ?? 0) === 0 && (answerStats?.questionIds.size ?? 0) === 0 ? 'setup' : 'active') as
        | 'setup'
        | 'active',
    };
  });

  const founderCaptainId =
    safeMembers.find((member) => member.is_founder)?.user_id ??
    null;
  const sessionLeaderId =
    safeSessions.find((session) => session.status === 'active')?.leader_id ??
    safeSessions.find((session) => session.status === 'scheduled')?.leader_id ??
    null;
  const currentCaptainId = founderCaptainId ?? sessionLeaderId ?? null;

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

async function getSessionShellData(sessionId: string, user: User) {
  const supabase = createSupabaseServerClient();

  const { data: session } = await supabase
    .schema('public')
    .from('sessions')
    .select(
      'id, group_id, name, scheduled_at, share_code, started_at, ended_at, timer_mode, timer_seconds, status, meeting_link, leader_id, question_goal',
    )
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

  const [{ data: group }, { data: members }] = await Promise.all([
    supabase.schema('public').from('groups').select('id, name, invite_code').eq('id', session.group_id).single(),
    supabase.schema('public').from('group_members').select('user_id, is_founder').eq('group_id', session.group_id),
  ]);

  return {
    supabase,
    session,
    group,
    membership,
    members: members ?? [],
  };
}

export const getSessionPageData = cache(
  async (sessionId: string, user: User, stage: string | undefined, questionIndex?: number | null) => {
    const shell = await getSessionShellData(sessionId, user);

    if (!shell?.group) {
      return null;
    }

    const { supabase, session, group, membership, members } = shell;
    const answeredCountPromise = supabase
      .schema('public')
      .from('dashboard_user_session_answer_counts')
      .select('answered_question_count')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .maybeSingle();
    const normalizedStage = stage === 'review' ? 'review' : 'answer';

    if (session.status === 'scheduled') {
      return {
        session,
        group,
        membership,
        members,
        answeredCount: 0,
        resolvedQuestionIndex: 0,
        questionGoal: session.question_goal ?? 10,
        questions: [] as Array<{
          id: string;
          body: string | null;
          options: unknown;
          order_index: number;
          phase: string | null;
          launched_at: string | null;
          answer_deadline_at: string | null;
          correct_option?: string | null;
        }>,
        currentQuestion: null,
        currentQuestionAnswers: [] as Array<{
          id: string;
          user_id: string;
          selected_option: string | null;
          confidence: string | null;
          is_correct: boolean | null;
          answered_at: string | null;
        }>,
        allAnswers: [] as Array<{
          id: string;
          question_id: string;
          user_id: string;
          selected_option: string | null;
          confidence: string | null;
          is_correct: boolean | null;
          answered_at: string | null;
        }>,
      };
    }

    if (normalizedStage === 'review') {
      const [{ data: questions }, answeredCountResult] = await Promise.all([
        supabase
          .schema('public')
          .from('questions')
          .select('id, body, options, order_index, phase, launched_at, answer_deadline_at, correct_option, asked_by')
          .eq('session_id', sessionId)
          .order('order_index', { ascending: true }),
        answeredCountPromise,
      ]);

      const safeQuestions = questions ?? [];
      const safeQuestionIds = safeQuestions.map((question) => question.id);
      const hasExplicitQuestionIndex = Number.isFinite(questionIndex);
      const firstPendingReviewQuestion =
        safeQuestions.find((question) => !question.correct_option) ?? safeQuestions[0] ?? null;
      const resolvedReviewIndex = hasExplicitQuestionIndex
        ? Math.max(0, Math.min(questionIndex as number, Math.max((session.question_goal ?? safeQuestions.length ?? 1) - 1, 0)))
        : (firstPendingReviewQuestion?.order_index ?? 0);
      const safeAllAnswers =
        safeQuestionIds.length > 0
          ? (
              await supabase
                .schema('public')
                .from('answers')
                .select('id, question_id, user_id, selected_option, confidence, is_correct, answered_at')
                .in('question_id', safeQuestionIds)
            ).data ?? []
          : [];

      return {
        session,
        group,
        membership,
        members,
        answeredCount: answeredCountResult.data?.answered_question_count ?? 0,
        resolvedQuestionIndex: resolvedReviewIndex,
        questionGoal: session.question_goal ?? Math.max(safeQuestions.length, 10),
        questions: safeQuestions,
        currentQuestion: null,
        currentQuestionAnswers: [] as Array<{
          id: string;
          user_id: string;
          selected_option: string | null;
          confidence: string | null;
          is_correct: boolean | null;
          answered_at: string | null;
        }>,
        allAnswers: safeAllAnswers,
      };
    }

    const hasExplicitQuestionIndex = Number.isFinite(questionIndex);
    const requestedQuestionIndex = hasExplicitQuestionIndex ? Math.max(0, questionIndex as number) : null;
    let currentQuestion =
      requestedQuestionIndex !== null
        ? (
            await supabase
              .schema('public')
              .from('questions')
              .select('id, body, options, order_index, phase, launched_at, answer_deadline_at')
              .eq('session_id', sessionId)
              .eq('order_index', requestedQuestionIndex)
              .maybeSingle()
          ).data ?? null
        : null;

    if (!currentQuestion) {
      currentQuestion =
        (
          await supabase
            .schema('public')
            .from('questions')
            .select('id, body, options, order_index, phase, launched_at, answer_deadline_at')
            .eq('session_id', sessionId)
            .order('order_index', { ascending: false })
            .limit(1)
            .maybeSingle()
        ).data ?? null;
    }

    const [questionAnswersResult, answeredCountResult] = await Promise.all([
      currentQuestion
        ? supabase
            .schema('public')
            .from('answers')
            .select('id, user_id, selected_option, confidence, is_correct, answered_at')
            .eq('question_id', currentQuestion.id)
        : Promise.resolve({ data: [] as Array<{
            id: string;
            user_id: string;
            selected_option: string | null;
            confidence: string | null;
            is_correct: boolean | null;
            answered_at: string | null;
          }> }),
      answeredCountPromise,
    ]);

    return {
      session,
      group,
      membership,
      members,
      answeredCount: answeredCountResult.data?.answered_question_count ?? 0,
      resolvedQuestionIndex: currentQuestion?.order_index ?? 0,
      questionGoal: session.question_goal ?? Math.max((currentQuestion?.order_index ?? 0) + 1, 10),
      questions: currentQuestion ? [currentQuestion] : [],
      currentQuestion,
      currentQuestionAnswers: questionAnswersResult.data ?? [],
      allAnswers: [] as Array<{
        id: string;
        question_id: string;
        user_id: string;
        selected_option: string | null;
        confidence: string | null;
        is_correct: boolean | null;
        answered_at: string | null;
      }>,
    };
  },
);

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
