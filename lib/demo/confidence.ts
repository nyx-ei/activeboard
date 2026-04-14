export enum ConfidenceLevelValue {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export type ConfidenceLevel = `${ConfidenceLevelValue}`;

export enum CertaintyCorrectnessStatusValue {
  ClearMastery = 'clearMastery',
  Overconfidence = 'overconfidence',
  GoodProgress = 'goodProgress',
  PrecisionToImprove = 'precisionToImprove',
  ConfidenceToBuild = 'confidenceToBuild',
  FoundationToBuild = 'foundationToBuild',
}

export type CertaintyCorrectnessStatus = `${CertaintyCorrectnessStatusValue}`;

const CONFIDENCE_SCORES: Record<ConfidenceLevel, number> = {
  [ConfidenceLevelValue.Low]: 1,
  [ConfidenceLevelValue.Medium]: 2,
  [ConfidenceLevelValue.High]: 3,
};

export function isConfidenceLevel(value: string | null | undefined): value is ConfidenceLevel {
  return (
    value === ConfidenceLevelValue.Low ||
    value === ConfidenceLevelValue.Medium ||
    value === ConfidenceLevelValue.High
  );
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

  if (score < 1.5) return ConfidenceLevelValue.Low;
  if (score < 2.5) return ConfidenceLevelValue.Medium;
  return ConfidenceLevelValue.High;
}

export function getCertaintyCorrectnessStatus(
  confidence: ConfidenceLevel | null | undefined,
  isCorrect: boolean | null | undefined,
): CertaintyCorrectnessStatus {
  if (confidence === ConfidenceLevelValue.High) {
    return isCorrect
      ? CertaintyCorrectnessStatusValue.ClearMastery
      : CertaintyCorrectnessStatusValue.Overconfidence;
  }

  if (confidence === ConfidenceLevelValue.Medium) {
    return isCorrect
      ? CertaintyCorrectnessStatusValue.GoodProgress
      : CertaintyCorrectnessStatusValue.PrecisionToImprove;
  }

  if (confidence === ConfidenceLevelValue.Low) {
    return isCorrect
      ? CertaintyCorrectnessStatusValue.ConfidenceToBuild
      : CertaintyCorrectnessStatusValue.FoundationToBuild;
  }

  return CertaintyCorrectnessStatusValue.FoundationToBuild;
}

export function getCertaintyCorrectnessTone(status: CertaintyCorrectnessStatus) {
  if (
    status === CertaintyCorrectnessStatusValue.ClearMastery ||
    status === CertaintyCorrectnessStatusValue.GoodProgress ||
    status === CertaintyCorrectnessStatusValue.ConfidenceToBuild
  ) {
    return 'positive';
  }

  if (
    status === CertaintyCorrectnessStatusValue.Overconfidence ||
    status === CertaintyCorrectnessStatusValue.PrecisionToImprove
  ) {
    return 'warning';
  }

  return 'neutral';
}
