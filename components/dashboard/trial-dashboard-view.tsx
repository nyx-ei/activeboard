'use client';

import { useMemo } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Info,
  LockKeyhole,
  Plus,
  Radio,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  UserRound,
} from 'lucide-react';

import { Link } from '@/i18n/navigation';
import type { DashboardPerformanceViewProps } from '@/components/dashboard/dashboard-performance-view';
import type { DashboardSessionsViewProps } from '@/components/dashboard/dashboard-sessions-view';
import { SeriousCandidatesPanel } from '@/components/dashboard/serious-candidates-panel';
import type { SessionListItem } from '@/components/sessions/session-card';

type TrialDashboardViewProps = {
  locale: string;
  sessionsProps: DashboardSessionsViewProps;
  performanceProps: DashboardPerformanceViewProps;
  canOpenAdminConsole?: boolean;
  canOpenOpsDashboard?: boolean;
};

type TrialStatus =
  | 'notStarted'
  | 'started'
  | 'review'
  | 'feedback'
  | 'nextSessionPlanned'
  | 'done'
  | 'expired';

const COPY = {
  fr: {
    unlock: (remaining: number) =>
      remaining > 0
        ? `Termine ${remaining} séance${remaining > 1 ? 's' : ''} de plus pour débloquer les candidats sérieux.`
        : 'Candidats sérieux débloqués.',
    reliabilityScore: 'Score de fiabilité',
    reliabilityInfoTitle: 'Composition du score',
    reliabilityItems: [
      ['Présence', '30%'],
      ['Ponctualité', '15%'],
      ['Complétion', '15%'],
      ['Questions révisées', '20%'],
      ['Prochaine séance', '10%'],
      ['Validation pair-à-pair', '10%'],
    ],
    activeCandidates: 'candidats actifs',
    viewMore: 'Voir plus',
    testSessions: 'Séances tests',
    updateAvailability: 'Modifier mes disponibilités',
    expiredHint:
      'Cette séance est expirée. Mets à jour tes disponibilités pour générer une séance de rattrapage.',
    seriousPoolLocked: 'Pool sérieux verrouillé',
    reviewedQuestions: 'Questions révisées',
    trueMastery: 'Maîtrise réelle',
    falseConfidence: 'Fausse confiance',
    startSession: 'Démarrer',
    adminConsole: 'Console admin',
    opsDashboard: 'Ops dashboard',
    statuses: {
      notStarted: 'Programmée',
      started: 'Démarrée',
      review: 'Révision',
      feedback: 'Feedback',
      nextSessionPlanned: 'À planifier',
      done: 'Terminée',
      expired: 'Expirée',
    },
  },
  en: {
    unlock: (remaining: number) =>
      remaining > 0
        ? `Complete ${remaining} more session${remaining > 1 ? 's' : ''} to unlock serious candidates.`
        : 'Serious candidates unlocked.',
    reliabilityScore: 'Reliability score',
    reliabilityInfoTitle: 'Score composition',
    reliabilityItems: [
      ['Attendance', '30%'],
      ['Punctuality', '15%'],
      ['Completion', '15%'],
      ['Reviewed questions', '20%'],
      ['Next session planned', '10%'],
      ['Peer validation', '10%'],
    ],
    activeCandidates: 'active candidates',
    viewMore: 'View more',
    testSessions: 'Test sessions',
    updateAvailability: 'Update availability',
    expiredHint:
      'This session expired. Update your availability to generate a replacement test session.',
    seriousPoolLocked: 'Serious pool locked',
    reviewedQuestions: 'Questions reviewed',
    trueMastery: 'True mastery',
    falseConfidence: 'False confidence',
    startSession: 'Start session',
    adminConsole: 'Admin console',
    opsDashboard: 'Ops dashboard',
    statuses: {
      notStarted: 'Scheduled',
      started: 'Started',
      review: 'Review',
      feedback: 'Feedback',
      nextSessionPlanned: 'Next session planned',
      done: 'Done',
      expired: 'Expired',
    },
  },
};

function getCopy(locale: string) {
  return locale.startsWith('fr') ? COPY.fr : COPY.en;
}

function getSessionStatus(session: SessionListItem): TrialStatus {
  if (session.status === 'completed') {
    return 'done';
  }

  if (session.status === 'expired') {
    return 'expired';
  }

  if (session.status === 'active') {
    const target = session.question_goal || session.questionCount || 20;
    const answered = session.answeredQuestionCount ?? 0;
    if (answered >= target) {
      return 'review';
    }

    return 'started';
  }

  if (session.status === 'incomplete') {
    return 'review';
  }

  return session.scheduled_at ? 'notStarted' : 'nextSessionPlanned';
}

function getStatusClass(status: TrialStatus) {
  switch (status) {
    case 'done':
      return 'border-violet-300/45 bg-violet-400/10 text-violet-200';
    case 'expired':
      return 'border-slate-300/30 bg-slate-400/10 text-slate-300';
    case 'started':
      return 'border-[#20D9A3]/45 bg-[#20D9A3]/12 text-[#77f1c7]';
    case 'review':
      return 'border-sky-300/45 bg-sky-400/10 text-sky-200';
    case 'feedback':
      return 'border-amber-300/45 bg-amber-400/10 text-amber-200';
    case 'nextSessionPlanned':
      return 'border-cyan-300/45 bg-cyan-400/10 text-cyan-200';
    default:
      return 'border-amber-300/45 bg-amber-400/10 text-amber-200';
  }
}

function getSessionSortPriority(session: SessionListItem) {
  if (session.status === 'active') {
    return 0;
  }

  if (session.status === 'incomplete') {
    return 1;
  }

  if (session.status === 'scheduled' && session.meeting_link) {
    return 2;
  }

  if (session.status === 'scheduled') {
    return 3;
  }

  return 4;
}

function getNaturalSessionOrder(session: SessionListItem) {
  const label = session.name ?? '';
  const match = label.match(
    /(?:session\s*(?:test)?|séance\s*(?:test)?)\D*(\d+)/i,
  );

  return match?.[1] ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function selectTrialSessions(sessions: SessionListItem[]) {
  return sessions
    .filter(
      (session) =>
        session.status !== 'cancelled' && session.status !== 'completed',
    )
    .slice()
    .sort((left, right) => {
      const priorityDelta =
        getSessionSortPriority(left) - getSessionSortPriority(right);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const naturalOrderDelta =
        getNaturalSessionOrder(left) - getNaturalSessionOrder(right);
      if (naturalOrderDelta !== 0) {
        return naturalOrderDelta;
      }

      return (
        new Date(left.scheduled_at).getTime() -
        new Date(right.scheduled_at).getTime()
      );
    })
    .slice(0, 3);
}

function formatDate(locale: string, value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'XXhXX';
  }

  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function formatTime(locale: string, value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'XXhXX';
  }

  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function getSessionCountdownLabel(locale: string, scheduledAt: string) {
  const date = new Date(scheduledAt);
  const now = new Date();

  if (!Number.isFinite(date.getTime()) || !isSameLocalDay(date, now)) {
    return null;
  }

  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) {
    return locale === 'fr' ? 'En direct' : 'Live';
  }

  const hours = Math.max(1, Math.ceil(diffMs / (60 * 60 * 1000)));
  return locale === 'fr' ? `dans ${hours}h` : `in ${hours}h`;
}

function canEditScheduledSessionTime(session: SessionListItem) {
  if (session.status !== 'scheduled') {
    return false;
  }

  if (!session.meeting_link) {
    return true;
  }

  return new Date(session.scheduled_at).getTime() - Date.now() > 60 * 60 * 1000;
}

function ParticipantsBadge({ count }: { count: number }) {
  const visibleCount = Math.max(1, Math.min(count, 3));
  const overflowCount = Math.max(0, count - visibleCount);

  return (
    <div className="flex h-12 w-[72px] shrink-0 items-center justify-center gap-0.5 rounded-full border border-[#20D9A3]/20 bg-white/[0.035] text-slate-300 shadow-[inset_0_0_24px_rgba(32,217,163,0.07)] min-[390px]:w-20 sm:h-16 sm:w-32 sm:gap-1">
      {Array.from({ length: visibleCount }).map((_, index) => (
        <UserRound
          key={index}
          className={`h-4 w-4 sm:h-5 sm:w-5 ${
            index === 1 ? 'text-[#20D9A3]' : 'opacity-80'
          }`}
          aria-hidden="true"
        />
      ))}
      {overflowCount > 0 ? (
        <span className="pl-0.5 text-[11px] font-black text-[#20D9A3] sm:text-sm">
          +{overflowCount}
        </span>
      ) : null}
    </div>
  );
}

function TrialSessionRow({
  session,
  index,
  locale,
  labels,
  memberCount,
}: {
  session: SessionListItem;
  index: number;
  locale: string;
  labels: ReturnType<typeof getCopy>;
  memberCount: number;
}) {
  const status = getSessionStatus(session);
  const answered = session.answeredQuestionCount ?? 0;
  const target = session.question_goal || session.questionCount || 20;
  const timerSeconds = session.timer_seconds ?? 90;
  const title = session.name || `Session ${index + 1}`;
  const isActionable =
    session.status === 'active' ||
    session.status === 'incomplete' ||
    session.status === 'scheduled' ||
    session.status === 'completed';
  const isScheduledWithoutTime =
    session.status === 'scheduled' && !session.meeting_link;
  const isExpired = session.status === 'expired';
  const sessionHref = canEditScheduledSessionTime(session)
    ? `/sessions/${session.id}?stage=configure`
    : `/sessions/${session.id}?stage=progress`;
  const scheduledTimeLabel =
    session.status === 'scheduled' && session.meeting_link
      ? getSessionCountdownLabel(locale, session.scheduled_at)
      : null;
  const isLiveCountdown = isLiveSessionCountdownLabel(scheduledTimeLabel);

  const content = (
    <>
      <ParticipantsBadge count={memberCount} />
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
          <h3 className="max-w-full truncate text-base font-extrabold text-white min-[390px]:text-lg sm:text-xl">
            {title}
          </h3>
          <span
            className={`inline-flex min-h-6 max-w-full items-center rounded-full border px-2 text-[10px] font-extrabold leading-none sm:min-h-7 sm:px-3 sm:text-xs ${getStatusClass(status)}`}
          >
            {isScheduledWithoutTime
              ? labels.statuses.notStarted
              : isExpired
                ? labels.statuses.expired
                : session.status === 'scheduled' && session.meeting_link
                ? locale === 'fr'
                  ? 'Planifiée'
                  : 'Planned'
                : labels.statuses[status]}
          </span>
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-[#a8bcb7] sm:text-base">
          {answered}/{target}Q
          <span className="px-2 text-[#5b7771]">·</span>
          {timerSeconds}sec
        </p>
        {isExpired ? (
          <p className="mt-1 line-clamp-2 text-[11px] font-bold leading-snug text-amber-200/90 sm:text-xs">
            {labels.expiredHint}
          </p>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col items-end justify-center text-right text-[12px] font-bold leading-snug text-[#b8c7c4] min-[390px]:text-sm sm:min-w-[110px] sm:text-base">
        {isScheduledWithoutTime ? (
          <>
            <span className="max-w-full truncate">{formatDate(locale, session.scheduled_at)}</span>
            <span>XXhXX</span>
          </>
        ) : scheduledTimeLabel ? (
          <span className="inline-flex items-center justify-end gap-1">
            {isLiveCountdown ? (
              <Radio className="h-3.5 w-3.5 text-[#20D9A3] sm:h-4 sm:w-4" aria-hidden="true" />
            ) : null}
            <span>{scheduledTimeLabel}</span>
          </span>
        ) : isActionable ? (
          <>
            <span className="max-w-full truncate">{formatDate(locale, session.scheduled_at)}</span>
            <span>{formatTime(locale, session.scheduled_at)}</span>
          </>
        ) : (
          <span>XXhXX</span>
        )}
      </div>
    </>
  );
  const rowClassName = `group grid grid-cols-[auto_minmax(0,1fr)_minmax(60px,auto)] items-center gap-2 rounded-[18px] border px-3 py-3 text-left shadow-[inset_0_0_38px_rgba(32,217,163,0.035)] transition min-[390px]:grid-cols-[auto_minmax(0,1fr)_minmax(72px,auto)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-5 sm:px-5 ${
    isExpired
      ? 'cursor-not-allowed border-white/[0.08] bg-slate-900/45 opacity-60 grayscale'
      : 'border-[#20D9A3]/25 bg-[#082c24]/68 hover:border-[#20D9A3]/55 hover:bg-[#0b3a30]/78'
  }`;

  if (isExpired) {
    return <div className={rowClassName}>{content}</div>;
  }

  return (
    <Link href={sessionHref} className={rowClassName}>
      {content}
    </Link>
  );
}

function isLiveSessionCountdownLabel(label: string | null) {
  const normalized = label?.trim().toLowerCase();
  return normalized === 'en direct' || normalized === 'live';
}

export function EmptyTrialSessionRowUnused({
  index,
  labels,
}: {
  index: number;
  labels: ReturnType<typeof getCopy>;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(60px,auto)] items-center gap-2 rounded-[18px] border border-[#20D9A3]/15 bg-[#08261f]/48 px-3 py-3 opacity-90 min-[390px]:grid-cols-[auto_minmax(0,1fr)_minmax(72px,auto)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-5 sm:px-5">
      <ParticipantsBadge count={3} />
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
          <h3 className="truncate text-base font-extrabold text-white min-[390px]:text-lg sm:text-xl">
            Session {index + 1}
          </h3>
          <span
            className={`inline-flex min-h-6 max-w-full items-center rounded-full border px-2 text-[10px] font-extrabold leading-none sm:min-h-7 sm:px-3 sm:text-xs ${getStatusClass('nextSessionPlanned')}`}
          >
            {labels.statuses.nextSessionPlanned}
          </span>
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-[#a8bcb7] sm:text-base">
          0Q
          <span className="px-2 text-[#5b7771]">·</span>
          90sec
        </p>
      </div>
      <div className="min-w-0 text-right text-[12px] font-bold leading-snug text-[#b8c7c4] min-[390px]:text-sm sm:min-w-[110px] sm:text-base">
        XXhXX
      </div>
    </div>
  );
}

function ReliabilityInfo({ labels }: { labels: ReturnType<typeof getCopy> }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#20D9A3]/30 bg-[#20D9A3]/10 text-[#20D9A3] transition hover:border-[#20D9A3]/60 hover:bg-[#20D9A3]/15 focus:outline-none focus:ring-2 focus:ring-[#20D9A3]/30"
        aria-label={labels.reliabilityInfoTitle}
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-[min(340px,calc(100vw-48px))] -translate-x-1/2 rounded-[10px] border border-white/[0.08] bg-[#071a18] p-3 text-left text-[11px] font-semibold leading-5 text-[#b8c7c4] shadow-[0_18px_50px_rgba(0,0,0,0.5)] group-hover:block group-focus-within:block">
        <span className="block text-xs font-extrabold text-white">
          {labels.reliabilityInfoTitle}
        </span>
        <span className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
          {labels.reliabilityItems.map(([label, weight]) => (
            <span key={label} className="flex gap-1.5">
              <span className="text-[#20D9A3]" aria-hidden="true">•</span>
              <span>
                {label} <strong className="text-white">{weight}</strong>
              </span>
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

function MetricValue({
  value,
  direction,
}: {
  value: number;
  direction: 'up' | 'down';
}) {
  const Icon = direction === 'up' ? TrendingUp : TrendingDown;

  return (
    <div className="inline-flex items-end justify-center gap-1.5 text-3xl font-black leading-none text-[#20D9A3] min-[390px]:text-4xl sm:gap-2 sm:text-5xl">
      <span>{value}%</span>
      <Icon
        className="mb-1 h-6 w-6 sm:h-8 sm:w-8"
        aria-hidden="true"
        strokeWidth={3}
      />
    </div>
  );
}

function getSessionMemberCount(
  session: SessionListItem,
  groups: TrialDashboardViewProps['sessionsProps']['groups'],
) {
  return Math.max(
    1,
    groups.find((group) => group.id === session.group_id)?.memberCount ?? 1,
  );
}

export function TrialDashboardView({
  locale,
  sessionsProps,
  performanceProps,
  canOpenAdminConsole = false,
  canOpenOpsDashboard = false,
}: TrialDashboardViewProps) {
  const labels = getCopy(locale);
  const trialSessions = useMemo(
    () => selectTrialSessions(sessionsProps.sessions),
    [sessionsProps.sessions],
  );
  const completedSessions = sessionsProps.sessions.filter(
    (session) => session.status === 'completed',
  ).length;
  const remainingSessions = Math.max(3 - Math.min(completedSessions, 3), 0);
  const activeCandidateIds = new Set<string>();
  let activeCandidateFallback = 0;

  for (const group of sessionsProps.groups) {
    activeCandidateFallback += group.memberCount;
    for (const member of group.membersPreview ?? []) {
      activeCandidateIds.add(member.id);
    }
  }

  const activeCandidates =
    activeCandidateIds.size > 0
      ? activeCandidateIds.size
      : activeCandidateFallback;
  const reliabilityScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (performanceProps.successRate ?? 0) * 0.5 +
          (Math.min(completedSessions, 3) / 3) * 50,
      ),
    ),
  );
  const trueMastery = performanceProps.successRate ?? 0;
  const falseConfidence =
    performanceProps.progressQuadrantQuestions.length > 0
      ? Math.round(
          (performanceProps.progressQuadrantQuestions.filter(
            (question) => question.quadrant === 'falseConfidence',
          ).length /
            performanceProps.progressQuadrantQuestions.length) *
            100,
        )
      : 0;
  const reviewedQuestions = Math.max(
    performanceProps.progressQuadrantQuestions.length,
    sessionsProps.sessions.reduce(
      (total, session) => total + (session.answeredQuestionCount ?? 0),
      0,
    ),
  );
  const seriousUnlocked = Boolean(
    sessionsProps.planNextAccess?.canInviteCandidates,
  );
  const createSessionLabel =
    locale === 'fr' ? 'Créer une séance' : 'Create session';
  const showOperatorShortcuts = canOpenAdminConsole || canOpenOpsDashboard;
  return (
    <section className="rounded-[28px] border border-white/[0.07] bg-[radial-gradient(circle_at_50%_10%,rgba(32,217,163,0.13),rgba(1,24,20,0.78)_42%,rgba(0,16,15,0.95)_100%)] px-4 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.36)] sm:px-8 sm:py-7 lg:px-12">
      <div className="mx-auto w-full max-w-[900px] space-y-5 lg:max-w-none">
        {showOperatorShortcuts ? (
          <div className="flex flex-wrap justify-end gap-2">
            {canOpenAdminConsole ? (
              <Link
                href="/admin"
                className="inline-flex h-10 items-center justify-center rounded-[12px] border border-white/[0.08] bg-[#0b2c25]/80 px-4 text-sm font-extrabold text-[#b8f7df] transition hover:border-[#20D9A3]/55 hover:text-[#20D9A3]"
              >
                {labels.adminConsole}
              </Link>
            ) : null}
            {canOpenOpsDashboard ? (
              <Link
                href="/ops"
                className="inline-flex h-10 items-center justify-center rounded-[12px] border border-white/[0.08] bg-[#0b2c25]/80 px-4 text-sm font-extrabold text-[#b8f7df] transition hover:border-[#20D9A3]/55 hover:text-[#20D9A3]"
              >
                {labels.opsDashboard}
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-[14px] border border-[#20D9A3]/45 bg-[#04231d]/70 px-2 py-1 shadow-[inset_0_0_24px_rgba(32,217,163,0.05)] sm:px-3 sm:py-1.5">
          <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-extrabold text-white min-[390px]:text-[11px] sm:gap-2 sm:text-sm">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#20D9A3]/25 bg-[#062f27] text-[#20D9A3] sm:h-8 sm:w-8">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 truncate whitespace-nowrap">
              {labels.unlock(remainingSessions)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 rounded-[24px] border border-white/[0.12] bg-[#082c24]/78 shadow-[inset_0_0_46px_rgba(32,217,163,0.06)]">
          <div className="flex min-h-[150px] flex-col items-center justify-center border-r border-white/[0.08] p-4 text-center sm:min-h-[180px] sm:p-6">
            <div className="flex items-end gap-1 text-[48px] font-black leading-none tracking-[-0.06em] text-[#20D9A3] min-[390px]:text-[56px] sm:gap-2 sm:text-[88px]">
              {reliabilityScore}
              <span className="pb-1 text-2xl sm:pb-2 sm:text-4xl">%</span>
            </div>
            <p className="mt-3 text-sm font-semibold leading-snug text-[#b8c7c4] min-[390px]:text-base sm:mt-4 sm:text-xl">
              {labels.reliabilityScore}
              <ReliabilityInfo labels={labels} />
            </p>
          </div>
          <div className="flex min-h-[150px] flex-col items-center justify-center p-4 text-center sm:min-h-[180px] sm:p-6">
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="grid h-14 w-20 place-items-center rounded-full border border-[#20D9A3]/20 bg-[#0c3a31] text-[#20D9A3] shadow-[0_0_32px_rgba(32,217,163,0.12)] min-[390px]:h-16 min-[390px]:w-24 sm:h-20 sm:w-32">
                <UserRound className="h-8 w-8 sm:h-12 sm:w-12" aria-hidden="true" />
              </span>
              <span className="text-3xl font-black text-[#20D9A3] sm:text-4xl">
                +{Math.max(activeCandidates - 1, 0)}
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold leading-snug text-[#b8c7c4] min-[390px]:text-base sm:mt-5 sm:text-xl">
              {Math.max(activeCandidates, 0)} {labels.activeCandidates}
            </p>
            <Link
              href="/lookup"
              className="mt-4 inline-flex items-center gap-1 text-sm font-extrabold text-[#20D9A3] transition hover:text-[#66f0c7] sm:mt-5 sm:gap-2 sm:text-base"
            >
              {labels.viewMore}
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl">
            {labels.testSessions}
          </h1>

          {trialSessions.map((session, index) => (
            <TrialSessionRow
              key={session.id}
              session={session}
              index={index}
              locale={locale}
              labels={labels}
              memberCount={getSessionMemberCount(session, sessionsProps.groups)}
            />
          ))}
        </div>

        <div className="flex justify-end">
          <Link
            href="/onboarding/availability?mode=edit"
            className="inline-flex items-center gap-2 text-base font-extrabold text-[#20D9A3] underline decoration-[#20D9A3]/45 underline-offset-4 transition hover:text-[#66f0c7]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {labels.updateAvailability}
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>

        <div className="relative rounded-[24px] border border-white/[0.1] bg-[#082c24]/70 p-4 shadow-[inset_0_0_40px_rgba(32,217,163,0.05)] sm:p-6">
          <div className="grid grid-cols-2 divide-x divide-white/[0.07]">
            <div className="px-2 text-center sm:px-0">
              <MetricValue value={trueMastery} direction="up" />
              <p className="mt-2 text-[13px] font-semibold leading-snug text-[#b8c7c4] sm:text-base">
                {labels.trueMastery}
              </p>
            </div>
            <div className="px-2 text-center sm:px-0">
              <MetricValue value={falseConfidence} direction="down" />
              <p className="mt-2 text-[13px] font-semibold leading-snug text-[#b8c7c4] sm:text-base">
                {labels.falseConfidence}
              </p>
            </div>
          </div>
          <div className="mt-5 flex justify-center sm:justify-start">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[11px] font-bold text-[#a8bcb7] sm:text-xs">
              <CheckCircle2 className="h-4 w-4 text-[#20D9A3]" aria-hidden="true" />
              {reviewedQuestions} {labels.reviewedQuestions}
            </div>
          </div>
        </div>

        <div className="flex items-end justify-end gap-4">
          <button
            type="button"
            aria-label={
              seriousUnlocked ? createSessionLabel : labels.seriousPoolLocked
            }
            disabled={!seriousUnlocked}
            onClick={() => {
              if (!seriousUnlocked) {
                return;
              }
              window.dispatchEvent(
                new CustomEvent('activeboard:open-create-session'),
              );
            }}
            className={`relative grid h-20 w-20 place-items-center rounded-full border border-[#20D9A3]/40 bg-[#0c3a31] text-[#9ff0ce] shadow-[0_0_38px_rgba(32,217,163,0.16)] transition sm:h-24 sm:w-24 ${
              seriousUnlocked
                ? 'hover:border-[#20D9A3]/70 hover:bg-[#125242]'
                : 'opacity-90'
            }`}
          >
            <Plus className="h-12 w-12" aria-hidden="true" />
            {!seriousUnlocked ? (
              <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-amber-300 text-[#062b22]">
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              </span>
            ) : null}
          </button>
          <span className="pb-2 text-sm font-bold text-[#b8c7c4] sm:text-base">
            {seriousUnlocked ? createSessionLabel : labels.seriousPoolLocked}
          </span>
        </div>

        <SeriousCandidatesPanel
          locale={locale}
          planNextAccess={sessionsProps.planNextAccess}
        />
      </div>
    </section>
  );
}
