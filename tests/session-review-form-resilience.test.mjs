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
const foregroundAwaitStart = sessionClient.indexOf(
  'const result = await savePromise;',
  optimisticAdvanceStart,
);
const failureStart = sessionClient.indexOf(
  "setSaveStatus('error')",
  serverSuccessStart,
);

test('review save-and-next advances immediately but resyncs if server save fails', () => {
  assert.notEqual(reviewFormStart, -1);
  assert.notEqual(saveReviewStart, -1);
  assert.notEqual(savePromiseStart, -1);
  assert.notEqual(optimisticAdvanceStart, -1);
  assert.notEqual(foregroundAwaitStart, -1);
  assert.notEqual(serverSuccessStart, -1);

  const optimisticAdvanceBlock = sessionClient.slice(
    optimisticAdvanceStart,
    foregroundAwaitStart,
  );
  const successBlock = sessionClient.slice(serverSuccessStart, failureStart);

  assert.match(
    optimisticAdvanceBlock,
    /setSavedCorrectOption\(nextCorrectOption\)/,
  );
  assert.match(optimisticAdvanceBlock, /onSaved\?\.\(nextCorrectOption\)/);
  assert.match(optimisticAdvanceBlock, /onAdvance\?\.\(targetQuestionIndex\)/);
  assert.match(optimisticAdvanceBlock, /void savePromise\.then/);
  assert.match(optimisticAdvanceBlock, /router\.refresh\(\)/);
  assert.match(successBlock, /setSavedCorrectOption\(nextCorrectOption\)/);
  assert.match(successBlock, /onSaved\?\.\(nextCorrectOption\)/);
});
