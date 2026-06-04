import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sessionClient = readFileSync(
  'components/session/session-flow-client.tsx',
  'utf8',
);

test('answer submit does not promote optimistic answers to parent state before server success', () => {
  const optimisticBlockStart = sessionClient.indexOf(
    'if (!optimisticPersistedRef.current)',
  );
  const savePromiseStart = sessionClient.indexOf(
    'const savePromise = enqueueSessionSave<SubmitAnswerResponse>',
  );
  const serverSuccessStart = sessionClient.indexOf('if (result.ok)');
  const parentPersistStart = sessionClient.indexOf(
    'onAnswerPersisted?.(',
    serverSuccessStart,
  );

  assert.notEqual(optimisticBlockStart, -1);
  assert.notEqual(savePromiseStart, -1);
  assert.notEqual(serverSuccessStart, -1);
  assert.notEqual(parentPersistStart, -1);
  assert.equal(
    sessionClient
      .slice(optimisticBlockStart, savePromiseStart)
      .includes('onAnswerPersisted?.('),
    false,
  );
  assert.ok(parentPersistStart > serverSuccessStart);
});

test('failed answer submits clear optimistic state so the user can retry', () => {
  const failureStart = sessionClient.indexOf('if (result.refetch)');
  const errorStart = sessionClient.indexOf("setSaveStatus('error')", failureStart);
  const failureBlock = sessionClient.slice(failureStart, errorStart);

  assert.notEqual(failureStart, -1);
  assert.notEqual(errorStart, -1);
  assert.match(failureBlock, /setOptimisticAnswer\(null\)/);
  assert.match(failureBlock, /optimisticPersistedRef\.current = false/);
  assert.match(failureBlock, /onSubmissionStateChange\?\.\(false\)/);
});
