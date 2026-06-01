import { APP_EVENTS } from '@/lib/logging/events';
import { metadataHasSensitiveKeys } from '@/lib/privacy/log-metadata';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/lib/supabase/types';

export type OpsRange = '24h' | '7d' | '14d' | '30d';

type CountResult = { count: number | null };
type LogRow = {
  id: string;
  event_name: string;
  level: 'info' | 'warn' | 'error';
  created_at: string;
  metadata: Json;
};
type StateEventRow = {
  event_type:
    | 'answer_submitted'
    | 'answer_timed_out'
    | 'question_advanced'
    | 'session_completed';
  created_at: string;
};
type SessionRow = {
  id: string;
  status: 'scheduled' | 'active' | 'incomplete' | 'completed' | 'cancelled';
  scheduled_at: string;
};
type UserRow = {
  created_at: string;
  questions_answered: number;
  user_tier: 'trial' | 'locked' | 'active' | 'dormant';
};

export type OpsDashboardRangeData = {
  label: string;
  status: {
    tone: 'ok' | 'warn' | 'crit';
    label: string;
    summary: string;
  };
  kpis: Array<{
    label: string;
    value: string;
    unit: string;
    tone: 'ok' | 'warn' | 'crit';
    delta: string;
    spark: number[];
  }>;
  volumeSeries: Array<{
    label: string;
    showLabel: boolean;
    founderSignups: number;
    inviteeSignups: number;
    signins: number;
  }>;
  incidents: Array<{
    id: string;
    severity: 'info' | 'warn' | 'crit';
    title: string;
    message: string;
    meta: string;
    status: 'monitoring' | 'resolved';
  }>;
  sessionFunnel: Array<{
    tag: string;
    label: string;
    count: number;
    conversion: number | null;
    incidents: number;
  }>;
  activationFunnel: Array<{ label: string; count: number }>;
  subscriptionFunnel: Array<{
    label: string;
    count: number;
    tone: 'warn' | 'ok' | 'crit';
  }>;
  privacyControls: Array<{
    id: string;
    status: 'ok' | 'review' | 'crit';
    title: string;
    detail: string;
    tag: string;
  }>;
};

export type OpsDashboardData = {
  generatedAt: string;
  defaultRange: OpsRange;
  ranges: Record<OpsRange, OpsDashboardRangeData>;
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

function daysAgo(days: number, from = new Date()) {
  const date = new Date(from);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function inWindow(value: string, start: string, end?: string) {
  return value >= start && (!end || value < end);
}

function pct(current: number, base: number) {
  if (base <= 0) return 0;
  return Math.round((current / base) * 1000) / 10;
}

function formatDelta(current: number, previous: number) {
  const delta = current - previous;
  if (delta === 0) return '0 vs prev';
  return `${delta > 0 ? '+' : ''}${delta} vs prev`;
}

async function countQuery(query: PromiseLike<CountResult>) {
  const result = await query;
  return result.count ?? 0;
}

function bucketLabel(date: Date, range: OpsRange) {
  if (range === '24h') {
    return new Intl.DateTimeFormat('en', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }).format(date);
  }

  if (range === '30d') {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: '2-digit',
      timeZone: 'UTC',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(date);
}

function buildVolumeSeries(logs: LogRow[], range: OpsRange, now: Date) {
  const buckets = range === '24h' ? 8 : RANGE_DAYS[range];
  const stepMs =
    range === '24h'
      ? (24 * 60 * 60 * 1000) / buckets
      : 24 * 60 * 60 * 1000;
  const startMs = now.getTime() - stepMs * buckets;

  return Array.from({ length: buckets }, (_, index) => {
    const bucketStart = new Date(startMs + index * stepMs);
    const bucketEnd = new Date(startMs + (index + 1) * stepMs);
    const bucketLogs = logs.filter((log) =>
      inWindow(log.created_at, bucketStart.toISOString(), bucketEnd.toISOString()),
    );

    return {
      label: bucketLabel(bucketStart, range),
      showLabel: range === '24h' || range === '7d',
      founderSignups: bucketLogs.filter(
        (log) => log.event_name === APP_EVENTS.groupCreated,
      ).length,
      inviteeSignups: bucketLogs.filter(
        (log) =>
          log.event_name === APP_EVENTS.groupInviteAccepted ||
          log.event_name === APP_EVENTS.groupJoined,
      ).length,
      signins: bucketLogs.filter(
        (log) => log.event_name === APP_EVENTS.authCallbackSucceeded,
      ).length,
    };
  });
}

function incidentTitle(eventName: string) {
  return eventName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function buildStatus(errors: number, warnings: number): OpsDashboardRangeData['status'] {
  if (errors > 0) {
    return {
      tone: 'crit',
      label: 'incident monitoring',
      summary: `${errors} error event${errors > 1 ? 's' : ''} in selected window`,
    };
  }

  if (warnings > 0) {
    return {
      tone: 'warn',
      label: 'degraded signals',
      summary: `${warnings} warning event${warnings > 1 ? 's' : ''} in selected window`,
    };
  }

  return {
    tone: 'ok',
    label: 'all systems nominal',
    summary: 'No warning or error events in selected window',
  };
}

function buildPrivacyControls(logs: LogRow[]): OpsDashboardRangeData['privacyControls'] {
  const sensitiveMetadataCount = logs.filter((log) =>
    metadataHasSensitiveKeys(log.metadata),
  ).length;
  const privateTrackEventCount = logs.filter(
    (log) => log.event_name === APP_EVENTS.personalReflectionSaved,
  ).length;
  const allowlistConfigured = Boolean(
    process.env.OPS_DASHBOARD_ALLOWED_EMAILS?.trim(),
  );
  const retentionDays = Number(process.env.OPS_RAW_EVENT_RETENTION_DAYS);
  const consentMode = process.env.OPS_ANALYTICS_CONSENT_MODE?.trim();

  return [
    {
      id: 'aggregate-only',
      status: 'ok',
      title: 'Aggregate-only display',
      detail: 'This surface renders counts, rates, funnels, and distributions only.',
      tag: 'Princ. 4',
    },
    {
      id: 'no-direct-identifiers',
      status: sensitiveMetadataCount > 0 ? 'crit' : 'ok',
      title: 'No direct identifiers',
      detail:
        sensitiveMetadataCount > 0
          ? `${sensitiveMetadataCount} existing log metadata payloads contain sensitive-looking keys. New logs are sanitized at write time.`
          : 'Recent log metadata has no sensitive keys in the selected scan.',
      tag: 'Safeguards',
    },
    {
      id: 'private-track',
      status: privateTrackEventCount > 0 ? 'crit' : 'ok',
      title: 'Private track excluded',
      detail:
        privateTrackEventCount > 0
          ? `${privateTrackEventCount} private reflection events appeared in ops logs.`
          : 'No personal reflection events are included in the ops analytics window.',
      tag: 'Limit use',
    },
    {
      id: 'access-control',
      status: allowlistConfigured ? 'ok' : 'review',
      title: 'Role-gated + access controlled',
      detail: allowlistConfigured
        ? 'OPS_DASHBOARD_ALLOWED_EMAILS is configured for this deployment.'
        : 'Authenticated users can access Ops until OPS_DASHBOARD_ALLOWED_EMAILS is configured.',
      tag: 'Accountab.',
    },
    {
      id: 'retention',
      status: Number.isFinite(retentionDays) && retentionDays > 0 ? 'ok' : 'review',
      title: 'Retention windows',
      detail:
        Number.isFinite(retentionDays) && retentionDays > 0
          ? `Raw ops event retention is configured for ${retentionDays} days.`
          : 'Set OPS_RAW_EVENT_RETENTION_DAYS to document the raw event retention window.',
      tag: 'Retention',
    },
    {
      id: 'consent',
      status: consentMode ? 'ok' : 'review',
      title: 'Consent basis',
      detail: consentMode
        ? `Analytics consent mode configured: ${consentMode}.`
        : 'Set OPS_ANALYTICS_CONSENT_MODE after privacy/legal sign-off.',
      tag: 'Consent',
    },
  ];
}

function buildRangeData({
  range,
  now,
  logs,
  sessions,
  users,
  stateEvents,
  activeUsers,
  lockedUsers,
}: {
  range: OpsRange;
  now: Date;
  logs: LogRow[];
  sessions: SessionRow[];
  users: UserRow[];
  stateEvents: StateEventRow[];
  activeUsers: number;
  lockedUsers: number;
}): OpsDashboardRangeData {
  const days = RANGE_DAYS[range];
  const start = daysAgo(days, now);
  const previousStart = daysAgo(days * 2, now);
  const windowLogs = logs.filter((log) => inWindow(log.created_at, start));
  const previousLogs = logs.filter((log) =>
    inWindow(log.created_at, previousStart, start),
  );
  const windowSessions = sessions.filter((session) =>
    inWindow(session.scheduled_at, start),
  );
  const previousSessions = sessions.filter((session) =>
    inWindow(session.scheduled_at, previousStart, start),
  );
  const windowUsers = users.filter((user) => inWindow(user.created_at, start));
  const windowStateEvents = stateEvents.filter((event) =>
    inWindow(event.created_at, start),
  );
  const errors = windowLogs.filter((log) => log.level === 'error').length;
  const warnings = windowLogs.filter((log) => log.level === 'warn').length;
  const previousErrors = previousLogs.filter((log) => log.level === 'error').length;
  const completedSessions = windowSessions.filter(
    (session) => session.status === 'completed',
  ).length;
  const activeSessions = sessions.filter((session) => session.status === 'active').length;
  const answerEvents = windowStateEvents.filter(
    (event) => event.event_type === 'answer_submitted',
  ).length;
  const syncEvents = windowStateEvents.filter(
    (event) => event.event_type === 'question_advanced',
  ).length;
  const revealEvents = windowLogs.filter(
    (log) => log.event_name === APP_EVENTS.answerRevealed,
  ).length;
  const reconnectSignals = windowLogs.filter(
    (log) =>
      log.event_name === APP_EVENTS.sessionJoinedByCode ||
      log.event_name === APP_EVENTS.authCallbackSucceeded,
  ).length;
  const warningUsers = users.filter(
    (user) => user.questions_answered >= 85 && user.questions_answered < 100,
  ).length;
  const reached100Users = users.filter((user) => user.questions_answered >= 100).length;
  const subscribedAfter100 = users.filter(
    (user) => user.questions_answered >= 100 && user.user_tier === 'active',
  ).length;
  const completionRate = pct(completedSessions, Math.max(windowSessions.length, 1));
  const errorRate =
    windowSessions.length > 0
      ? Math.round((errors / windowSessions.length) * 1000 * 10) / 10
      : 0;
  const status = buildStatus(errors, warnings);

  const incidents = windowLogs
    .filter((log) => log.level === 'error' || log.level === 'warn')
    .slice(0, 4)
    .map((log) => ({
      id: log.id,
      severity: log.level === 'error' ? ('crit' as const) : ('warn' as const),
      title: incidentTitle(log.event_name),
      message:
        log.level === 'error'
          ? 'Error-level application event detected in the monitored window.'
          : 'Warning-level application event detected and tracked.',
      meta: new Intl.DateTimeFormat('en', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      }).format(new Date(log.created_at)),
      status: log.level === 'error' ? ('monitoring' as const) : ('resolved' as const),
    }));

  const sessionFunnel = [
    { tag: 'SETUP', label: 'Session scheduled', count: windowSessions.length, incidents: 0 },
    {
      tag: 'LOBBY',
      label: 'Session started',
      count:
        windowLogs.filter((log) => log.event_name === APP_EVENTS.sessionStarted).length +
        activeSessions,
      incidents: warnings > 0 ? 1 : 0,
    },
    { tag: 'PH 1', label: 'Silent sprint answered', count: answerEvents, incidents: 0 },
    { tag: 'PH 2', label: 'Synchronisation', count: syncEvents, incidents: errors > 0 ? 1 : 0 },
    { tag: 'PH 3', label: 'Review reached', count: revealEvents, incidents: 0 },
    { tag: 'PH 4', label: 'Session completed', count: completedSessions, incidents: 0 },
  ].map((row, index, rows) => ({
    ...row,
    conversion:
      index === 0 ? null : pct(row.count, Math.max(rows[index - 1]?.count ?? 0, 1)),
  }));

  return {
    label: RANGE_LABELS[range],
    status,
    kpis: [
      {
        label: 'Session completion',
        value: String(completionRate),
        unit: '%',
        tone: completionRate >= 85 ? 'ok' : completionRate >= 60 ? 'warn' : 'crit',
        delta: formatDelta(windowSessions.length, previousSessions.length),
        spark: [previousSessions.length, windowSessions.length, completedSessions, activeSessions],
      },
      {
        label: 'Realtime sync events',
        value: String(syncEvents),
        unit: '',
        tone: errors > 0 ? 'warn' : 'ok',
        delta: `${answerEvents} answer events`,
        spark: [answerEvents, syncEvents, revealEvents, completedSessions],
      },
      {
        label: 'Error rate',
        value: String(errorRate),
        unit: '/1k sess.',
        tone: errorRate > 5 ? 'crit' : errorRate > 0 ? 'warn' : 'ok',
        delta: formatDelta(errors, previousErrors),
        spark: [previousErrors, errors, warnings, windowLogs.length],
      },
      {
        label: 'Reconnect success',
        value: String(reconnectSignals),
        unit: '',
        tone: 'ok',
        delta: 'auth + code join',
        spark: [windowUsers.length, reconnectSignals, activeUsers],
      },
      {
        label: 'Active users',
        value: String(activeUsers),
        unit: '',
        tone: activeUsers > 0 ? 'ok' : 'warn',
        delta: `${lockedUsers} locked`,
        spark: [warningUsers, reached100Users, subscribedAfter100, activeUsers],
      },
    ],
    volumeSeries: buildVolumeSeries(windowLogs, range, now),
    incidents:
      incidents.length > 0
        ? incidents
        : [
            {
              id: `nominal-${range}`,
              severity: 'info',
              title: 'No tracked incidents',
              message: 'No warn/error application events were recorded in this window.',
              meta: RANGE_LABELS[range],
              status: 'resolved',
            },
          ],
    sessionFunnel,
    activationFunnel: [
      {
        label: 'Sign-up started',
        count:
          windowUsers.length +
          windowLogs.filter((log) => log.event_name === APP_EVENTS.authCallbackSucceeded)
            .length,
      },
      { label: 'Account created', count: windowUsers.length },
      {
        label: 'Group ready',
        count: windowLogs.filter((log) => log.event_name === APP_EVENTS.groupCreated).length,
      },
      { label: 'Return sign-in', count: reconnectSignals },
      {
        label: 'First session joined',
        count: windowLogs.filter((log) => log.event_name === APP_EVENTS.sessionJoinedByCode)
          .length,
      },
    ],
    subscriptionFunnel: [
      { label: 'Hit 85 warning', count: warningUsers, tone: 'warn' },
      { label: 'Reached 100', count: reached100Users, tone: 'warn' },
      { label: 'Subscribed -> Active', count: subscribedAfter100, tone: 'ok' },
      { label: 'Locked (unpaid)', count: lockedUsers, tone: 'crit' },
    ],
    privacyControls: buildPrivacyControls(windowLogs),
  };
}

export async function getOpsDashboardData(): Promise<OpsDashboardData> {
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const thirtyDaysAgo = daysAgo(30, now);
  const sixtyDaysAgo = daysAgo(60, now);

  const [
    activeUsers,
    lockedUsers,
    appLogsResult,
    sessionsResult,
    usersResult,
    stateEventsResult,
  ] = await Promise.all([
    countQuery(
      admin
        .schema('public')
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('user_tier', 'active'),
    ),
    countQuery(
      admin
        .schema('public')
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('user_tier', 'locked'),
    ),
    admin
      .schema('public')
      .from('app_logs')
      .select('id,event_name,level,created_at,metadata')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(2000),
    admin
      .schema('public')
      .from('sessions')
      .select('id,status,scheduled_at')
      .gte('scheduled_at', sixtyDaysAgo)
      .limit(2000),
    admin
      .schema('public')
      .from('users')
      .select('created_at,questions_answered,user_tier')
      .limit(5000),
    admin
      .schema('public')
      .from('session_state_events')
      .select('event_type,created_at')
      .gte('created_at', thirtyDaysAgo)
      .limit(5000),
  ]);

  const logs = (appLogsResult.data ?? []) as LogRow[];
  const sessions = (sessionsResult.data ?? []) as SessionRow[];
  const users = (usersResult.data ?? []) as UserRow[];
  const stateEvents = (stateEventsResult.data ?? []) as StateEventRow[];

  return {
    generatedAt: now.toISOString(),
    defaultRange: '7d',
    ranges: {
      '24h': buildRangeData({
        range: '24h',
        now,
        logs,
        sessions,
        users,
        stateEvents,
        activeUsers,
        lockedUsers,
      }),
      '7d': buildRangeData({
        range: '7d',
        now,
        logs,
        sessions,
        users,
        stateEvents,
        activeUsers,
        lockedUsers,
      }),
      '14d': buildRangeData({
        range: '14d',
        now,
        logs,
        sessions,
        users,
        stateEvents,
        activeUsers,
        lockedUsers,
      }),
      '30d': buildRangeData({
        range: '30d',
        now,
        logs,
        sessions,
        users,
        stateEvents,
        activeUsers,
        lockedUsers,
      }),
    },
  };
}
