export const ANSWER_DEADLINE_GRACE_MS = 1000;

export type AnswerDeadlineMode = 'submit' | 'timeout';

export type AnswerDeadlineDecision =
  | {
      accepted: true;
      reason:
        | 'no_deadline'
        | 'before_deadline'
        | 'within_grace'
        | 'timeout_due';
    }
  | {
      accepted: false;
      reason: 'late' | 'timeout_too_early' | 'invalid_deadline';
    };

type AnswerDeadlineInput = {
  deadlineAt: string | null;
  mode: AnswerDeadlineMode;
  requestReceivedAtMs: number;
};

export function decideAnswerDeadline({
  deadlineAt,
  mode,
  requestReceivedAtMs,
}: AnswerDeadlineInput): AnswerDeadlineDecision {
  if (!deadlineAt) {
    return { accepted: true, reason: 'no_deadline' };
  }

  const deadlineMs = new Date(deadlineAt).getTime();
  if (!Number.isFinite(deadlineMs)) {
    return { accepted: false, reason: 'invalid_deadline' };
  }

  if (mode === 'timeout') {
    return requestReceivedAtMs >= deadlineMs
      ? { accepted: true, reason: 'timeout_due' }
      : { accepted: false, reason: 'timeout_too_early' };
  }

  if (requestReceivedAtMs <= deadlineMs) {
    return { accepted: true, reason: 'before_deadline' };
  }

  if (requestReceivedAtMs <= deadlineMs + ANSWER_DEADLINE_GRACE_MS) {
    return { accepted: true, reason: 'within_grace' };
  }

  return { accepted: false, reason: 'late' };
}

export function hasQuestionAdvanced(
  submittedQuestionIndex: number,
  latestLaunchedQuestionIndex: number | null,
) {
  return (
    typeof latestLaunchedQuestionIndex === 'number' &&
    latestLaunchedQuestionIndex > submittedQuestionIndex
  );
}
