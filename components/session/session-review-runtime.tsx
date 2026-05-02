'use client';

import { BarChart3 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { SessionDashboardBackButton } from '@/components/session/session-dashboard-back-button';
import { SessionFinishReviewButton } from '@/components/session/session-finish-review-button';
import { ReviewAnswerForm } from '@/components/session/session-flow-client';
import type {
  CertaintyCorrectnessStatus,
  ConfidenceLevel,
} from '@/lib/demo/confidence';
import { ANSWER_OPTIONS, type AnswerOption } from '@/lib/types/demo';

type ReviewAnswer = {
  id: string;
  question_id?: string;
  user_id: string;
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
};

type ReviewPayload = {
  question: ReviewQuestion;
  answers: ReviewAnswer[];
  reviewedQuestionCount: number;
};

type SessionReviewRuntimeProps = {
  locale: string;
  sessionId: string;
  sessionTitle: string;
  userId: string;
  questionGoal: number;
  memberCount: number;
  initialQuestionIndex: number;
  initialReviewedQuestionCount: number;
  initialQuestion: ReviewQuestion;
  initialAnswers: ReviewAnswer[];
  labels: {
    reviewShort: string;
    previous: string;
    next: string;
    questionUpper: string;
    distribution: string;
    finishSession: string;
    finishSessionPending: string;
    correctAnswer: string;
    save: string;
    update: string;
    saveAndNext: string;
    updateAndNext: string;
    savePending: string;
    reviewStatus: Record<CertaintyCorrectnessStatus, string>;
  };
};

function getDistribution(
  answers: Array<{ selected_option: string | null }>,
  memberCount: number,
) {
  const distribution = new Map<string, number>();
  for (const option of [...ANSWER_OPTIONS, '?']) {
    distribution.set(option, 0);
  }

  for (const answer of answers) {
    const option = (answer.selected_option ?? '?').toUpperCase();
    const normalizedOption = ANSWER_OPTIONS.includes(option as AnswerOption)
      ? option
      : '?';
    distribution.set(
      normalizedOption,
      (distribution.get(normalizedOption) ?? 0) + 1,
    );
  }

  const submitted = answers.length;
  distribution.set(
    '?',
    Math.max(distribution.get('?') ?? 0, Math.max(0, memberCount - submitted)),
  );
  return distribution;
}

export function SessionReviewRuntime({
  locale,
  sessionId,
  sessionTitle,
  userId,
  questionGoal,
  memberCount,
  initialQuestionIndex,
  initialReviewedQuestionCount,
  initialQuestion,
  initialAnswers,
  labels,
}: SessionReviewRuntimeProps) {
  const [currentIndex, setCurrentIndex] = useState(initialQuestionIndex);
  const [reviewedQuestionCount, setReviewedQuestionCount] = useState(
    initialReviewedQuestionCount,
  );
  const [cache, setCache] = useState<Record<number, ReviewPayload>>({
    [initialQuestionIndex]: {
      question: initialQuestion,
      answers: initialAnswers,
      reviewedQuestionCount: initialReviewedQuestionCount,
    },
  });
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const currentPayload = cache[currentIndex];
  const currentQuestion = currentPayload?.question ?? initialQuestion;
  const currentAnswers = currentPayload?.answers ?? initialAnswers;
  const distribution = useMemo(
    () => getDistribution(currentAnswers, memberCount),
    [currentAnswers, memberCount],
  );
  const myReviewAnswer =
    currentAnswers.find((answer) => answer.user_id === userId) ?? null;
  const isLastQuestion = currentIndex >= questionGoal - 1;
  const isFirstQuestion = currentIndex <= 0;
  const canFinish = reviewedQuestionCount >= questionGoal;

  const loadQuestion = useCallback(
    async (targetIndex: number, makeCurrent: boolean) => {
      const clampedIndex = Math.max(
        0,
        Math.min(targetIndex, Math.max(questionGoal - 1, 0)),
      );
      if (cache[clampedIndex]) {
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
            answers: payload.answers,
            reviewedQuestionCount: payload.reviewedQuestionCount,
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
    void loadQuestion(currentIndex + 1, false);
    void loadQuestion(currentIndex - 1, false);
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
          },
        },
      };
    });
  };

  return (
    <main className="flex flex-1 flex-col">
      <header className="bg-background/95 sticky top-0 z-20 border-b border-white/[0.07] backdrop-blur">
        <div className="mx-auto flex min-h-10 w-full max-w-[700px] items-center gap-2 px-4 py-1 sm:grid sm:min-h-16 sm:grid-cols-[40px_minmax(0,1fr)_40px] sm:gap-3 sm:py-0">
          <SessionDashboardBackButton locale={locale} label={sessionTitle} />
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

        <section className="surface-mockup p-3 sm:p-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-brand" aria-hidden="true" />
            <h2 className="text-sm font-extrabold text-white">
              {labels.distribution}
            </h2>
          </div>
          <div className="mt-2 grid grid-cols-6 gap-1.5 sm:hidden">
            {[...ANSWER_OPTIONS, '?'].map((option) => (
              <div
                key={option}
                className={`inline-flex min-h-7 items-center justify-center rounded-[7px] border px-1 text-center text-[10px] font-semibold ${
                  currentQuestion.correct_option === option
                    ? 'border-brand/35 bg-brand/10 text-brand'
                    : 'border-white/[0.08] bg-[#121b2e] text-slate-400'
                }`}
              >
                {option}-{distribution.get(option) ?? 0}
              </div>
            ))}
          </div>
          <div className="mt-8 hidden grid-cols-3 gap-x-2 gap-y-4 min-[420px]:grid-cols-6 sm:grid">
            {[...ANSWER_OPTIONS, '?'].map((option) => (
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
                  {option}
                  {currentQuestion.correct_option === option ? ' *' : ''}
                </span>
                <span className="text-xs font-bold text-slate-600">
                  {distribution.get(option) ?? 0}
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
              onSaved={markCurrentQuestionSaved}
              onAdvance={moveToQuestion}
              labels={{
                correctAnswer: labels.correctAnswer,
                save: labels.save,
                update: labels.update,
                saveAndNext: labels.saveAndNext,
                updateAndNext: labels.updateAndNext,
                savePending: labels.savePending,
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
            label={labels.finishSession}
            pendingLabel={labels.finishSessionPending}
          />
        ) : null}
      </section>
    </main>
  );
}
