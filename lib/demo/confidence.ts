export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type CertaintyCorrectnessStatus =
  | 'clearMastery'
  | 'overconfidence'
  | 'goodProgress'
  | 'precisionToImprove'
  | 'confidenceToBuild'
  | 'foundationToBuild';

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

export function getCertaintyCorrectnessStatus(
  confidence: ConfidenceLevel | null | undefined,
  isCorrect: boolean | null | undefined,
): CertaintyCorrectnessStatus {
  if (confidence === 'high') {
    return isCorrect ? 'clearMastery' : 'overconfidence';
  }

  if (confidence === 'medium') {
    return isCorrect ? 'goodProgress' : 'precisionToImprove';
  }

  if (confidence === 'low') {
    return isCorrect ? 'confidenceToBuild' : 'foundationToBuild';
  }

  return 'foundationToBuild';
}

export function getCertaintyCorrectnessTone(status: CertaintyCorrectnessStatus) {
  if (status === 'clearMastery' || status === 'goodProgress' || status === 'confidenceToBuild') {
    return 'positive';
  }

  if (status === 'overconfidence' || status === 'precisionToImprove') {
    return 'warning';
  }

  return 'neutral';
}
