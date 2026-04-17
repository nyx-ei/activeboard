'use client';

import { useState } from 'react';
import { AlertTriangle, Clock, Share2, Trash2 } from 'lucide-react';

import { useRouter } from '@/i18n/navigation';
import { SubmitButton } from '@/components/ui/submit-button';

type DashboardSession = {
  id: string;
  group_id: string;
  groupName: string | null;
  name: string | null;
  scheduled_at: string;
  share_code: string;
  status: 'scheduled' | 'active' | 'incomplete' | 'completed' | 'cancelled';
  question_goal: number;
  answeredQuestionCount?: number;
  questionCount?: number;
};

type DashboardSessionsViewProps = {
  locale: string;
  primaryGroupId: string | null;
  sessions: DashboardSession[];
  weeklyCompletedQuestions: number;
  weeklyTargetQuestions: number;
  weeklyProgressPercentage: number;
  canCreateSession: boolean;
  canJoinSessions: boolean;
  memberCount: number;
  createSessionAction: (formData: FormData) => void | Promise<void>;
  cancelSessionAction: (formData: FormData) => void | Promise<void>;
  joinSessionAction: (formData: FormData) => void | Promise<void>;
  labels: {
    newSession: string;
    weeklyProgressTitle: string;
    prequalification: string;
    classGoal: string;
    sessions: string;
    noSessionCta: string;
    sessionCodePlaceholder: string;
    go: string;
    goPending: string;
    upgradeRequiredToJoinSession: string;
    createSession: string;
    createSessionPending: string;
    sessionName: string;
    sessionNamePlaceholder: string;
    questionCount: string;
    timerMode: string;
    perQuestionMode: string;
    globalMode: string;
    timerSeconds: string;
    totalTimerSeconds: string;
    modalHint: string;
    close: string;
    share: string;
    delete: string;
    copied: string;
    statusScheduled: string;
    statusActive: string;
    statusCompleted: string;
    statusIncomplete: string;
    statusCancelled: string;
    questionCounter: string;
    reliableGroupsGoal: string;
    minimumMembersWarning: string;
    soloSessionProgressHint: string;
    groupAccessHint: string;
  };
};

function StatusBadge({ status, labels }: { status: DashboardSession['status']; labels: DashboardSessionsViewProps['labels'] }) {
  const label =
    status === 'active'
      ? labels.statusActive
      : status === 'incomplete'
        ? labels.statusIncomplete
      : status === 'completed'
        ? labels.statusCompleted
        : status === 'cancelled'
          ? labels.statusCancelled
          : labels.statusScheduled;

  return (
    <span className="inline-flex min-h-6 items-center rounded-full border border-brand/20 bg-brand/12 px-2.5 py-1 text-[11px] font-bold text-brand shadow-[0_0_0_1px_rgba(16,185,129,0.08)]">
      {label}
    </span>
  );
}

function SessionCard({
  session,
  locale,
  labels,
  cancelSessionAction,
}: {
  session: DashboardSession;
  locale: string;
  labels: DashboardSessionsViewProps['labels'];
  cancelSessionAction: DashboardSessionsViewProps['cancelSessionAction'];
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const answeredCount = session.answeredQuestionCount ?? 0;
  const targetCount = session.question_goal || session.questionCount || 10;

  async function shareSession(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const shareUrl = `${window.location.origin}/${locale}/sessions/${session.id}`;
    const text = `${session.name ?? session.groupName ?? 'ActiveBoard'} - ${session.share_code}`;

    if (navigator.share) {
      await navigator.share({ title: 'ActiveBoard', text, url: shareUrl });
      return;
    }

    await navigator.clipboard.writeText(`${text} ${shareUrl}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/sessions/${session.id}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          router.push(`/sessions/${session.id}`);
        }
      }}
      className="group cursor-pointer rounded-[10px] border border-white/[0.07] bg-[#0f1628] px-4 py-3 transition hover:border-brand/70 hover:bg-[#111b30]"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-sm font-extrabold text-white">{session.name ?? session.groupName ?? 'ActiveBoard'}</h2>
            <StatusBadge status={session.status} labels={labels} />
          </div>
          <p className="mt-1 text-xs font-medium text-slate-500">
            {new Intl.DateTimeFormat(locale, {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(session.scheduled_at))}{' '}
            <span className="px-1">:</span>
            {answeredCount} / {targetCount} Q
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-slate-500">
          {copied ? <span className="text-[10px] font-bold text-brand">{labels.copied}</span> : null}
          <button
            type="button"
            aria-label={labels.share}
            onClick={shareSession}
            className="rounded-md p-1.5 transition hover:bg-white/[0.06] hover:text-brand"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
          </button>
          <form action={cancelSessionAction} onClick={(event) => event.stopPropagation()}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="sessionId" value={session.id} />
            <SubmitButton
              pendingLabel=""
              className="rounded-md p-1.5 transition hover:bg-white/[0.06] hover:text-red-300"
              disabled={session.status === 'completed' || session.status === 'cancelled'}
            >
              <span className="sr-only">{labels.delete}</span>
              <Trash2 className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
            </SubmitButton>
          </form>
        </div>
      </div>
    </article>
  );
}

function NewSessionModal({
  locale,
  primaryGroupId,
  memberCount,
  canCreateSession,
  action,
  labels,
  onClose,
}: {
  locale: string;
  primaryGroupId: string | null;
  memberCount: number;
  canCreateSession: boolean;
  action: DashboardSessionsViewProps['createSessionAction'];
  labels: DashboardSessionsViewProps['labels'];
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [questionGoal, setQuestionGoal] = useState('10');
  const [timerMode, setTimerMode] = useState<'per_question' | 'global'>('per_question');
  const [timerSeconds, setTimerSeconds] = useState('90');
  const updateTimerMode = (value: 'per_question' | 'global') => {
    setTimerMode(value);
    setTimerSeconds(value === 'global' ? '600' : '90');
  };
  const isValid =
    Boolean(primaryGroupId) &&
    canCreateSession &&
    memberCount >= 2 &&
    name.trim().length > 0 &&
    Number(questionGoal) > 0 &&
    Number(timerSeconds) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[478px] rounded-[14px] bg-[#111827] p-6 shadow-2xl ring-1 ring-white/[0.08]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-white">{labels.newSession}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:text-white" aria-label={labels.close}>
            x
          </button>
        </div>

        <form action={action} className="mt-5 space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="groupId" value={primaryGroupId ?? ''} />
          <label className="block">
            <span className="text-sm font-bold text-slate-300">{labels.sessionName}</span>
            <input
              name="sessionName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={labels.sessionNamePlaceholder}
              className="field mt-2 h-10 rounded-[7px] px-3 py-2 text-sm"
              autoComplete="off"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-300">{labels.questionCount}</span>
            <input
              name="questionGoal"
              type="number"
              min="1"
              max="500"
              value={questionGoal}
              onChange={(event) => setQuestionGoal(event.target.value)}
              className="field mt-2 h-10 rounded-[7px] px-3 py-2 text-sm"
            />
          </label>

          <div>
            <span className="text-sm font-bold text-slate-300">{labels.timerMode}</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                ['per_question', labels.perQuestionMode],
                ['global', labels.globalMode],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className={`flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[7px] border text-sm font-bold transition ${
                    timerMode === value
                      ? 'border-brand bg-brand text-[#06120e]'
                      : 'border-white/[0.08] bg-white/[0.035] text-slate-300 hover:border-brand/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="timerMode"
                    value={value}
                    checked={timerMode === value}
                    onChange={() => updateTimerMode(value as 'per_question' | 'global')}
                    className="sr-only"
                  />
                  <Clock className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-bold text-slate-300">
              {timerMode === 'global' ? labels.totalTimerSeconds : labels.timerSeconds}
            </span>
            <input
              name="timerSeconds"
              type="number"
              min="1"
              max="3600"
              value={timerSeconds}
              onChange={(event) => setTimerSeconds(event.target.value)}
              className="field mt-2 h-10 rounded-[7px] px-3 py-2 text-sm"
            />
          </label>

          <p className="text-xs italic text-slate-500">{labels.modalHint}</p>
          {memberCount < 2 ? <p className="text-xs font-semibold text-slate-500">{labels.groupAccessHint}</p> : null}
          <SubmitButton
            pendingLabel={labels.createSessionPending}
            className="button-primary h-10 w-full rounded-[7px] py-2 text-sm disabled:bg-brand/40 disabled:text-white/60"
            disabled={!isValid}
          >
            {labels.createSession}
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

export function DashboardSessionsView({
  locale,
  primaryGroupId,
  sessions,
  weeklyCompletedQuestions,
  weeklyTargetQuestions,
  weeklyProgressPercentage,
  canCreateSession,
  canJoinSessions,
  memberCount,
  createSessionAction,
  cancelSessionAction,
  joinSessionAction,
  labels,
}: DashboardSessionsViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const progressTotal = weeklyTargetQuestions > 0 ? weeklyTargetQuestions : 100;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="button-primary h-14 w-full rounded-[8px] text-base"
        disabled={!canCreateSession || !primaryGroupId}
      >
        <span className="mr-2 text-xl leading-none">+</span>
        {labels.newSession}
      </button>

      <section className="surface-mockup p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-300">{labels.weeklyProgressTitle}</p>
            <p className="mt-2 text-2xl font-extrabold text-white">
              {weeklyCompletedQuestions}
              <span className="ml-2 text-sm font-bold text-slate-500">/ {progressTotal}</span>
            </p>
          </div>
          <p className="text-2xl font-extrabold text-brand">{weeklyProgressPercentage}%</p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]">
          <div className="h-full rounded-full bg-brand" style={{ width: `${weeklyProgressPercentage}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-300">
            {labels.questionCounter
              .replace('{completed}', String(weeklyCompletedQuestions))
              .replace('{total}', String(progressTotal))}
          </span>
          <span>{labels.reliableGroupsGoal}</span>
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-[7px] border border-white/[0.06] bg-[#121b2e] px-4 py-2.5 text-[11px] font-semibold leading-snug text-slate-500">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
        <p>{labels.soloSessionProgressHint}</p>
      </div>

      <section className="space-y-3">
        <h1 className="text-lg font-extrabold tracking-tight text-white">{labels.sessions}</h1>
        {sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                locale={locale}
                labels={labels}
                cancelSessionAction={cancelSessionAction}
              />
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-slate-500">{labels.noSessionCta}</p>
        )}
      </section>

      {sessions.length > 0 ? (
        <>
          <form action={joinSessionAction} className="flex justify-center gap-2">
            <input type="hidden" name="locale" value={locale} />
            <input
              name="sessionCode"
              maxLength={6}
              placeholder={labels.sessionCodePlaceholder}
              autoCapitalize="characters"
              autoComplete="off"
              className="field h-9 max-w-[210px] rounded-[7px] px-4 py-2 text-center text-xs uppercase tracking-[0.18em]"
            />
            <SubmitButton pendingLabel={labels.goPending} className="button-primary h-9 rounded-[7px] px-4 py-2 text-xs" disabled={!canJoinSessions}>
              {labels.go}
            </SubmitButton>
          </form>
          {!canJoinSessions ? <p className="text-center text-sm text-amber-300">{labels.upgradeRequiredToJoinSession}</p> : null}
        </>
      ) : null}

      {isModalOpen ? (
        <NewSessionModal
          locale={locale}
          primaryGroupId={primaryGroupId}
          memberCount={memberCount}
          canCreateSession={canCreateSession}
          action={createSessionAction}
          labels={labels}
          onClose={() => setIsModalOpen(false)}
        />
      ) : null}
    </>
  );
}
