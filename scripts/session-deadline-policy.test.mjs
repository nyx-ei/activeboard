import assert from 'node:assert/strict';
import test from 'node:test';

const ANSWER_DEADLINE_GRACE_MS = 1000;

function decideAnswerDeadline({ deadlineAt, mode, requestReceivedAtMs }) {
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

function hasQuestionAdvanced(
  submittedQuestionIndex,
  latestLaunchedQuestionIndex,
) {
  return (
    typeof latestLaunchedQuestionIndex === 'number' &&
    latestLaunchedQuestionIndex > submittedQuestionIndex
  );
}

function applyTimeout(existingAnswer) {
  return existingAnswer ?? { selectedOption: '?', confidence: null };
}

test('manual submit at the deadline is accepted', () => {
  const deadlineAt = '2026-05-04T12:00:00.000Z';

  assert.deepEqual(
    decideAnswerDeadline({
      deadlineAt,
      mode: 'submit',
      requestReceivedAtMs: new Date(deadlineAt).getTime(),
    }),
    { accepted: true, reason: 'before_deadline' },
  );
});

test('manual submit inside the grace window is accepted predictably', () => {
  const deadlineAt = '2026-05-04T12:00:00.000Z';

  assert.deepEqual(
    decideAnswerDeadline({
      deadlineAt,
      mode: 'submit',
      requestReceivedAtMs: new Date(deadlineAt).getTime() + 750,
    }),
    { accepted: true, reason: 'within_grace' },
  );
});

test('manual submit after the grace window is explicitly late', () => {
  const deadlineAt = '2026-05-04T12:00:00.000Z';

  assert.deepEqual(
    decideAnswerDeadline({
      deadlineAt,
      mode: 'submit',
      requestReceivedAtMs:
        new Date(deadlineAt).getTime() + ANSWER_DEADLINE_GRACE_MS + 1,
    }),
    { accepted: false, reason: 'late' },
  );
});

test('timeout submit does not overwrite an existing manual answer', () => {
  const manualAnswer = { selectedOption: 'B', confidence: 'medium' };

  assert.deepEqual(applyTimeout(manualAnswer), manualAnswer);
});

test('submit for a previous question is rejected after advance', () => {
  assert.equal(hasQuestionAdvanced(1, 2), true);
  assert.equal(hasQuestionAdvanced(2, 2), false);
});
