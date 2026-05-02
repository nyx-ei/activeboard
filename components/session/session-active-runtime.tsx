'use client';

import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { fetchSessionRuntime } from '@/components/session/runtime-client';
import { SessionDashboardBackButton } from '@/components/session/session-dashboard-back-button';
import {
  SessionAnswerForm,
  SessionHeaderMeta,
} from '@/components/session/session-flow-client';
import { SessionQuitButton } from '@/components/session/session-quit-button';
import { Link } from '@/i18n/navigation';
import type { ConfidenceLevel } from '@/lib/demo/confidence';

type ServerAction = (formData: FormData) => void | Promise<void>;

type SessionActiveRuntimeProps = {
  sessionId: string;
  sessionShareCode: string;
  questionId: string;
  questionIndex: number;
  questionGoal: number;
  timerMode: 'per_question' | 'global';
  timerSeconds: number;
  startedAt: string | null;
  initialSubmittedCount: number;
  initialMemberCount: number;
  initialAnswerDeadlineAt: string | null;
  initialAnswer?: string | null;
  initialConfidence?: ConfidenceLevel | null;
  locale: string;
  labels: {
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
    quitSession: string;
    quitPending: string;
  };
  advanceAction: ServerAction;
};

const BASE_POLL_INTERVAL_MS = 5000;
const ANSWERED_POLL_INTERVAL_MS = 7000;
const READY_POLL_INTERVAL_MS = 2500;

export function SessionActiveRuntime({
  sessionId,
  sessionShareCode,
  questionId,
  questionIndex,
  questionGoal,
  timerMode,
  timerSeconds,
  startedAt,
  initialSubmittedCount,
  initialMemberCount,
  initialAnswerDeadlineAt,
  initialAnswer,
  initialConfidence,
  locale,
  labels,
  advanceAction,
}: SessionActiveRuntimeProps) {
  const router = useRouter();
  const [runtimeQuestionId, setRuntimeQuestionId] = useState<string | null>(
    questionId,
  );
  const [runtimeQuestionIndex, setRuntimeQuestionIndex] =
    useState(questionIndex);
  const [submittedCount, setSubmittedCount] = useState(initialSubmittedCount);
  const [memberCount, setMemberCount] = useState(initialMemberCount);
  const [answerDeadlineAt, setAnswerDeadlineAt] = useState(
    initialAnswerDeadlineAt,
  );
  const [currentAnswer, setCurrentAnswer] = useState(initialAnswer ?? null);
  const [currentConfidence, setCurrentConfidence] = useState(
    initialConfidence ?? null,
  );
  const [showCompletion, setShowCompletion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const refreshInFlightRef = useRef(false);
  const answeredLocallyRef = useRef(Boolean(initialAnswer));
  const submittedCountRef = useRef(initialSubmittedCount);
  const memberCountRef = useRef(initialMemberCount);
  const currentAnswerRef = useRef<string | null>(initialAnswer ?? null);

  useEffect(() => {
    setRuntimeQuestionId(questionId);
    setRuntimeQuestionIndex(questionIndex);
    setSubmittedCount(initialSubmittedCount);
    setMemberCount(initialMemberCount);
    setAnswerDeadlineAt(initialAnswerDeadlineAt);
    setCurrentAnswer(initialAnswer ?? null);
    setCurrentConfidence(initialConfidence ?? null);
    setShowCompletion(false);
    setIsSubmitting(false);
    refreshInFlightRef.current = false;
    answeredLocallyRef.current = Boolean(initialAnswer);
    submittedCountRef.current = initialSubmittedCount;
    memberCountRef.current = initialMemberCount;
    currentAnswerRef.current = initialAnswer ?? null;
  }, [
    initialAnswer,
    initialAnswerDeadlineAt,
    initialConfidence,
    initialMemberCount,
    initialSubmittedCount,
    questionId,
    questionIndex,
  ]);

  useEffect(() => {
    submittedCountRef.current = submittedCount;
  }, [submittedCount]);

  useEffect(() => {
    memberCountRef.current = memberCount;
  }, [memberCount]);

  useEffect(() => {
    currentAnswerRef.current = currentAnswer;
  }, [currentAnswer]);

  const getOptimisticDeadline = () => {
    const now = Date.now();
    if (timerMode === 'global') {
      const startedAtMs = startedAt ? new Date(startedAt).getTime() : now;
      return new Date(startedAtMs + timerSeconds * 1000).toISOString();
    }

    return new Date(now + timerSeconds * 1000).toISOString();
  };

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;

    const getPollDelay = () => {
      if (submittedCountRef.current >= Math.max(memberCountRef.current, 1)) {
        return READY_POLL_INTERVAL_MS;
      }

      if (currentAnswerRef.current) {
        return ANSWERED_POLL_INTERVAL_MS;
      }

      return BASE_POLL_INTERVAL_MS;
    };

    const syncRuntime = async () => {
      if (
        document.visibilityState !== 'visible' ||
        refreshInFlightRef.current ||
        isSubmitting
      ) {
        return;
      }

      refreshInFlightRef.current = true;

      try {
        if (!runtimeQuestionId) {
          return;
        }

        const payload = await fetchSessionRuntime(
          `/api/sessions/${sessionId}/runtime?questionId=${encodeURIComponent(runtimeQuestionId)}`,
        );

        if (!payload || cancelled) {
          return;
        }

        if (
          payload.sessionStatus !== 'active' ||
          payload.questionId !== runtimeQuestionId ||
          payload.questionPhase !== 'answering'
        ) {
          router.refresh();
          return;
        }

        const nextSubmittedCount = payload.submittedCount ?? 0;
        setSubmittedCount((current) => {
          const localFloor = currentAnswerRef.current
            ? Math.max(current, submittedCountRef.current)
            : 0;
          const resolvedCount = Math.max(nextSubmittedCount, localFloor);
          submittedCountRef.current = resolvedCount;
          return resolvedCount;
        });
        setMemberCount(Math.max(payload.memberCount ?? 0, 1));
        setAnswerDeadlineAt(payload.answerDeadlineAt ?? null);
      } catch {
        // Keep the current UI state and wait for the next sync attempt.
      } finally {
        refreshInFlightRef.current = false;
      }
    };

    const startPolling = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      if (document.visibilityState !== 'visible') {
        timeoutId = null;
        return;
      }

      timeoutId = window.setTimeout(() => {
        void syncRuntime().finally(() => {
          if (!cancelled) {
            startPolling();
          }
        });
      }, getPollDelay());
    };

    startPolling();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncRuntime();
      }
      startPolling();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isSubmitting, router, runtimeQuestionId, sessionId]);

  if (showCompletion) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <section className="flex w-full max-w-md flex-col items-center text-center">
          <div className="bg-brand/10 flex h-16 w-16 items-center justify-center rounded-full text-brand">
            <Check className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-8 text-2xl font-extrabold text-white">
            {labels.allAnswersSubmitted}
          </h1>
          <p className="mt-3 text-lg font-medium text-slate-400">
            {labels.questionsCompletedValue}
          </p>
          <Link
            href={`/sessions/${sessionId}?stage=review`}
            prefetch={false}
            className="button-primary mt-7 rounded-[7px] px-5 py-2.5 text-sm"
          >
            {labels.goToReview} <span aria-hidden="true">{'>'}</span>
          </Link>
          <div className="mt-4">
            <SessionQuitButton
              locale={locale}
              sessionId={sessionId}
              label={labels.quitSession}
              pendingLabel={labels.quitPending}
            />
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      <header className="border-b border-white/[0.07]">
        <div className="mx-auto flex min-h-16 w-full max-w-[560px] items-center justify-between gap-3 px-4 py-3 sm:h-16 sm:py-0">
          <SessionDashboardBackButton
            locale={locale}
            label={labels.quitSession}
          />
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-extrabold uppercase tracking-[0.18em] text-white sm:text-base">
              {sessionShareCode}
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {labels.questionUpper} {runtimeQuestionIndex + 1}/{questionGoal}
              </span>
            </div>
          </div>
          <SessionHeaderMeta
            submittedCount={submittedCount}
            memberCount={memberCount}
            answerDeadlineAt={answerDeadlineAt}
          />
        </div>
      </header>

      <section className="mx-auto w-full max-w-[560px] px-4 py-7">
        <SessionAnswerForm
          key={runtimeQuestionIndex}
          advanceAction={advanceAction}
          locale={locale}
          sessionId={sessionId}
          questionId={runtimeQuestionId}
          questionIndex={runtimeQuestionIndex}
          initialAnswer={currentAnswer}
          initialConfidence={currentConfidence}
          answerDeadlineAt={answerDeadlineAt}
          submittedCount={submittedCount}
          memberCount={memberCount}
          onSubmissionStateChange={setIsSubmitting}
          onAnswerPersisted={(
            savedAnswer,
            savedConfidence,
            savedQuestionId,
          ) => {
            if (!answeredLocallyRef.current) {
              answeredLocallyRef.current = true;
              setSubmittedCount((current) => {
                const nextCount = Math.min(
                  Math.max(memberCount, 1),
                  current + 1,
                );
                submittedCountRef.current = nextCount;
                return nextCount;
              });
            }
            setCurrentAnswer(savedAnswer);
            setCurrentConfidence(savedConfidence);
            if (!runtimeQuestionId && savedQuestionId) {
              setRuntimeQuestionId(savedQuestionId);
            }
            currentAnswerRef.current = savedAnswer;
            setIsSubmitting(false);
          }}
          onQuestionAdvanceRequested={() => {
            const nextIndex = runtimeQuestionIndex + 1;
            if (nextIndex >= questionGoal) {
              setShowCompletion(true);
              setIsSubmitting(false);
              window.history.replaceState(
                null,
                '',
                `/${locale}/sessions/${sessionId}?stage=complete`,
              );
              return;
            }

            setRuntimeQuestionId(null);
            setRuntimeQuestionIndex(nextIndex);
            setAnswerDeadlineAt(getOptimisticDeadline());
            setSubmittedCount(0);
            submittedCountRef.current = 0;
            setCurrentAnswer(null);
            setCurrentConfidence(null);
            currentAnswerRef.current = null;
            answeredLocallyRef.current = false;
            refreshInFlightRef.current = false;
            setIsSubmitting(false);
            window.history.replaceState(
              null,
              '',
              `/${locale}/sessions/${sessionId}?q=${nextIndex}`,
            );
          }}
          onQuestionAdvanced={(nextQuestion) => {
            const hasLocalAnswer = Boolean(currentAnswerRef.current);
            setRuntimeQuestionId(nextQuestion.questionId);
            setRuntimeQuestionIndex(nextQuestion.questionIndex);
            setAnswerDeadlineAt(nextQuestion.answerDeadlineAt);
            if (!hasLocalAnswer) {
              setSubmittedCount(0);
              submittedCountRef.current = 0;
              setCurrentAnswer(null);
              setCurrentConfidence(null);
              currentAnswerRef.current = null;
              answeredLocallyRef.current = false;
            }
            refreshInFlightRef.current = false;
            setIsSubmitting(false);
            window.history.replaceState(null, '', nextQuestion.href);
          }}
          onSessionCompleted={(href) => {
            setShowCompletion(true);
            setIsSubmitting(false);
            window.history.replaceState(null, '', href);
          }}
          onQuestionAdvanceFailed={() => {
            setShowCompletion(false);
          }}
          labels={{
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
          }}
        />
      </section>
    </>
  );
}
