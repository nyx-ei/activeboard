import { ANSWER_OPTIONS } from '@/lib/types/demo';

type DistributionInput = Array<{ selected_option: string | null }>;

export function computeAnswerDistribution(
  answers: DistributionInput,
  participantCount: number,
) {
  const counts = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    blank: 0,
  };

  for (const answer of answers) {
    const option = answer.selected_option?.toUpperCase();

    if (option && ANSWER_OPTIONS.includes(option as (typeof ANSWER_OPTIONS)[number])) {
      counts[option as keyof typeof counts]++;
    } else {
      counts.blank++;
    }
  }

  const missing = Math.max(0, participantCount - answers.length);
  counts.blank += missing;

  return counts;
}
