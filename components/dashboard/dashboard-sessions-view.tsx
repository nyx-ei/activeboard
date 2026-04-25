'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import { CreateSessionModal } from '@/components/sessions/create-session-modal';
import { SubmitButton } from '@/components/ui/submit-button';
import { SessionCard, type SessionCardLabels, type SessionListItem } from '@/components/sessions/session-card';

type DashboardSessionsViewProps = {
  locale: string;
  sessions: SessionListItem[];
  groups: Array<{ id: string; name: string; memberCount: number }>;
  trialProgress: {
    current: number;
    total: number;
    remaining: number;
    showWarning: boolean;
    isComplete: boolean;
  };
  canJoinSessions: boolean;
  canCreateSession: boolean;
  cancelSessionAction: (formData: FormData) => void | Promise<void>;
  joinSessionAction: (formData: FormData) => void | Promise<void>;
  createSessionAction: (formData: FormData) => void | Promise<void>;
  labels: SessionCardLabels & {
    sessions: string;
    newSession: string;
    createSession: string;
    createSessionPending: string;
    groupName: string;
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
    noSessionCta: string;
    sessionCodePlaceholder: string;
    go: string;
    goPending: string;
    upgradeRequiredToJoinSession: string;
    soloSessionProgressHint: string;
    groupAccessHint: string;
    trialProgressTitle: string;
    trialProgressSummary: string;
    trialProgressDescription: string;
    trialProgressWarning: string;
    trialProgressComplete: string;
  };
  sessionJoinFeedback?: {
    tone: 'success' | 'error';
    message: string;
  } | null;
};

export function DashboardSessionsView({
  locale,
  sessions,
  groups,
  trialProgress,
  canJoinSessions,
  canCreateSession,
  cancelSessionAction,
  joinSessionAction,
  createSessionAction,
  labels,
  sessionJoinFeedback,
}: DashboardSessionsViewProps) {
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState(false);
  const initialGroupId = groups[0]?.id ?? '';

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

      {groups.length > 0 ? (
        <div className="w-full">
          <button
            type="button"
            onClick={() => setIsCreateSessionOpen(true)}
            className="button-primary h-10 w-full rounded-[7px] px-4 text-sm"
            disabled={!canCreateSession}
          >
            <span className="mr-2 text-lg leading-none">+</span>
            {labels.newSession}
          </button>
        </div>
      ) : null}

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

      <div className="space-y-2">
        <form action={joinSessionAction} className="flex items-center gap-2 sm:justify-center">
          <input type="hidden" name="locale" value={locale} />
          <input
            name="sessionCode"
            maxLength={6}
            placeholder={labels.sessionCodePlaceholder}
            autoCapitalize="characters"
            autoComplete="off"
            className="field h-10 min-w-0 flex-1 rounded-[7px] px-4 py-2 text-center text-xs uppercase tracking-[0.18em] sm:h-9 sm:max-w-[210px] sm:flex-none"
          />
          <SubmitButton pendingLabel={labels.goPending} className="button-primary h-10 w-[96px] shrink-0 rounded-[7px] px-4 py-2 text-xs sm:h-9 sm:w-auto" disabled={!canJoinSessions}>
            {labels.go}
          </SubmitButton>
        </form>
        {sessionJoinFeedback?.message ? (
          <p className={sessionJoinFeedback.tone === 'error' ? 'text-center text-sm font-semibold text-rose-300' : 'text-center text-sm font-semibold text-brand'}>
            {sessionJoinFeedback.message}
          </p>
        ) : null}
        {!canJoinSessions ? <p className="text-center text-sm text-amber-300">{labels.upgradeRequiredToJoinSession}</p> : null}
      </div>

      {isCreateSessionOpen && groups.length > 0 ? (
        <CreateSessionModal
          locale={locale}
          groups={groups}
          initialGroupId={initialGroupId}
          canCreateSession={canCreateSession}
          action={createSessionAction}
          labels={{
            newSession: labels.newSession,
            createSession: labels.createSession,
            createSessionPending: labels.createSessionPending,
            groupName: labels.groupName,
            sessionName: labels.sessionName,
            sessionNamePlaceholder: labels.sessionNamePlaceholder,
            questionCount: labels.questionCount,
            timerMode: labels.timerMode,
            perQuestionMode: labels.perQuestionMode,
            globalMode: labels.globalMode,
            timerSeconds: labels.timerSeconds,
            totalTimerSeconds: labels.totalTimerSeconds,
            modalHint: labels.modalHint,
            close: labels.close,
            groupAccessHint: labels.groupAccessHint,
          }}
          onClose={() => setIsCreateSessionOpen(false)}
        />
      ) : null}
    </>
  );
}
