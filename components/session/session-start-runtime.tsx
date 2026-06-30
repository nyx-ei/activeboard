'use client';

import { CalendarClock, Play, UsersRound } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';

import { SessionDashboardBackButton } from '@/components/session/session-dashboard-back-button';
import {
  SessionInviteTeammateButton,
  type SessionInviteTeammateLabels,
} from '@/components/session/session-invite-teammate-button';
import type { SessionLeaveConfirmLabels } from '@/components/session/session-leave-confirm-dialog';
import { SessionStageRefresh } from '@/components/session/session-stage-refresh';
import type { ConfidenceLevel } from '@/lib/demo/confidence';

type ServerAction = (formData: FormData) => void | Promise<void>;

type SessionStartRuntimeProps = {
  locale: string;
  sessionId: string;
  currentUserId: string;
  sessionTitle: string;
  sessionShareLabel: string;
  timerLabel: string;
  timerMode: 'per_question' | 'global';
  timerSeconds: number;
  questionGoal: number;
  memberCount: number;
  canStartSession: boolean;
  canTakeOverStartResponsibility: boolean;
  canInviteTeammate: boolean;
  inviteTeammateDisabledReason?: string | null;
  advanceAction: ServerAction;
  takeOverStartResponsibilityAction: ServerAction;
  labels: {
    questionsUnit: string;
    startSession: string;
    startSessionPending: string;
    takeOverStartResponsibility: string;
    takeOverStartResponsibilityPending: string;
    currentStartResponsible: string;
    quitSession: string;
    questionUpper: string;
    confidenceTitle: string;
    confidenceLow: string;
    confidenceMedium: string;
    confidenceHigh: string;
    customOptionLabel: string;
    customOptionPlaceholder: string;
    submit: string;
    submitPending: string;
    nextQuestion: string;
    nextQuestionPending: string;
    allAnswersReceived: string;
    waitingForCaptainAdvance: string;
    allAnswersSubmitted: string;
    questionsCompletedValue: string;
    goToReview: string;
    quitPending: string;
    quitConfirm: SessionLeaveConfirmLabels;
    inviteTeammate: SessionInviteTeammateLabels;
  };
};

type StartSessionResponse = {
  ok?: boolean;
  message?: string;
  questionId?: string | null;
  redirectTo?: string;
};

const OptimisticSessionActiveRuntime = dynamic(
  () =>
    import('@/components/session/session-active-runtime').then(
      (mod) => mod.SessionActiveRuntime,
    ),
  {
    ssr: false,
  },
);

function TakeOverStartResponsibilityForm({
  action,
  locale,
  sessionId,
  labels,
}: {
  action: ServerAction;
  locale: string;
  sessionId: string;
  labels: {
    takeOverStartResponsibility: string;
    takeOverStartResponsibilityPending: string;
  };
}) {
  return (
    <form action={action} className="w-full sm:w-auto">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <TakeOverStartResponsibilityButton labels={labels} />
    </form>
  );
}

function TakeOverStartResponsibilityButton({
  labels,
}: {
  labels: {
    takeOverStartResponsibility: string;
    takeOverStartResponsibilityPending: string;
  };
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-[13px] border border-brand/35 bg-brand/10 px-5 py-2.5 text-sm font-extrabold text-brand transition hover:bg-brand/15 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
    >
      {pending
        ? labels.takeOverStartResponsibilityPending
        : labels.takeOverStartResponsibility}
    </button>
  );
}

export function SessionStartRuntime({
  locale,
  sessionId,
  currentUserId,
  sessionTitle,
  sessionShareLabel,
  timerLabel,
  timerMode,
  timerSeconds,
  questionGoal,
  memberCount,
  canStartSession,
  canTakeOverStartResponsibility,
  canInviteTeammate,
  inviteTeammateDisabledReason = null,
  advanceAction,
  takeOverStartResponsibilityAction,
  labels,
}: SessionStartRuntimeProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<{
    questionId: string;
    answerDeadlineAt: string;
    startedAt: string;
  } | null>(null);

  if (activeQuestion) {
    return (
      <OptimisticSessionActiveRuntime
        advanceAction={advanceAction}
        locale={locale}
        sessionId={sessionId}
        currentUserId={currentUserId}
        questionId={activeQuestion.questionId}
        questionIndex={0}
        questionGoal={questionGoal}
        timerMode={timerMode}
        timerSeconds={timerSeconds}
        startedAt={activeQuestion.startedAt}
        canAdvanceQuestion={true}
        canTakeOverStartResponsibility={false}
        canInviteTeammate={canInviteTeammate}
        inviteTeammateDisabledReason={inviteTeammateDisabledReason}
        takeOverStartResponsibilityAction={takeOverStartResponsibilityAction}
        initialAnswer={null}
        initialConfidence={null as ConfidenceLevel | null}
        initialSubmittedCount={0}
        initialMemberCount={Math.max(memberCount, 1)}
        initialAnswerDeadlineAt={activeQuestion.answerDeadlineAt}
        labels={{
          questionUpper: labels.questionUpper,
          confidenceTitle: labels.confidenceTitle,
          confidenceLow: labels.confidenceLow,
          confidenceMedium: labels.confidenceMedium,
          confidenceHigh: labels.confidenceHigh,
          customOptionLabel: labels.customOptionLabel,
          customOptionPlaceholder: labels.customOptionPlaceholder,
          submit: labels.submit,
          submitPending: labels.submitPending,
          nextQuestion: labels.nextQuestion,
          nextQuestionPending: labels.nextQuestionPending,
          allAnswersReceived: labels.allAnswersReceived,
          waitingForCaptainAdvance: labels.waitingForCaptainAdvance,
          allAnswersSubmitted: labels.allAnswersSubmitted,
          questionsCompletedValue: labels.questionsCompletedValue,
          goToReview: labels.goToReview,
          takeOverStartResponsibility: labels.takeOverStartResponsibility,
          takeOverStartResponsibilityPending:
            labels.takeOverStartResponsibilityPending,
          currentStartResponsible: labels.currentStartResponsible,
          quitSession: labels.quitSession,
          quitPending: labels.quitPending,
          quitConfirm: labels.quitConfirm,
          inviteTeammate: labels.inviteTeammate,
        }}
      />
    );
  }

  return (
    <>
      <SessionStageRefresh sessionId={sessionId} expectedStatus="scheduled" />
      <div className="flex flex-1 items-center justify-center px-4 py-6">
        <section className="w-full max-w-[560px] rounded-[22px] border border-white/[0.06] bg-[#0b2a25] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <SessionDashboardBackButton
              locale={locale}
              label={labels.quitSession}
              variant="text"
              sessionId={sessionId}
              confirmLabels={labels.quitConfirm}
            />
            <p className="min-w-0 truncate rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1 text-xs font-bold text-[#8fa7a2]">
              {sessionShareLabel}
            </p>
          </div>

          <div className="mt-6 rounded-[16px] border border-white/[0.055] bg-[#061916]/70 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-brand/10 text-brand">
                <Play className="ml-0.5 h-6 w-6 fill-current" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-extrabold tracking-[-0.03em] text-white">
                  {sessionTitle}
                </h1>
                <p className="mt-1 text-sm font-semibold text-[#8fa7a2]">
                  {questionGoal} {labels.questionsUnit} | {timerLabel}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-[13px] border border-white/[0.055] bg-white/[0.018] px-3 py-3">
                <UsersRound className="h-4 w-4 text-brand" aria-hidden="true" />
                <p className="mt-2 text-xl font-extrabold text-white">
                  {memberCount}
                </p>
                <p className="text-xs font-semibold text-[#8fa7a2]">
                  {locale === 'fr' ? 'Participants' : 'Participants'}
                </p>
              </div>
              <div className="rounded-[13px] border border-white/[0.055] bg-white/[0.018] px-3 py-3">
                <CalendarClock className="h-4 w-4 text-brand" aria-hidden="true" />
                <p className="mt-2 text-xl font-extrabold text-white">
                  {timerMode === 'global'
                    ? locale === 'fr'
                      ? 'Mode examen'
                      : 'Exam mode'
                    : locale === 'fr'
                      ? 'Par question'
                      : 'Per question'}
                </p>
                <p className="text-xs font-semibold text-[#8fa7a2]">
                  {timerLabel}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled={isStarting || !canStartSession}
              onClick={() => {
                if (isStarting || !canStartSession) {
                  return;
                }

                setIsStarting(true);
                setErrorMessage(null);
                const startedAt = performance.now();
                window.sessionStorage.setItem(
                  'activeboard:session-flow-active',
                  '1',
                );
                window.dispatchEvent(
                  new CustomEvent('activeboard:session-flow-started'),
                );
                window.dispatchEvent(
                  new CustomEvent('activeboard:session-starting'),
                );
                void fetch(`/api/sessions/${sessionId}/start`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  credentials: 'same-origin',
                  cache: 'no-store',
                  body: JSON.stringify({ locale }),
                })
                  .then(async (response) => {
                    const payload = (await response
                      .json()
                      .catch(() => null)) as StartSessionResponse | null;

                    if (
                      response.ok &&
                      payload?.ok !== false &&
                      payload?.questionId
                    ) {
                      const now = Date.now();
                      const startedAtIso = new Date(now).toISOString();
                      const answerDeadlineAt = new Date(
                        now + timerSeconds * 1000,
                      ).toISOString();
                      console.info(
                        `[perf] startSession:api ${Math.round(performance.now() - startedAt)}ms`,
                      );
                      setActiveQuestion({
                        questionId: payload.questionId,
                        answerDeadlineAt,
                        startedAt: startedAtIso,
                      });
                      window.history.replaceState(
                        null,
                        '',
                        `/${locale}/sessions/${sessionId}?q=0`,
                      );
                      window.setTimeout(() => router.refresh(), 0);
                      return;
                    }

                    if (payload?.redirectTo) {
                      router.replace(payload.redirectTo as never);
                      return;
                    }

                    window.sessionStorage.removeItem(
                      'activeboard:session-flow-active',
                    );
                    setErrorMessage(
                      payload?.message ?? labels.startSessionPending,
                    );
                    setIsStarting(false);
                  })
                  .catch(() => {
                    window.sessionStorage.removeItem(
                      'activeboard:session-flow-active',
                    );
                    setErrorMessage(labels.startSessionPending);
                    setIsStarting(false);
                  });
              }}
              className="button-primary min-h-12 flex-1 rounded-[13px] px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
              aria-busy={isStarting}
            >
              {isStarting ? labels.startSessionPending : labels.startSession}
            </button>
            {canTakeOverStartResponsibility ? (
              <TakeOverStartResponsibilityForm
                action={takeOverStartResponsibilityAction}
                locale={locale}
                sessionId={sessionId}
                labels={labels}
              />
            ) : null}
            {canInviteTeammate ? (
              <SessionInviteTeammateButton
                locale={locale}
                sessionId={sessionId}
                labels={labels.inviteTeammate}
                disabledReason={inviteTeammateDisabledReason}
              />
            ) : null}
          </div>
          {!canStartSession ? (
            <p className="mt-3 text-sm font-semibold text-[#8fa7a2]">
              {labels.currentStartResponsible}
            </p>
          ) : null}
          {errorMessage ? (
            <p className="mt-3 text-sm font-semibold text-rose-300">
              {errorMessage}
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}
