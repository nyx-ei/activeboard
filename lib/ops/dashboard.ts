import { APP_EVENTS } from '@/lib/logging/events';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type CountResult = { count: number | null };

export type OpsDashboardData = {
  generatedAt: string;
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
  subscriptionFunnel: Array<{ label: string; count: number; tone: 'warn' | 'ok' | 'crit' }>;
};

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function dayKey(date: string) {
  return new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(date),
  );
}

function pct(current: number, base: number) {
  if (base <= 0) return 0;
  return Math.round((current / base) * 1000) / 10;
}

function formatDelta(current: number, previous: number, suffix = '') {
  const delta = current - previous;
  if (delta === 0) return `0${suffix} vs prev`;
  return `${delta > 0 ? '+' : ''}${delta}${suffix} vs prev`;
}

async function countQuery(query: PromiseLike<CountResult>) {
  const result = await query;
  return result.count ?? 0;
}

function bucketLastSevenDays(rows: Array<{ created_at: string; event_name?: string | null }>) {
  const labels = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (6 - index));
    return dayKey(date.toISOString());
  });

  return labels.map((label) => ({
    label,
    founderSignups: rows.filter(
      (row) => dayKey(row.created_at) === label && row.event_name === APP_EVENTS.groupCreated,
    ).length,
    inviteeSignups: rows.filter(
      (row) =>
        dayKey(row.created_at) === label &&
        (row.event_name === APP_EVENTS.groupInviteAccepted ||
          row.event_name === APP_EVENTS.groupJoined),
    ).length,
    signins: rows.filter(
      (row) =>
        dayKey(row.created_at) === label &&
        row.event_name === APP_EVENTS.authCallbackSucceeded,
    ).length,
  }));
}

function incidentTitle(eventName: string) {
  return eventName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export async function getOpsDashboardData(): Promise<OpsDashboardData> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const last24h = daysAgo(1);
  const last7d = daysAgo(7);
  const previous7dStart = daysAgo(14);
  const [
    sessions7d,
    sessionsPrev7d,
    completed7d,
    activeSessions,
    errors24h,
    errors7d,
    warnings7d,
    users7d,
    activeUsers,
    lockedUsers,
    warningUsers,
    reached100Users,
    subscribedAfter100,
    appLogsResult,
    stateEventsResult,
  ] = await Promise.all([
    countQuery(
      admin
        .schema('public')
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .gte('scheduled_at', last7d),
    ),
    countQuery(
      admin
        .schema('public')
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .gte('scheduled_at', previous7dStart)
        .lt('scheduled_at', last7d),
    ),
    countQuery(
      admin
        .schema('public')
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('scheduled_at', last7d),
    ),
    countQuery(
      admin
        .schema('public')
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
    ),
    countQuery(
      admin
        .schema('public')
        .from('app_logs')
        .select('id', { count: 'exact', head: true })
        .eq('level', 'error')
        .gte('created_at', last24h),
    ),
    countQuery(
      admin
        .schema('public')
        .from('app_logs')
        .select('id', { count: 'exact', head: true })
        .eq('level', 'error')
        .gte('created_at', last7d),
    ),
    countQuery(
      admin
        .schema('public')
        .from('app_logs')
        .select('id', { count: 'exact', head: true })
        .eq('level', 'warn')
        .gte('created_at', last7d),
    ),
    countQuery(
      admin
        .schema('public')
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', last7d),
    ),
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
    countQuery(
      admin
        .schema('public')
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('questions_answered', 85)
        .lt('questions_answered', 100),
    ),
    countQuery(
      admin
        .schema('public')
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('questions_answered', 100),
    ),
    countQuery(
      admin
        .schema('public')
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('questions_answered', 100)
        .eq('user_tier', 'active'),
    ),
    admin
      .schema('public')
      .from('app_logs')
      .select('id,event_name,level,created_at,metadata')
      .gte('created_at', last7d)
      .order('created_at', { ascending: false })
      .limit(500),
    admin
      .schema('public')
      .from('session_state_events')
      .select('event_type,created_at')
      .gte('created_at', last7d)
      .limit(1000),
  ]);

  const logs = appLogsResult.data ?? [];
  const stateEvents = stateEventsResult.data ?? [];
  const errorRate = sessions7d > 0 ? Math.round((errors7d / sessions7d) * 1000 * 10) / 10 : 0;
  const completionRate = pct(completed7d, Math.max(sessions7d, 1));
  const syncEvents = stateEvents.filter((event) => event.event_type === 'question_advanced').length;
  const answerEvents = stateEvents.filter((event) => event.event_type === 'answer_submitted').length;
  const revealEvents = logs.filter((log) => log.event_name === APP_EVENTS.answerRevealed).length;
  const reconnectSignals = logs.filter(
    (log) =>
      log.event_name === APP_EVENTS.sessionJoinedByCode ||
      log.event_name === APP_EVENTS.authCallbackSucceeded,
  ).length;

  const incidents = logs
    .filter((log) => log.level === 'error' || log.level === 'warn')
    .slice(0, 4)
    .map((log) => ({
      id: log.id,
      severity: log.level === 'error' ? ('crit' as const) : ('warn' as const),
      title: incidentTitle(log.event_name),
      message:
        log.level === 'error'
          ? 'Error-level application event detected in the monitored window.'
          : 'Warning-level application event detected and still tracked.',
      meta: new Intl.DateTimeFormat('en', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      }).format(new Date(log.created_at)),
      status: log.level === 'error' ? ('monitoring' as const) : ('resolved' as const),
    }));

  const sessionFunnel = [
    { tag: 'SETUP', label: 'Session scheduled', count: sessions7d, incidents: 0 },
    {
      tag: 'LOBBY',
      label: 'Session started',
      count: logs.filter((log) => log.event_name === APP_EVENTS.sessionStarted).length + activeSessions,
      incidents: warnings7d > 0 ? 1 : 0,
    },
    { tag: 'PH 1', label: 'Silent sprint answered', count: answerEvents, incidents: 0 },
    { tag: 'PH 2', label: 'Synchronisation', count: syncEvents, incidents: errors7d > 0 ? 1 : 0 },
    { tag: 'PH 3', label: 'Review reached', count: revealEvents, incidents: 0 },
    { tag: 'PH 4', label: 'Session completed', count: completed7d, incidents: 0 },
  ].map((row, index, rows) => ({
    ...row,
    conversion: index === 0 ? null : pct(row.count, Math.max(rows[index - 1]?.count ?? 0, 1)),
  }));

  const activationFunnel = [
    { label: 'Sign-up started', count: users7d + logs.filter((log) => log.event_name === APP_EVENTS.authCallbackSucceeded).length },
    { label: 'Account created', count: users7d },
    { label: 'Group ready', count: logs.filter((log) => log.event_name === APP_EVENTS.groupCreated).length },
    { label: 'Return sign-in', count: reconnectSignals },
    { label: 'First session joined', count: logs.filter((log) => log.event_name === APP_EVENTS.sessionJoinedByCode).length },
  ];

  return {
    generatedAt: now,
    kpis: [
      {
        label: 'Session completion',
        value: String(completionRate),
        unit: '%',
        tone: completionRate >= 85 ? 'ok' : completionRate >= 60 ? 'warn' : 'crit',
        delta: formatDelta(sessions7d, sessionsPrev7d),
        spark: [sessionsPrev7d, sessions7d, completed7d, activeSessions, sessions7d],
      },
      {
        label: 'Realtime sync events',
        value: String(syncEvents),
        unit: '',
        tone: errors7d > 0 ? 'warn' : 'ok',
        delta: `${answerEvents} answer events`,
        spark: [answerEvents, syncEvents, revealEvents, completed7d],
      },
      {
        label: 'Error rate',
        value: String(errorRate),
        unit: '/1k sess.',
        tone: errorRate > 5 ? 'crit' : errorRate > 0 ? 'warn' : 'ok',
        delta: `${errors24h} errors last 24h`,
        spark: [0, errors24h, errors7d, warnings7d],
      },
      {
        label: 'Reconnect signals',
        value: String(reconnectSignals),
        unit: '',
        tone: 'ok',
        delta: 'auth + code join',
        spark: [users7d, reconnectSignals, activeUsers],
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
    volumeSeries: bucketLastSevenDays(logs),
    incidents:
      incidents.length > 0
        ? incidents
        : [
            {
              id: 'nominal',
              severity: 'info',
              title: 'No tracked incidents',
              message: 'No warn/error application events were recorded in the 7d window.',
              meta: '7d',
              status: 'resolved',
            },
          ],
    sessionFunnel,
    activationFunnel,
    subscriptionFunnel: [
      { label: 'Hit 85 warning', count: warningUsers, tone: 'warn' },
      { label: 'Reached 100', count: reached100Users, tone: 'warn' },
      { label: 'Subscribed -> Active', count: subscribedAfter100, tone: 'ok' },
      { label: 'Locked (unpaid)', count: lockedUsers, tone: 'crit' },
    ],
  };
}
