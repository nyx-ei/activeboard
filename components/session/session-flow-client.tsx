'use client';

import { Check, Clock, Users } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { SubmitButton } from '@/components/ui/submit-button';
import {
  getCertaintyCorrectnessStatus,
  getCertaintyCorrectnessTone,
  type CertaintyCorrectnessStatus,
  type ConfidenceLevel,
} from '@/lib/demo/confidence';
import { ANSWER_OPTIONS, type AnswerOption } from '@/lib/types/demo';

type ServerAction = (formData: FormData) => void | Promise<void>;
type SubmitAnswerResponse = {
  ok: boolean;
  message?: string;
  redirectTo?: string;
  selectedOption?: string | null;
  confidence?: ConfidenceLevel | null;
};

function isCustomLetter(value: string) {
  return /^[A-Z]$/.test(value) && !ANSWER_OPTIONS.includes(value as AnswerOption);
}

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
  onSubmissionStateChange,
  onAnswerPersisted,
  labels,
}: {
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
  onSubmissionStateChange?: (isSubmitting: boolean) => void;
  onAnswerPersisted?: (selectedOption: string, confidence: ConfidenceLevel | null) => void;
  labels: {
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
}) {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const initialSelectedOption =
    initialAnswer && !ANSWER_OPTIONS.includes(initialAnswer as AnswerOption) && initialAnswer !== '?'
      ? '?'
      : (initialAnswer ?? '');
  const initialCustomOption =
    initialAnswer && !ANSWER_OPTIONS.includes(initialAnswer as AnswerOption) && initialAnswer !== '?'
      ? initialAnswer.toUpperCase()
      : '';
  const [selectedOption, setSelectedOption] = useState(initialSelectedOption);
  const [customOption, setCustomOption] = useState(initialCustomOption);
  const [confidence, setConfidence] = useState<ConfidenceLevel | ''>(initialConfidence ?? '');
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    answerDeadlineAt ? Math.max(0, Math.ceil((new Date(answerDeadlineAt).getTime() - Date.now()) / 1000)) : 0,
  );
  const customOptionInputRef = useRef<HTMLInputElement>(null);
  const timeoutSubmittedRef = useRef(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const hasAnswer = Boolean(initialAnswer);
  const isExpired = remainingSeconds <= 0;
  const hasAllAnswers = submittedCount >= memberCount || isExpired;
  const normalizedCustomOption = customOption.trim().toUpperCase();
  const canSubmit =
    Boolean(selectedOption && confidence) &&
    (selectedOption !== '?' || isCustomLetter(normalizedCustomOption)) &&
    !hasAnswer &&
    !isExpired;

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    setSelectedOption(
      initialAnswer && !ANSWER_OPTIONS.includes(initialAnswer as AnswerOption) && initialAnswer !== '?'
        ? '?'
        : (initialAnswer ?? ''),
    );
    setCustomOption(
      initialAnswer && !ANSWER_OPTIONS.includes(initialAnswer as AnswerOption) && initialAnswer !== '?'
        ? initialAnswer.toUpperCase()
        : '',
    );
    setConfidence(initialConfidence ?? '');
    setRemainingSeconds(
      answerDeadlineAt ? Math.max(0, Math.ceil((new Date(answerDeadlineAt).getTime() - Date.now()) / 1000)) : 0,
    );
    setSubmissionError(null);
    setIsPending(false);
    timeoutSubmittedRef.current = false;
  }, [answerDeadlineAt, initialAnswer, initialConfidence, questionId]);

  useEffect(() => {
    if (!hasAnswer) {
      onSubmissionStateChange?.(false);
    }
  }, [hasAnswer, onSubmissionStateChange, questionId]);

  const submitAnswer = useCallback(async (mode: 'submit' | 'timeout') => {
    setSubmissionError(null);
    setIsPending(true);
    onSubmissionStateChange?.(true);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          locale,
          sessionId,
          questionId,
          questionIndex,
          selectedOption,
          customOption: normalizedCustomOption,
          confidence,
          mode,
        }),
      });

      const payload = (await response.json().catch(() => ({ ok: false }))) as SubmitAnswerResponse;

      if (!response.ok || !payload.ok) {
        if (payload.redirectTo) {
          router.replace(payload.redirectTo as never);
          return;
        }

        setSubmissionError(payload.message ?? labels.submitPending);
        setIsPending(false);
        onSubmissionStateChange?.(false);
        return;
      }

      onAnswerPersisted?.(payload.selectedOption ?? '?', payload.confidence ?? null);
    } catch {
      setSubmissionError(labels.submitPending);
      setIsPending(false);
      onSubmissionStateChange?.(false);
    }
  }, [
    confidence,
    labels.submitPending,
    locale,
    normalizedCustomOption,
    onAnswerPersisted,
    onSubmissionStateChange,
    questionId,
    questionIndex,
    router,
    selectedOption,
    sessionId,
  ]);

  useEffect(() => {
    if (selectedOption === '?' && !hasAnswer && !isExpired) {
      customOptionInputRef.current?.focus();
      customOptionInputRef.current?.select();
    }
  }, [selectedOption, hasAnswer, isExpired]);

  useEffect(() => {
    if (!answerDeadlineAt) return undefined;

    const tick = () => {
      const nextRemaining = Math.max(0, Math.ceil((new Date(answerDeadlineAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(nextRemaining);
      if (nextRemaining <= 0 && !hasAnswer && !timeoutSubmittedRef.current) {
        timeoutSubmittedRef.current = true;
        void submitAnswer('timeout');
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [answerDeadlineAt, hasAnswer, submitAnswer]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (hasAnswer || isExpired) {
        return;
      }

      const key = event.key.toUpperCase();
      if (selectedOption === '?' && /^[A-Z]$/.test(key)) {
        event.preventDefault();
        setCustomOption(ANSWER_OPTIONS.includes(key as AnswerOption) ? '' : key);
        return;
      }

      if (ANSWER_OPTIONS.includes(key as AnswerOption)) {
        event.preventDefault();
        setSelectedOption(key);
        setCustomOption('');
        return;
      }

      if (event.key === '?') {
        event.preventDefault();
        setSelectedOption('?');
        return;
      }

      if (event.key === '1') {
        event.preventDefault();
        setConfidence('low');
        return;
      }

      if (event.key === '2') {
        event.preventDefault();
        setConfidence('medium');
        return;
      }

      if (event.key === '3') {
        event.preventDefault();
        setConfidence('high');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasAnswer, isExpired, selectedOption]);

  return (
    <div className="mx-auto w-full max-w-[496px] space-y-7">
      <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-6">
        {[...ANSWER_OPTIONS, '?'].map((option) => (
          <label
            key={option}
            className={`flex h-14 items-center justify-center rounded-[7px] border text-lg font-extrabold transition min-[420px]:h-16 min-[420px]:text-xl ${
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
              onChange={() => {
                setSelectedOption(option);
                if (option !== '?') {
                  setCustomOption('');
                }
              }}
              disabled={hasAnswer || isExpired || isPending}
              className="sr-only"
            />
            {option}
          </label>
        ))}
      </div>

      {selectedOption === '?' ? (
        <div className="space-y-2">
          <label htmlFor="custom-option" className="block text-sm font-bold text-slate-300">
            {labels.customOptionLabel}
          </label>
          <input
            ref={customOptionInputRef}
            id="custom-option"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={1}
            value={customOption}
            onChange={(event) => {
              const nextValue = event.target.value.replace(/[^a-z]/gi, '').slice(-1).toUpperCase();
              setCustomOption(ANSWER_OPTIONS.includes(nextValue as AnswerOption) ? '' : nextValue);
            }}
            disabled={hasAnswer || isExpired || isPending}
            placeholder={labels.customOptionPlaceholder}
            className="field w-full rounded-[7px] text-center text-lg font-extrabold uppercase tracking-[0.12em]"
          />
        </div>
      ) : null}

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
                disabled={hasAnswer || isExpired || isPending}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {!hasAnswer && canSubmit ? (
        <button
          type="button"
          disabled={isPending || !isHydrated}
          onClick={() => {
            void submitAnswer('submit');
          }}
          className="button-primary relative h-16 w-full rounded-[7px] text-base disabled:cursor-not-allowed disabled:opacity-70"
          aria-disabled={isPending || !isHydrated}
          aria-busy={isPending}
        >
          <span className={isPending ? 'text-transparent' : ''}>{labels.submit}</span>
          {isPending ? (
            <span className="absolute inset-0 inline-flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
              {labels.submitPending}
            </span>
          ) : null}
        </button>
      ) : null}

      {submissionError ? <p className="text-center text-sm font-bold text-red-400">{submissionError}</p> : null}

      {hasAllAnswers ? (
        <>
          <div className="text-center text-sm font-bold text-brand">{labels.allAnswersReceived}</div>
          <form
            action={advanceAction}
            onSubmitCapture={() => {
              onSubmissionStateChange?.(true);
            }}
          >
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
  participantAnswer,
  participantConfidence,
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
  participantAnswer?: string | null;
  participantConfidence?: ConfidenceLevel | null;
  labels: {
    correctAnswer: string;
    save: string;
    update: string;
    saveAndNext: string;
    updateAndNext: string;
    savePending: string;
    reviewStatus: Record<CertaintyCorrectnessStatus, string>;
  };
}) {
  const [correctOption, setCorrectOption] = useState<AnswerOption | ''>(initialCorrectOption ?? '');
  const canSubmit = Boolean(correctOption) && correctOption !== initialCorrectOption;
  const hasCorrectOption = Boolean(correctOption);
  const normalizedParticipantAnswer = participantAnswer?.toUpperCase() ?? '?';
  const isCorrect = hasCorrectOption ? normalizedParticipantAnswer === correctOption : null;
  const reviewStatus = hasCorrectOption ? getCertaintyCorrectnessStatus(participantConfidence, isCorrect) : null;
  const reviewStatusTone = reviewStatus ? getCertaintyCorrectnessTone(reviewStatus) : null;
  const reviewStatusDotClass =
    reviewStatusTone === 'positive' ? 'bg-brand' : reviewStatusTone === 'warning' ? 'bg-orange-400' : 'bg-sky-400';
  const reviewStatusCardClass =
    reviewStatusTone === 'positive'
      ? 'border-brand/30 bg-brand/10 text-brand'
      : reviewStatusTone === 'warning'
        ? 'border-orange-400/30 bg-orange-400/10 text-orange-300'
        : 'border-sky-400/30 bg-sky-400/10 text-sky-300';
  const reviewTrace = hasCorrectOption
    ? `${normalizedParticipantAnswer} ${isCorrect ? '✓' : '×'} → ${correctOption}`
    : '';

  useEffect(() => {
    setCorrectOption(initialCorrectOption ?? '');
  }, [initialCorrectOption, questionId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const key = event.key.toUpperCase();
      if (ANSWER_OPTIONS.includes(key as AnswerOption)) {
        event.preventDefault();
        setCorrectOption(key as AnswerOption);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-6">
        {[...ANSWER_OPTIONS, '?'].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              if (option !== '?') setCorrectOption(option as AnswerOption);
            }}
            className={`h-11 w-full rounded-[7px] border text-base font-extrabold transition ${
              correctOption === option
                ? 'border-brand bg-brand text-white'
                : 'border-white/[0.08] bg-[#202b3e] text-slate-300 hover:border-brand/50'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      {reviewStatus ? (
        <section className={`rounded-[7px] border px-4 py-3 ${reviewStatusCardClass}`}>
          <div className="flex items-start gap-3">
            <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${reviewStatusDotClass}`} aria-hidden="true" />
            <div>
              <p className="text-sm font-extrabold">{labels.reviewStatus[reviewStatus]}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{reviewTrace}</p>
            </div>
          </div>
        </section>
      ) : null}
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
