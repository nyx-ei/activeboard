import assert from 'node:assert/strict';
import test from 'node:test';

const ANSWER_OPTIONS = ['A', 'B', 'C', 'D', 'E'];

function computeAnswerDistribution(answers, participantCount) {
  const counts = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    blank: 0,
    skipped: 0,
  };

  for (const answer of answers) {
    if (answer.answer_state === 'skipped') {
      counts.skipped++;
      continue;
    }

    const option = answer.selected_option?.toUpperCase();
    if (option && ANSWER_OPTIONS.includes(option)) {
      counts[option]++;
    } else {
      counts.blank++;
    }
  }

  counts.skipped += Math.max(0, participantCount - answers.length);
  return counts;
}

function countQuotaAnswers(answers) {
  return answers.filter((answer) => answer.answer_state !== 'skipped').length;
}

test('submitted custom unknown answer remains distinct from skipped', () => {
  const distribution = computeAnswerDistribution(
    [
      { answer_state: 'submitted', selected_option: 'G' },
      { answer_state: 'skipped', selected_option: null },
    ],
    2,
  );

  assert.equal(distribution.blank, 1);
  assert.equal(distribution.skipped, 1);
});

test('missing participants are counted as skipped in review distribution', () => {
  const distribution = computeAnswerDistribution(
    [{ answer_state: 'submitted', selected_option: 'A' }],
    3,
  );

  assert.equal(distribution.A, 1);
  assert.equal(distribution.skipped, 2);
});

test('skipped answers are excluded from quota-style counting', () => {
  assert.equal(
    countQuotaAnswers([
      { answer_state: 'submitted' },
      { answer_state: 'skipped' },
      { answer_state: 'submitted' },
    ]),
    2,
  );
});
