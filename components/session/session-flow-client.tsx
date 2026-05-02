'use client';

import { Check, Clock, Users } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { invalidateDashboardPayloadCache } from '@/components/dashboard/dashboard-data-cache';
import {
  getCertaintyCorrectnessStatus,
  getCertaintyCorrectnessTone,
  type CertaintyCorrectnessStatus,
  type ConfidenceLevel,
} from '@/lib/demo/confidence';
import { ANSWER_OPTIONS, type AnswerOption } from '@/lib/types/demo';

type ServerAction = (formData: FormData) => void | Promise<void>;
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type SubmitAnswerResponse = {
  ok: boolean;
  message?: string;
  redirectTo?: string;
  selectedOption?: string | null;
  confidence?: ConfidenceLevel | null;
  questionId?: string;
};
type AdvanceQuestionResponse = {
  ok?: boolean;
  message?: string;
  redirectTo?: string;
  questionId?: string;
  questionIndex?: number;
  answerDeadlineAt?: string | null;
};
type QueuedSaveRequest = {
  key: string;
  url: string;
  body: Record<string, unknown>;
  attempts: number;
  updatedAt: number;
};
type QueuedSaveResult<TPayload> =
  | { ok: true; payload: TPayload; elapsedMs: number }
  | { ok: false; message?: string; redirectTo?: string; elapsedMs: number };

const PENDING_SAVE_STORAGE_KEY = 'activeboard:pending-session-saves:v1';
const queuedSaveRequests = new Map<
  string,
  Promise<QueuedSaveResult<unknown>>
>();

function readPendingSaveRequests() {
  if (typeof window === 'undefined') {
    return [] as QueuedSaveRequest[];
  }

  try {
    const rawValue = window.localStorage.getItem(PENDING_SAVE_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(
      (item): item is QueuedSaveRequest =>
        Boolean(item) &&
        typeof item.key === 'string' &&
        typeof item.url === 'string' &&
        typeof item.body === 'object' &&
        item.body !== null &&
        typeof item.attempts === 'number' &&
        typeof item.updatedAt === 'number',
    );
  } catch {
    return [];
  }
}

function writePendingSaveRequests(requests: QueuedSaveRequest[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (requests.length === 0) {
      window.localStorage.removeItem(PENDING_SAVE_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      PENDING_SAVE_STORAGE_KEY,
      JSON.stringify(requests),
    );
  } catch {
    // The in-memory queue still protects the current interaction if storage is unavailable.
  }
}

function rememberPendingSave(request: QueuedSaveRequest) {
  const nextRequests = readPendingSaveRequests().filter(
    (item) => item.key !== request.key,
  );
  nextRequests.push(request);
  writePendingSaveRequests(nextRequests.slice(-25));
}

function forgetPendingSave(key: string) {
  writePendingSaveRequests(
    readPendingSaveRequests().filter((item) => item.key !== key),
  );
}

async function postQueuedSave<TPayload>(
  request: QueuedSaveRequest,
  parseFallback: () => TPayload,
): Promise<QueuedSaveResult<TPayload>> {
  const startedAt = performance.now();
  let lastMessage: string | undefined;
  let redirectTo: string | undefined;

  for (let attempt = request.attempts; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(request.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        cache: 'no-store',
        keepalive: true,
        body: JSON.stringify(request.body),
      });
      const payload = (await response
        .json()
        .catch(parseFallback)) as TPayload & {
        ok?: boolean;
        message?: string;
        redirectTo?: string;
      };

      if (response.ok && payload.ok !== false) {
        forgetPendingSave(request.key);
        invalidateDashboardPayloadCache();
        window.dispatchEvent(
          new CustomEvent('activeboard:dashboard-invalidate'),
        );
        const elapsedMs = Math.round(performance.now() - startedAt);
        console.info(`[perf] sessionSave:${request.key}:done ${elapsedMs}ms`);
        return { ok: true, payload, elapsedMs };
      }

      lastMessage = payload.message;
      redirectTo = payload.redirectTo;
      if (redirectTo) {
        forgetPendingSave(request.key);
        return {
          ok: false,
          message: lastMessage,
          redirectTo,
          elapsedMs: Math.round(performance.now() - startedAt),
        };
      }
    } catch {
      lastMessage = undefined;
    }

    rememberPendingSave({
      ...request,
      attempts: attempt + 1,
      updatedAt: Date.now(),
    });
    await new Promise((resolve) =>
      window.setTimeout(resolve, 350 * (attempt + 1)),
    );
  }

  const elapsedMs = Math.round(performance.now() - startedAt);
  console.info(`[perf] sessionSave:${request.key}:failed ${elapsedMs}ms`);
  return { ok: false, message: lastMessage, redirectTo, elapsedMs };
}

function enqueueSessionSave<TPayload>(
  request: Omit<QueuedSaveRequest, 'attempts' | 'updatedAt'>,
  parseFallback: () => TPayload,
) {
  const pendingRequest: QueuedSaveRequest = {
    ...request,
    attempts: 0,
    updatedAt: Date.now(),
  };
  const current = queuedSaveRequests.get(request.key) as
    | Promise<QueuedSaveResult<TPayload>>
    | undefined;
  if (current) {
    return current;
  }

  rememberPendingSave(pendingRequest);
  const queued = postQueuedSave(pendingRequest, parseFallback).finally(() => {
    queuedSaveRequests.delete(request.key);
  });
  queuedSaveRequests.set(
    request.key,
    queued as Promise<QueuedSaveResult<unknown>>,
  );
  return queued;
}

function flushPendingSessionSaves() {
  for (const request of readPendingSaveRequests()) {
    if (queuedSaveRequests.has(request.key)) {
      continue;
    }

    const queued = postQueuedSave(request, () => ({ ok: false })).finally(
      () => {
        queuedSaveRequests.delete(request.key);
      },
    );
    queuedSaveRequests.set(request.key, queued);
  }
}

function isCustomLetter(value: string) {
  return (
    /^[A-Z]$/.test(value) && !ANSWER_OPTIONS.includes(value as AnswerOption)
  );
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
    answerDeadlineAt
      ? Math.max(
          0,
          Math.ceil((new Date(answerDeadlineAt).getTime() - Date.now()) / 1000),
        )
      : 0,
  );
  const displaySubmittedCount =
    remainingSeconds <= 0 ? memberCount : submittedCount;
  const isComplete = displaySubmittedCount >= memberCount;

  useEffect(() => {
    if (!answerDeadlineAt) {
      setRemainingSeconds(0);
      return undefined;
    }

    const updateRemainingSeconds = () => {
      setRemainingSeconds(
        Math.max(
          0,
          Math.ceil((new Date(answerDeadlineAt).getTime() - Date.now()) / 1000),
        ),
      );
    };

    updateRemainingSeconds();
    const id = window.setInterval(updateRemainingSeconds, 1000);
    return () => window.clearInterval(id);
  }, [answerDeadlineAt]);

  return (
    <div className="flex items-center gap-3 text-xs font-bold">
      <span
        className={
          isComplete
            ? 'inline-flex items-center gap-1 text-brand'
            : 'inline-flex items-center gap-1 text-slate-500'
        }
      >
        <Users className="h-4 w-4" aria-hidden="true" />
        {displaySubmittedCount}/{memberCount}
        {isComplete ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
      </span>
      <span
        className={
          remainingSeconds <= 10
            ? 'inline-flex items-center gap-1 text-red-400'
            : 'inline-flex items-center gap-1 text-brand'
        }
      >
        <Clock className="h-4 w-4" aria-hidden="true" />
        {remainingSeconds}s
      </span>
    </div>
  );
}

export function SessionAnswerForm({
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
  onQuestionAdvanceRequested,
  onQuestionAdvanced,
  onSessionCompleted,
  onQuestionAdvanceFailed,
  labels,
}: {
  advanceAction: ServerAction;
  locale: string;
  sessionId: string;
  questionId: string | null;
  questionIndex: number;
  initialAnswer?: string | null;
  initialConfidence?: ConfidenceLevel | null;
  answerDeadlineAt: string | null;
  submittedCount: number;
  memberCount: number;
  onSubmissionStateChange?: (isSubmitting: boolean) => void;
  onAnswerPersisted?: (
    selectedOption: string,
    confidence: ConfidenceLevel | null,
    questionId?: string | null,
  ) => void;
  onQuestionAdvanceRequested?: () => void;
  onQuestionAdvanced?: (question: {
    questionId: string;
    questionIndex: number;
    answerDeadlineAt: string | null;
    href: string;
  }) => void;
  onSessionCompleted?: (href: string) => void;
  onQuestionAdvanceFailed?: () => void;
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
    initialAnswer &&
    !ANSWER_OPTIONS.includes(initialAnswer as AnswerOption) &&
    initialAnswer !== '?'
      ? '?'
      : (initialAnswer ?? '');
  const initialCustomOption =
    initialAnswer &&
    !ANSWER_OPTIONS.includes(initialAnswer as AnswerOption) &&
    initialAnswer !== '?'
      ? initialAnswer.toUpperCase()
      : '';
  const [selectedOption, setSelectedOption] = useState(initialSelectedOption);
  const [customOption, setCustomOption] = useState(initialCustomOption);
  const [confidence, setConfidence] = useState<ConfidenceLevel | ''>(
    initialConfidence ?? '',
  );
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    answerDeadlineAt
      ? Math.max(
          0,
          Math.ceil((new Date(answerDeadlineAt).getTime() - Date.now()) / 1000),
        )
      : 0,
  );
  const customOptionInputRef = useRef<HTMLInputElement>(null);
  const timeoutSubmittedRef = useRef(false);
  const optimisticPersistedRef = useRef(false);
  const activeSubmitPromiseRef = useRef<Promise<boolean> | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [advanceStatus, setAdvanceStatus] = useState<SaveStatus>('idle');
  const [optimisticAnswer, setOptimisticAnswer] = useState<string | null>(null);
  const isPending = saveStatus === 'saving';
  const hasAnswer = Boolean(initialAnswer || optimisticAnswer);
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
      initialAnswer &&
        !ANSWER_OPTIONS.includes(initialAnswer as AnswerOption) &&
        initialAnswer !== '?'
        ? '?'
        : (initialAnswer ?? ''),
    );
    setCustomOption(
      initialAnswer &&
        !ANSWER_OPTIONS.includes(initialAnswer as AnswerOption) &&
        initialAnswer !== '?'
        ? initialAnswer.toUpperCase()
        : '',
    );
    setConfidence(initialConfidence ?? '');
    setRemainingSeconds(
      answerDeadlineAt
        ? Math.max(
            0,
            Math.ceil(
              (new Date(answerDeadlineAt).getTime() - Date.now()) / 1000,
            ),
          )
        : 0,
    );
    setSubmissionError(null);
    setSaveStatus('idle');
    setAdvanceStatus('idle');
    setOptimisticAnswer(null);
    optimisticPersistedRef.current = false;
    activeSubmitPromiseRef.current = null;
    timeoutSubmittedRef.current = false;
  }, [answerDeadlineAt, initialAnswer, initialConfidence, questionIndex]);

  useEffect(() => {
    flushPendingSessionSaves();
  }, []);

  const submitAnswer = useCallback(
    async (mode: 'submit' | 'timeout') => {
      const resolvedSelectedOption =
        mode === 'timeout'
          ? '?'
          : selectedOption === '?'
            ? normalizedCustomOption
            : selectedOption;
      const resolvedConfidence = mode === 'timeout' ? null : confidence || null;
      const requestKey = `answer:${sessionId}:${questionId}:${resolvedSelectedOption}:${resolvedConfidence ?? 'none'}:${mode}`;

      if (
        mode === 'submit' &&
        (!resolvedSelectedOption || !resolvedConfidence)
      ) {
        return;
      }

      setSubmissionError(null);
      setSaveStatus('saving');
      onSubmissionStateChange?.(false);

      if (!optimisticPersistedRef.current) {
        optimisticPersistedRef.current = true;
        setOptimisticAnswer(resolvedSelectedOption);
        onAnswerPersisted?.(resolvedSelectedOption, resolvedConfidence);
      }

      const savePromise = enqueueSessionSave<SubmitAnswerResponse>(
        {
          key: requestKey,
          url: `/api/sessions/${sessionId}/answer`,
          body: {
            locale,
            sessionId,
            questionId,
            questionIndex,
            selectedOption,
            customOption: normalizedCustomOption,
            confidence,
            mode,
          },
        },
        () => ({ ok: false }),
      );
      activeSubmitPromiseRef.current = savePromise.then((result) => result.ok);
      const result = await savePromise;

      if (result.ok) {
        setSaveStatus('saved');
        onAnswerPersisted?.(
          result.payload.selectedOption ?? resolvedSelectedOption,
          result.payload.confidence ?? resolvedConfidence,
          result.payload.questionId ?? questionId,
        );
        activeSubmitPromiseRef.current = null;
        return;
      }

      if (result.redirectTo) {
        activeSubmitPromiseRef.current = null;
        router.replace(result.redirectTo as never);
        return;
      }

      activeSubmitPromiseRef.current = null;
      setSaveStatus('error');
      setSubmissionError(result.message ?? labels.submitPending);
    },
    [
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
    ],
  );

  const advanceToNextQuestion = useCallback(async () => {
    if (advanceStatus === 'saving') {
      return;
    }

    setSubmissionError(null);
    setAdvanceStatus('saving');
    onSubmissionStateChange?.(true);

    const activeSubmitPromise = activeSubmitPromiseRef.current;
    if (activeSubmitPromise) {
      const saveSucceeded = await activeSubmitPromise;
      if (!saveSucceeded) {
        setAdvanceStatus('error');
        setSubmissionError(labels.submitPending);
        onSubmissionStateChange?.(false);
        return;
      }
    }

    onQuestionAdvanceRequested?.();

    try {
      const response = await fetch(`/api/sessions/${sessionId}/advance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        credentials: 'same-origin',
        body: JSON.stringify({
          locale,
          questionIndex,
        }),
      });
      const payload = (await response
        .json()
        .catch(() => ({}))) as AdvanceQuestionResponse;

      if (
        payload.redirectTo &&
        typeof payload.questionId === 'string' &&
        typeof payload.questionIndex === 'number'
      ) {
        onQuestionAdvanced?.({
          questionId: payload.questionId,
          questionIndex: payload.questionIndex,
          answerDeadlineAt: payload.answerDeadlineAt ?? null,
          href: payload.redirectTo,
        });
        setAdvanceStatus('saved');
        return;
      }

      if (payload.redirectTo) {
        if (payload.redirectTo.includes('stage=complete')) {
          onSessionCompleted?.(payload.redirectTo);
          setAdvanceStatus('saved');
          return;
        }

        router.replace(payload.redirectTo as never);
        return;
      }

      if (!response.ok || payload.ok === false) {
        setAdvanceStatus('error');
        setSubmissionError(payload.message ?? labels.nextQuestionPending);
        onSubmissionStateChange?.(false);
        onQuestionAdvanceFailed?.();
        router.refresh();
        return;
      }

      setAdvanceStatus('saved');
    } catch {
      setAdvanceStatus('error');
      setSubmissionError(labels.nextQuestionPending);
      onSubmissionStateChange?.(false);
      onQuestionAdvanceFailed?.();
      router.refresh();
    }
  }, [
    advanceStatus,
    labels.nextQuestionPending,
    labels.submitPending,
    locale,
    onQuestionAdvanceRequested,
    onQuestionAdvanced,
    onQuestionAdvanceFailed,
    onSessionCompleted,
    onSubmissionStateChange,
    questionIndex,
    router,
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
      const nextRemaining = Math.max(
        0,
        Math.ceil((new Date(answerDeadlineAt).getTime() - Date.now()) / 1000),
      );
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
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (hasAnswer || isExpired) {
        return;
      }

      const key = event.key.toUpperCase();
      if (selectedOption === '?' && /^[A-Z]$/.test(key)) {
        event.preventDefault();
        setCustomOption(
          ANSWER_OPTIONS.includes(key as AnswerOption) ? '' : key,
        );
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
              hasAnswer || isExpired
                ? 'cursor-not-allowed opacity-70'
                : 'cursor-pointer'
            } ${
              selectedOption === option
                ? 'border-brand bg-brand text-white shadow-[0_0_18px_rgba(16,185,129,0.25)]'
                : 'hover:border-brand/50 border-white/[0.08] bg-[#111827] text-slate-400'
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
          <label
            htmlFor="custom-option"
            className="block text-sm font-bold text-slate-300"
          >
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
              const nextValue = event.target.value
                .replace(/[^a-z]/gi, '')
                .slice(-1)
                .toUpperCase();
              setCustomOption(
                ANSWER_OPTIONS.includes(nextValue as AnswerOption)
                  ? ''
                  : nextValue,
              );
            }}
            disabled={hasAnswer || isExpired || isPending}
            placeholder={labels.customOptionPlaceholder}
            className="field w-full rounded-[7px] text-center text-lg font-extrabold uppercase tracking-[0.12em]"
          />
        </div>
      ) : null}

      <div>
        <p className="mb-3 text-sm font-bold text-slate-400">
          {labels.confidenceTitle}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['low', labels.confidenceLow],
            ['medium', labels.confidenceMedium],
            ['high', labels.confidenceHigh],
          ].map(([value, label]) => (
            <label
              key={value}
              className={`flex h-11 items-center justify-center rounded-[7px] border text-sm font-bold transition ${
                hasAnswer || isExpired
                  ? 'cursor-not-allowed opacity-70'
                  : 'cursor-pointer'
              } ${
                confidence === value
                  ? value === 'medium'
                    ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                    : 'border-brand/40 bg-brand/10 text-brand'
                  : 'hover:border-brand/40 border-white/[0.08] bg-[#0f1628] text-slate-500'
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
          <span className={isPending ? 'text-transparent' : ''}>
            {labels.submit}
          </span>
          {isPending ? (
            <span className="absolute inset-0 inline-flex items-center justify-center gap-2">
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
              {labels.submitPending}
            </span>
          ) : null}
        </button>
      ) : null}

      {hasAnswer && saveStatus === 'saving' ? (
        <p className="text-center text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          {labels.submitPending}
        </p>
      ) : null}

      {hasAnswer && saveStatus === 'error' ? (
        <button
          type="button"
          disabled={!isHydrated}
          onClick={() => {
            void submitAnswer('submit');
          }}
          className="h-10 w-full rounded-[7px] border border-rose-400/30 bg-rose-400/10 text-sm font-extrabold text-rose-200 disabled:opacity-70"
        >
          {labels.submit}
        </button>
      ) : null}

      {submissionError ? (
        <p className="text-center text-sm font-bold text-red-400">
          {submissionError}
        </p>
      ) : null}

      {hasAllAnswers ? (
        <>
          <div className="text-center text-sm font-bold text-brand">
            {labels.allAnswersReceived}
          </div>
          <button
            type="button"
            disabled={advanceStatus === 'saving'}
            onClick={() => {
              void advanceToNextQuestion();
            }}
            className="relative h-10 w-full rounded-[7px] bg-[#223047] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#2a3a55] disabled:cursor-not-allowed disabled:opacity-70"
            aria-busy={advanceStatus === 'saving'}
          >
            <span
              className={advanceStatus === 'saving' ? 'text-transparent' : ''}
            >
              {labels.nextQuestion} <span aria-hidden="true">&gt;</span>
            </span>
            {advanceStatus === 'saving' ? (
              <span className="absolute inset-0 inline-flex items-center justify-center gap-2">
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden="true"
                />
                {labels.nextQuestionPending}
              </span>
            ) : null}
          </button>
        </>
      ) : null}
    </div>
  );
}

export function ReviewAnswerForm({
  locale,
  sessionId,
  questionId,
  questionIndex,
  nextQuestionIndex,
  isLastQuestion,
  initialCorrectOption,
  participantAnswer,
  participantConfidence,
  onSaved,
  onAdvance,
  labels,
}: {
  locale: string;
  sessionId: string;
  questionId: string;
  questionIndex: number;
  nextQuestionIndex: number;
  isLastQuestion: boolean;
  initialCorrectOption?: AnswerOption | null;
  participantAnswer?: string | null;
  participantConfidence?: ConfidenceLevel | null;
  onSaved?: (correctOption: AnswerOption) => void;
  onAdvance?: (targetQuestionIndex: number) => void;
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
  const router = useRouter();
  const [correctOption, setCorrectOption] = useState<AnswerOption | ''>(
    initialCorrectOption ?? '',
  );
  const [savedCorrectOption, setSavedCorrectOption] = useState<
    AnswerOption | ''
  >(initialCorrectOption ?? '');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const isPending = saveStatus === 'saving';
  const canSubmit =
    Boolean(correctOption) && correctOption !== savedCorrectOption;
  const hasCorrectOption = Boolean(correctOption);
  const normalizedParticipantAnswer = participantAnswer?.toUpperCase() ?? '?';
  const isCorrect = hasCorrectOption
    ? normalizedParticipantAnswer === correctOption
    : null;
  const reviewStatus = hasCorrectOption
    ? getCertaintyCorrectnessStatus(participantConfidence, isCorrect)
    : null;
  const reviewStatusTone = reviewStatus
    ? getCertaintyCorrectnessTone(reviewStatus)
    : null;
  const reviewStatusDotClass =
    reviewStatusTone === 'positive'
      ? 'bg-brand'
      : reviewStatusTone === 'warning'
        ? 'bg-orange-400'
        : 'bg-sky-400';
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
    setSavedCorrectOption(initialCorrectOption ?? '');
    setSaveStatus('idle');
    setSubmissionError(null);
  }, [initialCorrectOption, questionId]);

  useEffect(() => {
    flushPendingSessionSaves();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
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

  async function saveReviewAnswer() {
    if (!canSubmit || isPending) {
      return;
    }

    const nextCorrectOption = correctOption as AnswerOption;
    const shouldAdvance = !isLastQuestion;
    const targetQuestionIndex = shouldAdvance
      ? nextQuestionIndex
      : questionIndex;
    const redirectTo = `/${locale}/sessions/${sessionId}?stage=review&q=${targetQuestionIndex}`;
    setSubmissionError(null);
    setSaveStatus('saving');
    setSavedCorrectOption(nextCorrectOption);
    onSaved?.(nextCorrectOption);

    const savePromise = enqueueSessionSave<{
      ok?: boolean;
      message?: string;
      redirectTo?: string;
      correctOption?: string;
      targetQuestionIndex?: number;
    }>(
      {
        key: `review:${sessionId}:${questionId}:${nextCorrectOption}`,
        url: `/api/sessions/${sessionId}/review-answer`,
        body: {
          locale,
          questionId,
          questionIndex,
          nextQuestionIndex,
          advanceAfterSave: shouldAdvance,
          correctOption: nextCorrectOption,
        },
      },
      () => ({ ok: false }),
    );

    if (shouldAdvance) {
      onAdvance?.(targetQuestionIndex);
      if (!onAdvance) {
        router.replace(redirectTo as never);
      }
      void savePromise;
      return;
    }

    const result = await savePromise;

    if (result.ok) {
      setSaveStatus('saved');
      return;
    }

    if (result.redirectTo) {
      router.replace(result.redirectTo as never);
      return;
    }

    setSavedCorrectOption(initialCorrectOption ?? '');
    onSaved?.((initialCorrectOption ?? '') as AnswerOption);
    setSaveStatus('error');
    setSubmissionError(result.message ?? labels.savePending);
  }

  return (
    <div className="space-y-2.5 sm:space-y-4">
      <p className="text-xs font-bold text-slate-300 sm:text-sm">
        {labels.correctAnswer}
      </p>
      <div className="grid grid-cols-3 gap-1.5 min-[420px]:grid-cols-6 sm:gap-2">
        {[...ANSWER_OPTIONS, '?'].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              if (option !== '?') setCorrectOption(option as AnswerOption);
            }}
            className={`h-9 w-full rounded-[7px] border text-sm font-extrabold transition sm:h-11 sm:text-base ${
              correctOption === option
                ? 'border-brand bg-brand text-white'
                : 'hover:border-brand/50 border-white/[0.08] bg-[#202b3e] text-slate-300'
            }`}
            disabled={false}
          >
            {option}
          </button>
        ))}
      </div>
      {reviewStatus ? (
        <section
          className={`rounded-[7px] border px-3 py-2 sm:px-4 sm:py-3 ${reviewStatusCardClass}`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`mt-1 h-3 w-3 shrink-0 rounded-full ${reviewStatusDotClass}`}
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-extrabold">
                {labels.reviewStatus[reviewStatus]}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {reviewTrace}
              </p>
            </div>
          </div>
        </section>
      ) : null}
      <button
        type="button"
        className="button-primary disabled:bg-brand/40 relative h-9 w-full rounded-[7px] py-2 text-sm disabled:cursor-not-allowed disabled:text-white/60 disabled:opacity-70 sm:h-10"
        disabled={!canSubmit || isPending}
        onClick={() => {
          void saveReviewAnswer();
        }}
        aria-disabled={!canSubmit || isPending}
        aria-busy={isPending}
      >
        <span className={isPending ? 'text-transparent' : ''}>
          {isLastQuestion
            ? savedCorrectOption
              ? labels.update
              : labels.save
            : savedCorrectOption
              ? labels.updateAndNext
              : labels.saveAndNext}
        </span>
        {isPending ? (
          <span className="absolute inset-0 inline-flex items-center justify-center gap-2">
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
            {labels.savePending}
          </span>
        ) : null}
      </button>
      {saveStatus === 'saved' ? (
        <p className="text-center text-xs font-bold uppercase tracking-[0.14em] text-brand">
          {labels.save}
        </p>
      ) : null}
      {submissionError ? (
        <p className="text-center text-sm font-semibold text-rose-300">
          {submissionError}
        </p>
      ) : null}
    </div>
  );
}
