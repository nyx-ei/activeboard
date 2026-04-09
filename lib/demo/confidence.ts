export type ConfidenceLevel = 'low' | 'medium' | 'high';

const CONFIDENCE_SCORES: Record<ConfidenceLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export function isConfidenceLevel(value: string | null | undefined): value is ConfidenceLevel {
  return value === 'low' || value === 'medium' || value === 'high';
}

export function confidenceToScore(confidence: ConfidenceLevel | null | undefined) {
  if (!confidence) {
    return 0;
  }

  return CONFIDENCE_SCORES[confidence];
}

export function scoreToConfidenceLevel(score: number | null | undefined): ConfidenceLevel | null {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return null;
  }

  if (score < 1.5) return 'low';
  if (score < 2.5) return 'medium';
  return 'high';
}
