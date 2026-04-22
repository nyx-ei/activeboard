'use client';

import { AlertTriangle } from 'lucide-react';

import { SubmitButton } from '@/components/ui/submit-button';
import { SessionCard, type SessionCardLabels, type SessionListItem } from '@/components/sessions/session-card';

type DashboardSessionsViewProps = {
  locale: string;
  sessions: SessionListItem[];
  trialProgress: {
    current: number;
    total: number;
    remaining: number;
    showWarning: boolean;
    isComplete: boolean;
  };
  weeklyCompletedQuestions: number;
  weeklyTargetQuestions: number;
  weeklyProgressPercentage: number;
  canJoinSessions: boolean;
  cancelSessionAction: (formData: FormData) => void | Promise<void>;
  joinSessionAction: (formData: FormData) => void | Promise<void>;
  labels: SessionCardLabels & {
    weeklyProgressTitle: string;
    prequalification: string;
    classGoal: string;
    sessions: string;
    noSessionCta: string;
    sessionCodePlaceholder: string;
    go: string;
    goPending: string;
    upgradeRequiredToJoinSession: string;
    questionCounter: string;
    reliableGroupsGoal: string;
    minimumMembersWarning: string;
    soloSessionProgressHint: string;
    groupAccessHint: string;
    trialProgressTitle: string;
    trialProgressSummary: string;
    trialProgressDescription: string;
    trialProgressWarning: string;
    trialProgressComplete: string;
  };
};

export function DashboardSessionsView({
  locale,
  sessions,
  trialProgress,
  weeklyCompletedQuestions,
  weeklyTargetQuestions,
  weeklyProgressPercentage,
  canJoinSessions,
  cancelSessionAction,
  joinSessionAction,
  labels,
}: DashboardSessionsViewProps) {
  const progressTotal = weeklyTargetQuestions > 0 ? weeklyTargetQuestions : 100;

  return (
    <>
      <section className="surface-mockup p-5">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm font-bold text-white">{labels.trialProgressTitle}</p>
          <p className="text-sm font-extrabold text-white">
            {trialProgress.current} / {trialProgress.total}
          </p>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          {labels.trialProgressSummary
            .replace('{current}', String(trialProgress.current))
            .replace('{total}', String(trialProgress.total))}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${Math.min(100, Math.round((trialProgress.current / Math.max(1, trialProgress.total)) * 100))}%` }}
          />
        </div>
        <p className={`mt-3 text-sm ${trialProgress.isComplete || trialProgress.showWarning ? 'font-bold text-amber-300' : 'text-slate-500'}`}>
          {trialProgress.isComplete
            ? labels.trialProgressComplete
            : trialProgress.showWarning
              ? labels.trialProgressWarning.replace('{remaining}', String(trialProgress.remaining))
              : labels.trialProgressDescription.replace('{remaining}', String(trialProgress.remaining))}
        </p>
      </section>

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
          <form action={joinSessionAction} className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <input type="hidden" name="locale" value={locale} />
            <input
              name="sessionCode"
              maxLength={6}
              placeholder={labels.sessionCodePlaceholder}
              autoCapitalize="characters"
              autoComplete="off"
              className="field h-10 w-full rounded-[7px] px-4 py-2 text-center text-xs uppercase tracking-[0.18em] sm:h-9 sm:max-w-[210px]"
            />
            <SubmitButton pendingLabel={labels.goPending} className="button-primary h-10 rounded-[7px] px-4 py-2 text-xs sm:h-9" disabled={!canJoinSessions}>
              {labels.go}
            </SubmitButton>
          </form>
          {!canJoinSessions ? <p className="text-center text-sm text-amber-300">{labels.upgradeRequiredToJoinSession}</p> : null}
        </>
      ) : null}
    </>
  );
}
