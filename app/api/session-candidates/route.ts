import { NextResponse } from 'next/server';

import {
  getPlanNextAccess,
  hasPaidAccess,
} from '@/lib/session/plan-next-access';
import {
  AVAILABILITY_WEEKDAYS,
  normalizeAvailabilityGrid,
  type AvailabilityGrid,
} from '@/lib/schedule/availability';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const MAX_CANDIDATES = 12;

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, candidates: [] }, { status: 401 });
  }

  const access = await getPlanNextAccess(user.id);
  if (!access.canInviteCandidates) {
    return NextResponse.json({ ok: false, candidates: [] }, { status: 403 });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get('query') ?? '').trim();
  const admin = createSupabaseAdminClient();
  let usersQuery = admin
    .schema('public')
    .from('users')
    .select(
      'id, display_name, email, avatar_url, has_valid_payment_method, subscription_status, user_tier',
    )
    .neq('id', user.id);

  if (query) {
    const safeQuery = query.replaceAll('%', '').replaceAll(',', ' ');
    usersQuery = usersQuery.or(
      `email.ilike.%${safeQuery}%,display_name.ilike.%${safeQuery}%`,
    );
  }

  const { data, error } = await usersQuery.limit(MAX_CANDIDATES);
  if (error) {
    return NextResponse.json({ ok: false, candidates: [] }, { status: 500 });
  }

  const paidUsers = (data ?? [])
    .filter((candidate) => hasPaidAccess(candidate))
    .slice(0, MAX_CANDIDATES);
  const candidateIds = paidUsers.map((candidate) => candidate.id);
  const schedulesResult =
    candidateIds.length > 0
      ? await admin
          .schema('public')
          .from('user_schedules')
          .select('user_id, availability_grid')
          .in('user_id', [user.id, ...candidateIds])
      : { data: [] };
  const scheduleByUserId = new Map(
    (schedulesResult.data ?? []).map((schedule) => [
      schedule.user_id,
      normalizeAvailabilityGrid(schedule.availability_grid),
    ]),
  );
  const requesterGrid = scheduleByUserId.get(user.id);
  const scoredCandidates = paidUsers
    .map((candidate) => {
      const candidateGrid = scheduleByUserId.get(candidate.id);
      return {
        candidate,
        availability: candidateGrid ?? null,
        compatibilityScore: getCompatibilityScore(
          requesterGrid,
          candidateGrid,
        ),
      };
    })
    .sort((left, right) => {
      if (right.compatibilityScore !== left.compatibilityScore) {
        return right.compatibilityScore - left.compatibilityScore;
      }

      return (left.candidate.display_name ?? left.candidate.email).localeCompare(
        right.candidate.display_name ?? right.candidate.email,
      );
    });

  return NextResponse.json({
    ok: true,
    candidates: scoredCandidates.map(({ candidate, availability, compatibilityScore }) => ({
      id: candidate.id,
      name: candidate.display_name ?? candidate.email,
      email: candidate.email,
      avatarUrl: candidate.avatar_url,
      isPaid: true,
      compatibilityScore,
      availability,
    })),
  });
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
