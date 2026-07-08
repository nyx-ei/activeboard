import {
  getCandidateClassificationCopy,
  getCandidateClassificationWeight,
  isActiveOrReliableCandidate,
} from '@/lib/matching/candidate-profile';
import {
  AVAILABILITY_WEEKDAYS,
  normalizeAvailabilityGrid,
  type AvailabilityGrid,
} from '@/lib/schedule/availability';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const DEFAULT_MAX_CANDIDATES = 12;

type CandidateBillingFields = {
  has_valid_payment_method: boolean | null;
  subscription_status: string | null;
  user_tier: string | null;
};

export type RankedSeriousCandidate = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  phoneNumber: string | null;
  isPaid: true;
  compatibilityScore: number;
  profileScore: number;
  timezone: string | null;
  classification: string | null;
  classificationLabel: string;
  language: string | null;
  questionsCompleted: number;
  questionsReviewed: number;
  sessionsJoined: number;
  sessionsAttended: number;
  reviewCompletedSessions: number;
  nextSessionsPlanned: number;
  positivePeerVotes: number;
  totalPeerVotes: number;
  punctualityRate: number | null;
  lastActiveAt: string | null;
  availability: AvailabilityGrid | null;
};

export type RankedSeriousCandidatesResult = {
  candidates: RankedSeriousCandidate[];
  hasActiveReliableMatch: boolean;
  fallbackRecommendation: string | null;
};

function hasCandidatePaidAccess(candidate: CandidateBillingFields) {
  return (
    Boolean(candidate.has_valid_payment_method) ||
    candidate.subscription_status === 'active' ||
    candidate.subscription_status === 'trialing' ||
    candidate.user_tier === 'active'
  );
}

export async function getRankedSeriousCandidates({
  userId,
  locale,
  query = '',
  limit = DEFAULT_MAX_CANDIDATES,
}: {
  userId: string;
  locale: 'en' | 'fr';
  query?: string;
  limit?: number;
}): Promise<RankedSeriousCandidatesResult> {
  const admin = createSupabaseAdminClient();
  const requesterResult = await admin
    .schema('public')
    .from('candidate_matching_profiles')
    .select('user_id, language, exam_type')
    .eq('user_id', userId)
    .maybeSingle();

  let usersQuery = admin
    .schema('public')
    .from('candidate_matching_profiles')
    .select(
      'user_id, display_name, email, avatar_url, phone_number, language, exam_type, has_valid_payment_method, subscription_status, user_tier, sessions_joined, questions_completed, questions_reviewed, review_completed_sessions, next_sessions_planned, positive_peer_votes, total_peer_votes, candidate_classification',
    )
    .neq('user_id', userId);

  const safeQuery = query.trim().replaceAll('%', '').replaceAll(',', ' ');
  if (safeQuery) {
    usersQuery = usersQuery.or(
      `email.ilike.%${safeQuery}%,display_name.ilike.%${safeQuery}%`,
    );
  }

  const { data, error } = await usersQuery.limit(limit);
  if (error) {
    return {
      candidates: [],
      hasActiveReliableMatch: false,
      fallbackRecommendation: null,
    };
  }

  const paidUsers = (data ?? [])
    .filter(
      (candidate) =>
        hasCandidatePaidAccess(candidate) &&
        isActiveOrReliableCandidate(candidate.candidate_classification),
    )
    .slice(0, limit);
  const candidateIds = paidUsers.map((candidate) => candidate.user_id);

  const [schedulesResult, activityResult] =
    candidateIds.length > 0
      ? await Promise.all([
          admin
            .schema('public')
            .from('user_schedules')
            .select('user_id, timezone, availability_grid')
            .in('user_id', [userId, ...candidateIds]),
          admin
            .schema('public')
            .from('session_member_activity')
            .select('user_id, attendance_status, updated_at')
            .in('user_id', candidateIds),
        ])
      : [{ data: [] }, { data: [] }];

  const scheduleByUserId = new Map(
    (schedulesResult.data ?? []).map((schedule) => [
      schedule.user_id,
      normalizeAvailabilityGrid(schedule.availability_grid),
    ]),
  );
  const requesterGrid = scheduleByUserId.get(userId);
  const requesterTimezone =
    (schedulesResult.data ?? []).find((schedule) => schedule.user_id === userId)
      ?.timezone ?? null;
  const timezoneByUserId = new Map(
    (schedulesResult.data ?? []).map((schedule) => [
      schedule.user_id,
      schedule.timezone,
    ]),
  );
  const activityByUserId = new Map<
    string,
    { attended: number; late: number; lastActiveAt: string | null }
  >();

  for (const activity of activityResult.data ?? []) {
    const current = activityByUserId.get(activity.user_id) ?? {
      attended: 0,
      late: 0,
      lastActiveAt: null,
    };
    current.attended += activity.attendance_status === 'present' ? 1 : 0;
    current.late += activity.attendance_status === 'late' ? 1 : 0;
    if (
      activity.updated_at &&
      (!current.lastActiveAt ||
        new Date(activity.updated_at).getTime() >
          new Date(current.lastActiveAt).getTime())
    ) {
      current.lastActiveAt = activity.updated_at;
    }
    activityByUserId.set(activity.user_id, current);
  }

  const scoredCandidates = paidUsers
    .map((candidate) => {
      const candidateGrid = scheduleByUserId.get(candidate.user_id);
      const candidateTimezone = timezoneByUserId.get(candidate.user_id) ?? null;
      const classificationWeight = getCandidateClassificationWeight(
        candidate.candidate_classification,
      );
      const compatibilityScore = getCompatibilityScore(
        requesterGrid,
        candidateGrid,
      );
      const profileScore =
        classificationWeight +
        compatibilityScore +
        (requesterResult.data?.language &&
        candidate.language === requesterResult.data.language
          ? 8
          : 0) +
        (requesterResult.data?.exam_type &&
        candidate.exam_type === requesterResult.data.exam_type
          ? 8
          : 0) +
        (requesterTimezone && candidateTimezone === requesterTimezone ? 4 : 0) +
        Math.min(8, Number(candidate.positive_peer_votes ?? 0) * 2);

      return {
        candidate,
        availability: candidateGrid ?? null,
        compatibilityScore,
        profileScore,
        candidateTimezone,
      };
    })
    .sort((left, right) => {
      if (right.profileScore !== left.profileScore) {
        return right.profileScore - left.profileScore;
      }

      return (
        left.candidate.display_name ?? left.candidate.email
      ).localeCompare(right.candidate.display_name ?? right.candidate.email);
    });
  const hasActiveReliableMatch = scoredCandidates.some(({ candidate }) =>
    isActiveOrReliableCandidate(candidate.candidate_classification),
  );

  return {
    hasActiveReliableMatch,
    fallbackRecommendation: hasActiveReliableMatch
      ? null
      : locale === 'fr'
        ? 'Deux séances test supplémentaires sont recommandées avant de proposer un groupe stable.'
        : 'Two more test sessions are recommended before proposing a stable group.',
    candidates: scoredCandidates.map(
      ({
        candidate,
        availability,
        compatibilityScore,
        profileScore,
        candidateTimezone,
      }) => {
        const activity = activityByUserId.get(candidate.user_id);
        const attended =
          activity?.attended ?? Number(candidate.sessions_joined ?? 0);
        const punctualityRate =
          attended > 0
            ? Math.max(
                0,
                Math.round(
                  ((attended - (activity?.late ?? 0)) / attended) * 100,
                ),
              )
            : null;

        return {
          id: candidate.user_id,
          name: candidate.display_name ?? candidate.email,
          email: candidate.email,
          avatarUrl: candidate.avatar_url,
          phoneNumber: candidate.phone_number,
          isPaid: true,
          compatibilityScore,
          profileScore,
          timezone: candidateTimezone,
          classification: candidate.candidate_classification,
          classificationLabel: getCandidateClassificationCopy(
            candidate.candidate_classification,
            locale,
          ).label,
          language: candidate.language,
          questionsCompleted: candidate.questions_completed ?? 0,
          questionsReviewed: candidate.questions_reviewed ?? 0,
          sessionsJoined: candidate.sessions_joined ?? 0,
          sessionsAttended: attended,
          reviewCompletedSessions: candidate.review_completed_sessions ?? 0,
          nextSessionsPlanned: candidate.next_sessions_planned ?? 0,
          positivePeerVotes: candidate.positive_peer_votes ?? 0,
          totalPeerVotes: candidate.total_peer_votes ?? 0,
          punctualityRate,
          lastActiveAt: activity?.lastActiveAt ?? null,
          availability,
        };
      },
    ),
  };
}

function getCompatibilityScore(
  requesterGrid: AvailabilityGrid | null | undefined,
  candidateGrid: AvailabilityGrid | null | undefined,
) {
  if (!requesterGrid || !candidateGrid) {
    return 0;
  }

  return AVAILABILITY_WEEKDAYS.reduce((score, weekday) => {
    const requesterHours = new Set(requesterGrid[weekday]);
    return (
      score +
      candidateGrid[weekday].filter((hour) => requesterHours.has(hour)).length
    );
  }, 0);
}
