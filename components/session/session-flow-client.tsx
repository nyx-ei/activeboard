'use client';

import { Check, Clock, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { SubmitButton } from '@/components/ui/submit-button';
import type { ConfidenceLevel } from '@/lib/demo/confidence';
import { ANSWER_OPTIONS, type AnswerOption } from '@/lib/types/demo';

type ServerAction = (formData: FormData) => void | Promise<void>;

export function SessionHeaderMeta({
  submittedCount,
  memberCount,
  answerDeadlineAt,
}: {
  submittedCount: number;
  memberCount: number;
  answerDeadlineAt: string | null;
}) {
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    answerDeadlineAt ? Math.max(0, Math.ceil((new Date(answerDeadlineAt).getTime() - Date.now()) / 1000)) : 0,
  );
  const displaySubmittedCount = remainingSeconds <= 0 ? memberCount : submittedCount;
  const isComplete = displaySubmittedCount >= memberCount;

  useEffect(() => {
    if (!answerDeadlineAt) return undefined;
    const id = window.setInterval(() => {
      setRemainingSeconds(Math.max(0, Math.ceil((new Date(answerDeadlineAt).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [answerDeadlineAt]);

  return (
    <div className="flex items-center gap-3 text-xs font-bold">
      <span className={isComplete ? 'inline-flex items-center gap-1 text-brand' : 'inline-flex items-center gap-1 text-slate-500'}>
        <Users className="h-4 w-4" aria-hidden="true" />
        {displaySubmittedCount}/{memberCount}
        {isComplete ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
      </span>
      <span className={remainingSeconds <= 10 ? 'inline-flex items-center gap-1 text-red-400' : 'inline-flex items-center gap-1 text-brand'}>
        <Clock className="h-4 w-4" aria-hidden="true" />
        {remainingSeconds}s
      </span>
    </div>
  );
}

export function SessionAnswerForm({
  action,
  timeoutAction,
  advanceAction,
  locale,
  sessionId,
  questionId,
  questionIndex,
  initialAnswer,
  initialConfidence,
  answerDeadlineAt,
  submittedCount,
  memberCount,
  labels,
}: {
  action: ServerAction;
  timeoutAction: ServerAction;
  advanceAction: ServerAction;
  locale: string;
  sessionId: string;
  questionId: string;
  questionIndex: number;
  initialAnswer?: string | null;
  initialConfidence?: ConfidenceLevel | null;
  answerDeadlineAt: string | null;
  submittedCount: number;
  memberCount: number;
  labels: {
    confidenceTitle: string;
    confidenceLow: string;
    confidenceMedium: string;
    confidenceHigh: string;
    submit: string;
    submitPending: string;
    nextQuestion: string;
    nextQuestionPending: string;
    allAnswersReceived: string;
  };
}) {
  const [selectedOption, setSelectedOption] = useState(initialAnswer ?? '');
  const [confidence, setConfidence] = useState<ConfidenceLevel | ''>(initialConfidence ?? '');
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    answerDeadlineAt ? Math.max(0, Math.ceil((new Date(answerDeadlineAt).getTime() - Date.now()) / 1000)) : 0,
  );
  const router = useRouter();
  const timeoutFormRef = useRef<HTMLFormElement>(null);
  const timeoutSubmittedRef = useRef(false);
  const hasAnswer = Boolean(initialAnswer);
  const isExpired = remainingSeconds <= 0;
  const hasAllAnswers = submittedCount >= memberCount || isExpired;
  const canSubmit = Boolean(selectedOption && confidence) && !hasAnswer && !isExpired;

  useEffect(() => {
    setSelectedOption(initialAnswer ?? '');
    setConfidence(initialConfidence ?? '');
    setRemainingSeconds(
      answerDeadlineAt ? Math.max(0, Math.ceil((new Date(answerDeadlineAt).getTime() - Date.now()) / 1000)) : 0,
    );
    timeoutSubmittedRef.current = false;
  }, [answerDeadlineAt, initialAnswer, initialConfidence, questionId]);

  useEffect(() => {
    if (!answerDeadlineAt) return undefined;

    const tick = () => {
      const nextRemaining = Math.max(0, Math.ceil((new Date(answerDeadlineAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(nextRemaining);
      if (nextRemaining <= 0 && !hasAnswer && !timeoutSubmittedRef.current) {
        timeoutSubmittedRef.current = true;
        timeoutFormRef.current?.requestSubmit();
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [answerDeadlineAt, hasAnswer]);

  useEffect(() => {
    if (!hasAnswer || hasAllAnswers) return undefined;
    const id = window.setInterval(() => {
      router.refresh();
    }, 2500);
    return () => window.clearInterval(id);
  }, [hasAnswer, hasAllAnswers, router]);

  return (
    <div className="mx-auto w-full max-w-[496px] space-y-7">
      <form ref={timeoutFormRef} action={timeoutAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="questionIndex" value={questionIndex} />
      </form>

      <div className="grid grid-cols-6 gap-2">
        {[...ANSWER_OPTIONS, '?'].map((option) => (
          <label
            key={option}
            className={`flex h-16 items-center justify-center rounded-[7px] border text-xl font-extrabold transition ${
              hasAnswer || isExpired ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
            } ${
              selectedOption === option
                ? 'border-brand bg-brand text-white shadow-[0_0_18px_rgba(16,185,129,0.25)]'
                : 'border-white/[0.08] bg-[#111827] text-slate-400 hover:border-brand/50'
            }`}
          >
            <input
              type="radio"
              name="selectedOption"
              value={option}
              checked={selectedOption === option}
              onChange={() => setSelectedOption(option)}
              disabled={hasAnswer || isExpired}
              className="sr-only"
            />
            {option}
          </label>
        ))}
      </div>

      <div>
        <p className="mb-3 text-sm font-bold text-slate-400">{labels.confidenceTitle}</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['low', labels.confidenceLow],
            ['medium', labels.confidenceMedium],
            ['high', labels.confidenceHigh],
          ].map(([value, label]) => (
            <label
              key={value}
              className={`flex h-11 items-center justify-center rounded-[7px] border text-sm font-bold transition ${
                hasAnswer || isExpired ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
              } ${
                confidence === value
                  ? value === 'medium'
                    ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                    : 'border-brand/40 bg-brand/10 text-brand'
                  : 'border-white/[0.08] bg-[#0f1628] text-slate-500 hover:border-brand/40'
              }`}
            >
              <input
                type="radio"
                name="confidence"
                value={value}
                checked={confidence === value}
                onChange={() => setConfidence(value as ConfidenceLevel)}
                disabled={hasAnswer || isExpired}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {!hasAnswer && canSubmit ? (
        <form action={action}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="questionId" value={questionId} />
          <input type="hidden" name="questionIndex" value={questionIndex} />
          <input type="hidden" name="selectedOption" value={selectedOption} />
          <input type="hidden" name="confidence" value={confidence} />
          <SubmitButton pendingLabel={labels.submitPending} className="button-primary h-16 w-full rounded-[7px] text-base">
            {labels.submit}
          </SubmitButton>
        </form>
      ) : null}

      {hasAllAnswers ? (
        <>
          <div className="text-center text-sm font-bold text-brand">{labels.allAnswersReceived}</div>
          <form action={advanceAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="sessionId" value={sessionId} />
            <input type="hidden" name="questionIndex" value={questionIndex} />
            <SubmitButton
              pendingLabel={labels.nextQuestionPending}
              className="h-10 w-full rounded-[7px] bg-[#223047] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#2a3a55]"
            >
              {labels.nextQuestion} <span aria-hidden="true">›</span>
            </SubmitButton>
          </form>
        </>
      ) : null}
    </div>
  );
}

export function ReviewAnswerForm({
  action,
  locale,
  sessionId,
  questionId,
  questionIndex,
  nextQuestionIndex,
  isLastQuestion,
  initialCorrectOption,
  labels,
}: {
  action: ServerAction;
  locale: string;
  sessionId: string;
  questionId: string;
  questionIndex: number;
  nextQuestionIndex: number;
  isLastQuestion: boolean;
  initialCorrectOption?: AnswerOption | null;
  labels: {
    correctAnswer: string;
    save: string;
    update: string;
    saveAndNext: string;
    updateAndNext: string;
    savePending: string;
  };
}) {
  const [correctOption, setCorrectOption] = useState<AnswerOption | ''>(initialCorrectOption ?? '');
  const canSubmit = Boolean(correctOption) && correctOption !== initialCorrectOption;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="questionId" value={questionId} />
      <input type="hidden" name="questionIndex" value={questionIndex} />
      <input type="hidden" name="nextQuestionIndex" value={nextQuestionIndex} />
      <input type="hidden" name="advanceAfterSave" value={isLastQuestion ? 'false' : 'true'} />
      <input type="hidden" name="correctOption" value={correctOption} />
      <p className="text-sm font-bold text-slate-300">{labels.correctAnswer}</p>
      <div className="grid grid-cols-6 gap-2">
        {[...ANSWER_OPTIONS, '?'].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              if (option !== '?') setCorrectOption(option as AnswerOption);
            }}
            className={`h-11 rounded-[7px] border text-base font-extrabold transition ${
              correctOption === option
                ? 'border-brand bg-brand text-white'
                : 'border-white/[0.08] bg-[#202b3e] text-slate-300 hover:border-brand/50'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <SubmitButton
        pendingLabel={labels.savePending}
        className="button-primary h-10 w-full rounded-[7px] py-2 text-sm disabled:bg-brand/40 disabled:text-white/60"
        disabled={!canSubmit}
      >
        {isLastQuestion
          ? initialCorrectOption
            ? labels.update
            : labels.save
          : initialCorrectOption
            ? labels.updateAndNext
            : labels.saveAndNext}
      </SubmitButton>
    </form>
  );
}
