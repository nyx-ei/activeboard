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
const failureStart = sessionClient.indexOf(
  "setSaveStatus('error')",
  serverSuccessStart,
);

test('review answer does not lock or advance before server confirmation', () => {
  assert.notEqual(reviewFormStart, -1);
  assert.notEqual(saveReviewStart, -1);
  assert.notEqual(savePromiseStart, -1);
  assert.notEqual(serverSuccessStart, -1);

  const optimisticBlock = sessionClient.slice(
    saveReviewStart,
    serverSuccessStart,
  );
  const successBlock = sessionClient.slice(serverSuccessStart, failureStart);

  assert.equal(
    optimisticBlock.includes('setSavedCorrectOption(nextCorrectOption)'),
    false,
  );
  assert.equal(optimisticBlock.includes('onSaved?.(nextCorrectOption)'), false);
  assert.equal(
    optimisticBlock.includes('onAdvance?.(targetQuestionIndex)'),
    false,
  );
  assert.match(successBlock, /setSavedCorrectOption\(nextCorrectOption\)/);
  assert.match(successBlock, /onSaved\?\.\(nextCorrectOption\)/);
  assert.match(successBlock, /onAdvance\?\.\(targetQuestionIndex\)/);
});
