'use client';

import { Play } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { SessionDashboardBackButton } from '@/components/session/session-dashboard-back-button';
import { SessionStageRefresh } from '@/components/session/session-stage-refresh';
import type { ConfidenceLevel } from '@/lib/demo/confidence';

type ServerAction = (formData: FormData) => void | Promise<void>;

type SessionStartRuntimeProps = {
  locale: string;
  sessionId: string;
  sessionTitle: string;
  sessionShareCode: string;
  sessionShareLabel: string;
  timerLabel: string;
  timerMode: 'per_question' | 'global';
  timerSeconds: number;
  questionGoal: number;
  memberCount: number;
  advanceAction: ServerAction;
  labels: {
    questionsUnit: string;
    startSession: string;
    startSessionPending: string;
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
    allAnswersSubmitted: string;
    questionsCompletedValue: string;
    goToReview: string;
    quitPending: string;
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

export function SessionStartRuntime({
  locale,
  sessionId,
  sessionTitle,
  sessionShareCode,
  sessionShareLabel,
  timerLabel,
  timerMode,
  timerSeconds,
  questionGoal,
  memberCount,
  advanceAction,
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
        sessionShareCode={sessionShareCode}
        questionId={activeQuestion.questionId}
        questionIndex={0}
        questionGoal={questionGoal}
        timerMode={timerMode}
        timerSeconds={timerSeconds}
        startedAt={activeQuestion.startedAt}
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
          allAnswersSubmitted: labels.allAnswersSubmitted,
          questionsCompletedValue: labels.questionsCompletedValue,
          goToReview: labels.goToReview,
          quitSession: labels.quitSession,
          quitPending: labels.quitPending,
        }}
      />
    );
  }

  return (
    <>
      <SessionStageRefresh sessionId={sessionId} expectedStatus="scheduled" />
      <div className="flex flex-1 items-center justify-center px-4">
        <section className="flex w-full max-w-md flex-col items-center text-center">
          <div className="bg-brand/10 flex h-16 w-16 items-center justify-center rounded-full text-brand">
            <Play className="ml-1 h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-8 text-2xl font-extrabold text-white">
            {sessionTitle}
          </h1>
          <p className="mt-3 text-lg font-medium text-slate-400">
            {questionGoal} {labels.questionsUnit} | {timerLabel}
          </p>
          <p className="mt-4 text-sm font-bold text-slate-500">
            {sessionShareLabel}
          </p>
          <div className="mt-7">
            <button
              type="button"
              disabled={isStarting}
              onClick={() => {
                if (isStarting) {
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
              className="button-primary rounded-[7px] px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
              aria-busy={isStarting}
            >
              <span className="mr-2" aria-hidden="true">
                {'>'}
              </span>
              {isStarting ? labels.startSessionPending : labels.startSession}
            </button>
          </div>
          {errorMessage ? (
            <p className="mt-3 text-sm font-semibold text-rose-300">
              {errorMessage}
            </p>
          ) : null}
          <SessionDashboardBackButton
            locale={locale}
            label={labels.quitSession}
            variant="text"
          />
        </section>
      </div>
    </>
  );
}
