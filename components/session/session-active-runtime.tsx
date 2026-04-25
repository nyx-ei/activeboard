'use client';

import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { fetchSessionRuntime } from '@/components/session/runtime-client';
import { SessionAnswerForm, SessionHeaderMeta } from '@/components/session/session-flow-client';
import { Link } from '@/i18n/navigation';
import type { ConfidenceLevel } from '@/lib/demo/confidence';

type ServerAction = (formData: FormData) => void | Promise<void>;

type SessionActiveRuntimeProps = {
  sessionId: string;
  sessionShareCode: string;
  questionId: string;
  questionIndex: number;
  questionGoal: number;
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
  };
  advanceAction: ServerAction;
};

const BASE_POLL_INTERVAL_MS = 1800;
const ANSWERED_POLL_INTERVAL_MS = 2600;
const READY_POLL_INTERVAL_MS = 900;

export function SessionActiveRuntime({
  sessionId,
  sessionShareCode,
  questionId,
  questionIndex,
  questionGoal,
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
  const [submittedCount, setSubmittedCount] = useState(initialSubmittedCount);
  const [memberCount, setMemberCount] = useState(initialMemberCount);
  const [answerDeadlineAt, setAnswerDeadlineAt] = useState(initialAnswerDeadlineAt);
  const [currentAnswer, setCurrentAnswer] = useState(initialAnswer ?? null);
  const [currentConfidence, setCurrentConfidence] = useState(initialConfidence ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const refreshInFlightRef = useRef(false);
  const answeredLocallyRef = useRef(Boolean(initialAnswer));
  const submittedCountRef = useRef(initialSubmittedCount);
  const memberCountRef = useRef(initialMemberCount);
  const currentAnswerRef = useRef<string | null>(initialAnswer ?? null);

  useEffect(() => {
    setSubmittedCount(initialSubmittedCount);
    setMemberCount(initialMemberCount);
    setAnswerDeadlineAt(initialAnswerDeadlineAt);
    setCurrentAnswer(initialAnswer ?? null);
    setCurrentConfidence(initialConfidence ?? null);
    setIsSubmitting(false);
    refreshInFlightRef.current = false;
    answeredLocallyRef.current = Boolean(initialAnswer);
    submittedCountRef.current = initialSubmittedCount;
    memberCountRef.current = initialMemberCount;
    currentAnswerRef.current = initialAnswer ?? null;
  }, [initialAnswer, initialAnswerDeadlineAt, initialConfidence, initialMemberCount, initialSubmittedCount, questionId]);

  useEffect(() => {
    submittedCountRef.current = submittedCount;
  }, [submittedCount]);

  useEffect(() => {
    memberCountRef.current = memberCount;
  }, [memberCount]);

  useEffect(() => {
    currentAnswerRef.current = currentAnswer;
  }, [currentAnswer]);

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
      if (document.visibilityState !== 'visible' || refreshInFlightRef.current || isSubmitting) {
        return;
      }

      refreshInFlightRef.current = true;

      try {
        const payload = await fetchSessionRuntime(
          `/api/sessions/${sessionId}/runtime?questionId=${encodeURIComponent(questionId)}`,
        );

        if (!payload || cancelled) {
          return;
        }

        if (
          payload.sessionStatus !== 'active' ||
          payload.questionId !== questionId ||
          payload.questionPhase !== 'answering'
        ) {
          router.refresh();
          return;
        }

        setSubmittedCount(payload.submittedCount ?? 0);
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

    void syncRuntime();
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
  }, [isSubmitting, questionId, router, sessionId]);

  return (
    <>
      <header className="border-b border-white/[0.07]">
        <div className="mx-auto flex min-h-16 w-full max-w-[560px] items-center justify-between gap-3 px-4 py-3 sm:h-16 sm:py-0">
          <Link href="/dashboard?view=sessions" prefetch={false} className="text-slate-500 hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-extrabold uppercase tracking-[0.18em] text-white sm:text-base">{sessionShareCode}</p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {labels.questionUpper} {questionIndex + 1}/{questionGoal}
              </span>
            </div>
          </div>
          <SessionHeaderMeta submittedCount={submittedCount} memberCount={memberCount} answerDeadlineAt={answerDeadlineAt} />
        </div>
      </header>

      <section className="mx-auto w-full max-w-[560px] px-4 py-7">
        <SessionAnswerForm
          key={questionId}
          advanceAction={advanceAction}
          locale={locale}
          sessionId={sessionId}
          questionId={questionId}
          questionIndex={questionIndex}
          initialAnswer={currentAnswer}
          initialConfidence={currentConfidence}
          answerDeadlineAt={answerDeadlineAt}
          submittedCount={submittedCount}
          memberCount={memberCount}
          onSubmissionStateChange={setIsSubmitting}
          onAnswerPersisted={(savedAnswer, savedConfidence) => {
            if (!answeredLocallyRef.current) {
              answeredLocallyRef.current = true;
              setSubmittedCount((current) => {
                const nextCount = Math.min(Math.max(memberCount, 1), current + 1);
                submittedCountRef.current = nextCount;
                return nextCount;
              });
            }
            setCurrentAnswer(savedAnswer);
            setCurrentConfidence(savedConfidence);
            currentAnswerRef.current = savedAnswer;
            setIsSubmitting(false);
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
