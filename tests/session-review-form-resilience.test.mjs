import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sessionClient = readFileSync(
  'components/session/session-flow-client.tsx',
  'utf8',
);

const reviewFormStart = sessionClient.indexOf(
  'export function ReviewAnswerForm',
);
const saveReviewStart = sessionClient.indexOf(
  'async function saveReviewAnswer()',
  reviewFormStart,
);
const savePromiseStart = sessionClient.indexOf(
  'const savePromise = enqueueSessionSave<{',
  saveReviewStart,
);
const serverSuccessStart = sessionClient.indexOf(
  'if (result.ok)',
  savePromiseStart,
);
const optimisticAdvanceStart = sessionClient.indexOf(
  'if (shouldAdvance)',
  savePromiseStart,
);
const perQuestionAdvanceStart = sessionClient.indexOf(
  'if (shouldAdvanceToNextQuestion)',
  savePromiseStart,
);
const perQuestionAdvanceEnd = sessionClient.indexOf(
  'if (shouldAdvance)',
  perQuestionAdvanceStart,
);
const foregroundAwaitStart = sessionClient.indexOf(
  'const result = await savePromise;',
  optimisticAdvanceStart,
);
const failureStart = sessionClient.indexOf(
  "setSaveStatus('error')",
  serverSuccessStart,
);
const correctAnswerOptionsStart = sessionClient.indexOf(
  'ANSWER_OPTIONS.map((option) =>',
  reviewFormStart,
);

test('review save-and-next advances immediately but resyncs if server save fails', () => {
  assert.notEqual(reviewFormStart, -1);
  assert.notEqual(saveReviewStart, -1);
  assert.notEqual(savePromiseStart, -1);
  assert.notEqual(perQuestionAdvanceStart, -1);
  assert.notEqual(perQuestionAdvanceEnd, -1);
  assert.notEqual(optimisticAdvanceStart, -1);
  assert.notEqual(foregroundAwaitStart, -1);
  assert.notEqual(serverSuccessStart, -1);

  const perQuestionAdvanceBlock = sessionClient.slice(
    perQuestionAdvanceStart,
    perQuestionAdvanceEnd,
  );
  const optimisticAdvanceBlock = sessionClient.slice(
    optimisticAdvanceStart,
    foregroundAwaitStart,
  );
  const successBlock = sessionClient.slice(serverSuccessStart, failureStart);

  assert.doesNotMatch(perQuestionAdvanceBlock, /await savePromise/);
  assert.match(
    perQuestionAdvanceBlock,
    /setSavedCorrectOption\(nextCorrectOption\)/,
  );
  assert.match(perQuestionAdvanceBlock, /onSaved\?\.\(nextCorrectOption\)/);
  assert.match(perQuestionAdvanceBlock, /navigateToQuestionWithFallback\(redirectTo\)/);
  assert.match(perQuestionAdvanceBlock, /void savePromise\.then/);
  assert.match(
    optimisticAdvanceBlock,
    /setSavedCorrectOption\(nextCorrectOption\)/,
  );
  assert.match(optimisticAdvanceBlock, /onSaved\?\.\(nextCorrectOption\)/);
  assert.match(optimisticAdvanceBlock, /onAdvance\(targetQuestionIndex\)/);
  assert.match(optimisticAdvanceBlock, /void savePromise\.then/);
  assert.match(optimisticAdvanceBlock, /router\.refresh\(\)/);
  assert.match(successBlock, /setSavedCorrectOption\(nextCorrectOption\)/);
  assert.match(successBlock, /onSaved\?\.\(nextCorrectOption\)/);
});

test('review correction choices exclude ignored answer placeholder', () => {
  assert.notEqual(reviewFormStart, -1);
  assert.notEqual(correctAnswerOptionsStart, -1);

  const reviewForm = sessionClient.slice(reviewFormStart);

  assert.match(reviewForm, /ANSWER_OPTIONS\.map\(\(option\) =>/);
  assert.doesNotMatch(reviewForm, /\[\.\.\.ANSWER_OPTIONS,\s*'\?'\]\.map/);
});
