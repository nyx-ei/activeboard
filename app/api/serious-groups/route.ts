import { NextResponse } from 'next/server';

import { hasEmailEnv } from '@/lib/env';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { isActiveOrReliableCandidate } from '@/lib/matching/candidate-profile';
import { sendGroupInviteEmail } from '@/lib/notifications/group-invites';
import { getPlanNextAccess, hasPaidAccess } from '@/lib/session/plan-next-access';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateInviteCode } from '@/lib/utils';

const MAX_GROUP_MEMBERS = 5;

type CreateSeriousGroupPayload = {
  locale?: string;
  groupName?: string;
  candidateIds?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | CreateSeriousGroupPayload
    | null;
  const locale = body?.locale === 'fr' ? 'fr' : 'en';
  const groupName = body?.groupName?.trim() ?? '';
  const candidateIds = parseCandidateIds(body?.candidateIds).slice(
    0,
    MAX_GROUP_MEMBERS - 1,
  );
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, redirectTo: `/${locale}/auth/login` },
      { status: 401 },
    );
  }

  const access = await getPlanNextAccess(user.id);
  if (!access.canInviteCandidates) {
    return NextResponse.json(
      { ok: false, redirectTo: `/${locale}/billing` },
      { status: 403 },
    );
  }

  if (!groupName || candidateIds.length === 0) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: candidates, error: candidatesError } = await admin
    .schema('public')
    .from('candidate_matching_profiles')
    .select(
      'user_id, email, display_name, has_valid_payment_method, subscription_status, user_tier, candidate_classification',
    )
    .in('user_id', candidateIds);

  if (candidatesError) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const eligibleCandidates = (candidates ?? []).filter(
    (candidate) =>
      candidate.user_id !== user.id &&
      hasPaidAccess({
        has_valid_payment_method: Boolean(candidate.has_valid_payment_method),
        subscription_status: candidate.subscription_status ?? 'none',
        user_tier: candidate.user_tier ?? 'trial',
      }) &&
      isActiveOrReliableCandidate(candidate.candidate_classification),
  );

  if (eligibleCandidates.length !== candidateIds.length) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const inviteCode = await createUniqueInviteCode(admin);
  const { data: group, error: groupError } = await admin
    .schema('public')
    .from('groups')
    .insert({
      name: groupName,
      invite_code: inviteCode,
      created_by: user.id,
      group_kind: 'solidified',
      max_members: MAX_GROUP_MEMBERS,
      solidified_at: new Date().toISOString(),
      difficulty_level: 'medium',
    })
    .select('id, name, invite_code')
    .single();

  if (groupError || !group?.id) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const { error: membershipError } = await admin
    .schema('public')
    .from('group_members')
    .insert({
      group_id: group.id,
      user_id: user.id,
      is_founder: true,
    });

  if (membershipError) {
    await admin.schema('public').from('groups').delete().eq('id', group.id);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const { data: invites, error: invitesError } = await admin
    .schema('public')
    .from('group_invites')
    .insert(
      eligibleCandidates.map((candidate) => ({
        group_id: group.id,
        invited_by: user.id,
        invitee_email: candidate.email,
        invitee_user_id: candidate.user_id,
      })),
    )
    .select('id, invitee_email, invitee_user_id');

  if (invitesError) {
    await admin.schema('public').from('group_members').delete().eq('group_id', group.id);
    await admin.schema('public').from('groups').delete().eq('id', group.id);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  void logAppEvent({
    eventName: APP_EVENTS.groupCreated,
    locale,
    userId: user.id,
    groupId: group.id,
    metadata: {
      source: 'serious_candidates_dashboard',
      invite_count: eligibleCandidates.length,
      max_members: MAX_GROUP_MEMBERS,
    },
  });

  if (hasEmailEnv()) {
    void Promise.allSettled(
      (invites ?? []).map((invite) =>
        sendGroupInviteEmail({
          locale,
          inviteId: invite.id,
          groupId: group.id,
          groupName: group.name,
          inviteCode: group.invite_code,
          inviteeEmail: invite.invitee_email,
          inviteeExists: Boolean(invite.invitee_user_id),
          inviterUserId: user.id,
          inviterName: user.user_metadata?.full_name ?? user.email ?? 'ActiveBoard',
        }),
      ),
    );
  }

  return NextResponse.json({
    ok: true,
    groupId: group.id,
    redirectTo: `/${locale}/dashboard?groupId=${encodeURIComponent(group.id)}`,
  });
}

function parseCandidateIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            item,
          ),
        ),
    ),
  ];
}

async function createUniqueInviteCode(
  admin: ReturnType<typeof createSupabaseAdminClient>,
) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generateInviteCode();
    const { data: existing } = await admin
      .schema('public')
      .from('groups')
      .select('id')
      .eq('invite_code', candidate)
      .maybeSingle();

    if (!existing) {
      return candidate;
    }
  }

  throw new Error('Unable to generate a unique invite code');
}
