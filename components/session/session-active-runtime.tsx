'use client';

import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { SessionAnswerForm, SessionHeaderMeta } from '@/components/session/session-flow-client';
import { Link } from '@/i18n/navigation';
import type { ConfidenceLevel } from '@/lib/demo/confidence';

type ServerAction = (formData: FormData) => void | Promise<void>;

type SessionActiveRuntimeProps = {
  sessionId: string;
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
  action: ServerAction;
  timeoutAction: ServerAction;
  advanceAction: ServerAction;
};

type RuntimePayload = {
  ok: boolean;
  sessionStatus: string;
  questionId: string | null;
  questionPhase: string | null;
  answerDeadlineAt: string | null;
  submittedCount: number;
  memberCount: number;
};

const POLL_INTERVAL_MS = 1800;

export function SessionActiveRuntime({
  sessionId,
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
  action,
  timeoutAction,
  advanceAction,
}: SessionActiveRuntimeProps) {
  const router = useRouter();
  const [submittedCount, setSubmittedCount] = useState(initialSubmittedCount);
  const [memberCount, setMemberCount] = useState(initialMemberCount);
  const [answerDeadlineAt, setAnswerDeadlineAt] = useState(initialAnswerDeadlineAt);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    setSubmittedCount(initialSubmittedCount);
    setMemberCount(initialMemberCount);
    setAnswerDeadlineAt(initialAnswerDeadlineAt);
    setIsSubmitting(false);
    refreshInFlightRef.current = false;
  }, [initialAnswerDeadlineAt, initialMemberCount, initialSubmittedCount, questionId]);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    const syncRuntime = async () => {
      if (document.visibilityState !== 'visible' || refreshInFlightRef.current || isSubmitting) {
        return;
      }

      refreshInFlightRef.current = true;

      try {
        const response = await fetch(`/api/sessions/${sessionId}/runtime?questionId=${encodeURIComponent(questionId)}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });

        if (!response.ok || cancelled) {
          return;
        }

        const payload = (await response.json()) as RuntimePayload;

        if (
          payload.sessionStatus !== 'active' ||
          payload.questionId !== questionId ||
          payload.questionPhase !== 'answering'
        ) {
          router.refresh();
          return;
        }

        setSubmittedCount(payload.submittedCount);
        setMemberCount(Math.max(payload.memberCount, 1));
        setAnswerDeadlineAt(payload.answerDeadlineAt);
      } catch {
        // Keep the current UI state and wait for the next sync attempt.
      } finally {
        refreshInFlightRef.current = false;
      }
    };

    const startPolling = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }

      if (document.visibilityState !== 'visible') {
        intervalId = null;
        return;
      }

      intervalId = window.setInterval(() => {
        void syncRuntime();
      }, POLL_INTERVAL_MS);
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
      if (intervalId !== null) {
        window.clearInterval(intervalId);
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
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{labels.questionUpper}</p>
            <p className="text-xl font-extrabold text-white">
              {questionIndex + 1}
              <span className="text-sm text-slate-500">/{questionGoal}</span>
            </p>
          </div>
          <SessionHeaderMeta submittedCount={submittedCount} memberCount={memberCount} answerDeadlineAt={answerDeadlineAt} />
        </div>
      </header>

      <section className="mx-auto w-full max-w-[560px] px-4 py-7">
        <SessionAnswerForm
          key={questionId}
          action={action}
          timeoutAction={timeoutAction}
          advanceAction={advanceAction}
          locale={locale}
          sessionId={sessionId}
          questionId={questionId}
          questionIndex={questionIndex}
          initialAnswer={initialAnswer}
          initialConfidence={initialConfidence}
          answerDeadlineAt={answerDeadlineAt}
          submittedCount={submittedCount}
          memberCount={memberCount}
          onSubmissionStateChange={setIsSubmitting}
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
