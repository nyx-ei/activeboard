export type CandidateClassification =
  | 'starting'
  | 'active'
  | 'reliable'
  | 'stable_priority';

export type CandidateProfileCopy = {
  label: string;
  description: string;
};

const CANDIDATE_CLASSIFICATION_WEIGHT: Record<CandidateClassification, number> =
  {
    stable_priority: 40,
    reliable: 30,
    active: 20,
    starting: 0,
  };

export function getCandidateClassificationWeight(
  classification: string | null | undefined,
) {
  return CANDIDATE_CLASSIFICATION_WEIGHT[
    normalizeCandidateClassification(classification)
  ];
}

export function normalizeCandidateClassification(
  classification: string | null | undefined,
): CandidateClassification {
  if (
    classification === 'stable_priority' ||
    classification === 'reliable' ||
    classification === 'active'
  ) {
    return classification;
  }

  return 'starting';
}

export function getCandidateClassificationCopy(
  classification: string | null | undefined,
  locale: 'en' | 'fr',
): CandidateProfileCopy {
  const normalized = normalizeCandidateClassification(classification);

  if (locale === 'fr') {
    switch (normalized) {
      case 'stable_priority':
        return {
          label: 'Prioritaire pour groupe stable',
          description: 'Très bon signal de fiabilité et de continuité.',
        };
      case 'reliable':
        return {
          label: 'Candidat fiable',
          description: 'Présent, engagé et recommandé par ses pairs.',
        };
      case 'active':
        return {
          label: 'Candidat actif',
          description: 'A participé aux questions et à la revue.',
        };
      default:
        return {
          label: 'Profil en démarrage',
          description: 'Activité encore insuffisante pour un groupe stable.',
        };
    }
  }

  switch (normalized) {
    case 'stable_priority':
      return {
        label: 'Priority for stable group',
        description: 'Strong reliability and continuity signal.',
      };
    case 'reliable':
      return {
        label: 'Reliable candidate',
        description: 'Shows up, participates, and gets positive peer signals.',
      };
    case 'active':
      return {
        label: 'Active candidate',
        description: 'Completed questions and review activity.',
      };
    default:
      return {
        label: 'Starting profile',
        description: 'Not enough activity yet for stable matching.',
      };
  }
}

export function isActiveOrReliableCandidate(
  classification: string | null | undefined,
) {
  const normalized = normalizeCandidateClassification(classification);
  return (
    normalized === 'active' ||
    normalized === 'reliable' ||
    normalized === 'stable_priority'
  );
}
