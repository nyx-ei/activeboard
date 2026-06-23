'use client';

import { BarChart3 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { SessionDashboardBackButton } from '@/components/session/session-dashboard-back-button';
import { SessionFinishReviewButton } from '@/components/session/session-finish-review-button';
import { ReviewAnswerForm } from '@/components/session/session-flow-client';
import type { SessionLeaveConfirmLabels } from '@/components/session/session-leave-confirm-dialog';
import type {
  CertaintyCorrectnessStatus,
  ConfidenceLevel,
} from '@/lib/demo/confidence';
import {
  ANSWER_OPTIONS,
  type AnswerOption,
  type AnswerState,
} from '@/lib/types/demo';

type ReviewOwnAnswer = {
  answer_state?: AnswerState | null;
  selected_option: string | null;
  confidence: string | null;
  is_correct: boolean | null;
  answered_at: string | null;
};

type ReviewQuestion = {
  id: string;
  body: string | null;
  options: unknown;
  order_index: number;
  phase: string | null;
  launched_at: string | null;
  answer_deadline_at: string | null;
  correct_option?: string | null;
  review_version?: number;
};

type ReviewPayload = {
  question: ReviewQuestion;
  distribution: ReviewDistribution;
  ownAnswer: ReviewOwnAnswer | null;
  reviewedQuestionCount: number;
  reviewVersion?: number;
};

type ReviewDistribution = {
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
  blank: number;
  skipped: number;
};

type SessionReviewRuntimeProps = {
  locale: string;
  sessionId: string;
  groupId: string;
  sessionTitle: string;
  questionGoal: number;
  timerMode: 'per_question' | 'global';
  initialQuestionIndex: number;
  initialReviewedQuestionCount: number;
  initialQuestion: ReviewQuestion;
  initialDistribution: ReviewDistribution;
  initialOwnAnswer: ReviewOwnAnswer | null;
  labels: {
    reviewShort: string;
    previous: string;
    next: string;
    questionUpper: string;
    distribution: string;
    skippedAnswer: string;
    finishSession: string;
    finishSessionPending: string;
    correctAnswer: string;
    save: string;
    update: string;
    saveAndNext: string;
    updateAndNext: string;
    savePending: string;
    saved: string;
    quitConfirm: SessionLeaveConfirmLabels;
    reviewLocked: string;
    reviewStatus: Record<CertaintyCorrectnessStatus, string>;
  };
};

const REVIEW_DISTRIBUTION_OPTIONS: Array<AnswerOption | '?' | 'skipped'> = [
  ...ANSWER_OPTIONS,
  '?',
  'skipped',
];

function formatSignedReviewTime(seconds: number) {
  const sign = seconds < 0 ? '-' : '';
  const safeSeconds = Math.abs(seconds);
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, '0');
  const remainingSeconds = Math.floor(safeSeconds % 60)
    .toString()
    .padStart(2, '0');

  return `${sign}${minutes}:${remainingSeconds}`;
}

function getDistributionCount(
  distribution: ReviewDistribution,
  option: AnswerOption | '?' | 'skipped',
) {
  if (option === '?') return distribution.blank;
  return distribution[option];
}

export function SessionReviewRuntime({
  locale,
  sessionId,
  groupId,
  sessionTitle,
  questionGoal,
  timerMode,
  initialQuestionIndex,
  initialReviewedQuestionCount,
  initialQuestion,
  initialDistribution,
  initialOwnAnswer,
  labels,
}: SessionReviewRuntimeProps) {
  const [currentIndex, setCurrentIndex] = useState(initialQuestionIndex);
  const [reviewedQuestionCount, setReviewedQuestionCount] = useState(
    initialReviewedQuestionCount,
  );
  const [cache, setCache] = useState<Record<number, ReviewPayload>>({
    [initialQuestionIndex]: {
      question: initialQuestion,
      distribution: initialDistribution,
      ownAnswer: initialOwnAnswer,
      reviewedQuestionCount: initialReviewedQuestionCount,
    },
  });
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const reviewTimerSeconds =
    timerMode === 'per_question' ? 180 : Math.max(60, questionGoal * 180);
  const [reviewElapsedSeconds, setReviewElapsedSeconds] = useState(0);
  const currentPayload = cache[currentIndex];
  const currentQuestion = currentPayload?.question ?? initialQuestion;
  const distribution = currentPayload?.distribution ?? initialDistribution;
  const myReviewAnswer = currentPayload?.ownAnswer ?? initialOwnAnswer;
  const isLastQuestion = currentIndex >= questionGoal - 1;
  const isFirstQuestion = currentIndex <= 0;
  const canFinish = reviewedQuestionCount >= questionGoal;
  const reviewRemainingSeconds = reviewTimerSeconds - reviewElapsedSeconds;
  const isReviewOvertime = reviewRemainingSeconds < 0;

  const loadQuestion = useCallback(
    async (targetIndex: number, makeCurrent: boolean, force = false) => {
      const clampedIndex = Math.max(
        0,
        Math.min(targetIndex, Math.max(questionGoal - 1, 0)),
      );
      if (cache[clampedIndex] && !force) {
        if (makeCurrent) {
          setCurrentIndex(clampedIndex);
          window.history.replaceState(
            null,
            '',
            `/${locale}/sessions/${sessionId}?stage=review&q=${clampedIndex}`,
          );
        }
        return;
      }

      if (makeCurrent) {
        setIsLoadingQuestion(true);
      }

      try {
        const response = await fetch(
          `/api/sessions/${sessionId}/review-question?q=${clampedIndex}`,
          {
            cache: 'no-store',
            credentials: 'same-origin',
          },
        );
        const payload = (await response.json().catch(() => null)) as
          | (ReviewPayload & { ok?: boolean })
          | null;

        if (!response.ok || !payload?.question) {
          return;
        }

        setCache((current) => ({
          ...current,
          [clampedIndex]: {
            question: payload.question,
            distribution: payload.distribution,
            ownAnswer: payload.ownAnswer,
            reviewedQuestionCount: payload.reviewedQuestionCount,
            reviewVersion: payload.reviewVersion,
          },
        }));
        setReviewedQuestionCount((current) =>
          Math.max(current, payload.reviewedQuestionCount),
        );

        if (makeCurrent) {
          setCurrentIndex(clampedIndex);
          window.history.replaceState(
            null,
            '',
            `/${locale}/sessions/${sessionId}?stage=review&q=${clampedIndex}`,
          );
        }
      } finally {
        if (makeCurrent) {
          setIsLoadingQuestion(false);
        }
      }
    },
    [cache, locale, questionGoal, sessionId],
  );

  useEffect(() => {
    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      setReviewElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    void loadQuestion(currentIndex + 1, false);
    void loadQuestion(currentIndex - 1, false);
  }, [currentIndex, loadQuestion]);

  useEffect(() => {
    const refetchCurrentQuestion = () => {
      void loadQuestion(currentIndex, false, true);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetchCurrentQuestion();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', refetchCurrentQuestion);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', refetchCurrentQuestion);
    };
  }, [currentIndex, loadQuestion]);

  const moveToQuestion = (targetIndex: number) => {
    void loadQuestion(targetIndex, true);
  };

  const markCurrentQuestionSaved = (correctOption: AnswerOption) => {
    setCache((current) => {
      const payload = current[currentIndex];
      if (!payload) {
        return current;
      }

      const wasAlreadyReviewed = Boolean(payload.question.correct_option);
      if (!wasAlreadyReviewed) {
        setReviewedQuestionCount((count) => Math.min(questionGoal, count + 1));
      }

      return {
        ...current,
        [currentIndex]: {
          ...payload,
          question: {
            ...payload.question,
            correct_option: correctOption,
            phase: 'review',
            review_version: (payload.question.review_version ?? 0) + 1,
          },
          ownAnswer: payload.ownAnswer
            ? {
                ...payload.ownAnswer,
                is_correct:
                  payload.ownAnswer.answer_state === 'submitted'
                    ? (
                        payload.ownAnswer.selected_option ?? ''
                      ).toUpperCase() === correctOption
                    : payload.ownAnswer.is_correct,
              }
            : null,
        },
      };
    });
  };

  return (
    <main className="flex flex-1 flex-col">
      <header className="bg-background/95 sticky top-0 z-20 border-b border-white/[0.07] backdrop-blur">
        <div className="mx-auto flex min-h-10 w-full max-w-[700px] items-center gap-2 px-4 py-1 sm:grid sm:min-h-16 sm:grid-cols-[40px_minmax(0,1fr)_40px] sm:gap-3 sm:py-0">
          <SessionDashboardBackButton
            locale={locale}
            label={sessionTitle}
            sessionId={sessionId}
            confirmLabels={labels.quitConfirm}
          />
          <div className="min-w-0 flex-1 sm:hidden">
            <p className="truncate text-xs font-semibold leading-tight text-white">
              {sessionTitle}
            </p>
            <p className="text-[10px] font-medium leading-tight text-slate-500">
              {labels.reviewShort}
            </p>
          </div>
          <p className="hidden min-w-0 flex-1 text-center text-base font-extrabold text-white sm:block sm:text-lg">
            {sessionTitle} - {labels.reviewShort}
          </p>
          <span aria-hidden="true" className="hidden sm:block" />
        </div>
      </header>

      <section className="mx-auto w-full max-w-[700px] space-y-2 px-4 py-2 sm:space-y-6 sm:py-7">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 sm:text-sm">
          {isFirstQuestion ? (
            <span className="opacity-40">
              {'<'} {labels.previous}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => moveToQuestion(currentIndex - 1)}
              className="hover:text-white"
            >
              {'<'} {labels.previous}
            </button>
          )}
          <h1 className="text-base font-semibold text-white sm:text-2xl sm:font-extrabold">
            <span className="sm:hidden">
              {currentIndex + 1}/{questionGoal}
            </span>
            <span className="hidden sm:inline">
              {labels.questionUpper} {currentIndex + 1}/{questionGoal}
            </span>
          </h1>
          {isLastQuestion ? (
            <span className="opacity-40">
              {labels.next} {'>'}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => moveToQuestion(currentIndex + 1)}
              className="hover:text-white"
            >
              {labels.next} {'>'}
            </button>
          )}
        </div>

        <div
          className={`flex items-center justify-between rounded-[10px] border px-3 py-2 text-xs font-bold sm:text-sm ${
            isReviewOvertime
              ? 'border-amber-300/30 bg-amber-300/10 text-amber-200'
              : 'border-brand/20 bg-brand/10 text-[#9FF0CE]'
          }`}
        >
          <span>{locale === 'fr' ? 'Temps de revue' : 'Review time'}</span>
          <span className="font-mono text-sm sm:text-base">
            {formatSignedReviewTime(reviewRemainingSeconds)}
          </span>
        </div>

        <section className="surface-mockup p-3 sm:p-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-brand" aria-hidden="true" />
            <h2 className="text-sm font-extrabold text-white">
              {labels.distribution}
            </h2>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5 min-[420px]:grid-cols-7 sm:hidden">
            {REVIEW_DISTRIBUTION_OPTIONS.map((option) => (
              <div
                key={option}
                className={`inline-flex min-h-7 items-center justify-center rounded-[7px] border px-1 text-center text-[10px] font-semibold ${
                  currentQuestion.correct_option === option
                    ? 'border-brand/35 bg-brand/10 text-brand'
                    : 'border-white/[0.08] bg-[#121b2e] text-slate-400'
                }`}
              >
                {option === 'skipped' ? labels.skippedAnswer : option}-
                {getDistributionCount(distribution, option)}
              </div>
            ))}
          </div>
          <div className="mt-8 hidden grid-cols-3 gap-x-2 gap-y-4 min-[420px]:grid-cols-7 sm:grid">
            {REVIEW_DISTRIBUTION_OPTIONS.map((option) => (
              <div
                key={option}
                className="flex w-full flex-col items-center gap-1 text-center"
              >
                <span
                  className={
                    currentQuestion.correct_option === option
                      ? 'text-sm font-extrabold text-brand'
                      : 'text-sm font-bold text-slate-500'
                  }
                >
                  {option === 'skipped' ? labels.skippedAnswer : option}
                  {currentQuestion.correct_option === option ? ' *' : ''}
                </span>
                <span className="text-xs font-bold text-slate-600">
                  {getDistributionCount(distribution, option)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-white/[0.06] pt-3 sm:mt-5 sm:pt-5">
            <ReviewAnswerForm
              key={currentQuestion.id}
              locale={locale}
              sessionId={sessionId}
              questionId={currentQuestion.id}
              questionIndex={currentIndex}
              nextQuestionIndex={Math.min(questionGoal - 1, currentIndex + 1)}
              isLastQuestion={isLastQuestion}
              initialCorrectOption={currentQuestion.correct_option as never}
              participantAnswer={myReviewAnswer?.selected_option}
              participantConfidence={
                myReviewAnswer?.confidence as ConfidenceLevel | null | undefined
              }
              timerMode={timerMode}
              onSaved={markCurrentQuestionSaved}
              onAdvance={moveToQuestion}
              labels={{
                correctAnswer: labels.correctAnswer,
                save: labels.save,
                update: labels.update,
                saveAndNext: labels.saveAndNext,
                updateAndNext: labels.updateAndNext,
                savePending: labels.savePending,
                saved: labels.saved,
                reviewLocked: labels.reviewLocked,
                reviewStatus: labels.reviewStatus,
              }}
            />
          </div>
        </section>

        {isLoadingQuestion ? (
          <p className="text-center text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {labels.savePending}
          </p>
        ) : null}

        {canFinish ? (
          <SessionFinishReviewButton
            locale={locale}
            sessionId={sessionId}
            groupId={groupId}
            questionGoal={questionGoal}
            label={labels.finishSession}
            pendingLabel={labels.finishSessionPending}
          />
        ) : null}
      </section>
    </main>
  );
}
