import { NextResponse } from 'next/server';

import type { AppLocale } from '@/i18n/routing';
import {
  getInviteAdmissionFeedbackKey,
  verifyInviteAdmission,
} from '@/lib/invites/admission';
import { createPerfTracker } from '@/lib/observability/perf';
import { getCurrentAuthUser } from '@/lib/session/flow';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type RouteContext = {
  params: { inviteId: string };
};

type VerifyPayload = {
  locale?: string;
};

function parseLocale(value: string | null | undefined): AppLocale {
  return value === 'fr' ? 'fr' : 'en';
}

async function handleVerify(
  request: Request,
  { params }: RouteContext,
  body?: VerifyPayload | null,
) {
  const requestUrl = new URL(request.url);
  const locale = parseLocale(
    body?.locale ?? requestUrl.searchParams.get('locale'),
  );
  const inviteId = params.inviteId;
  const perf = createPerfTracker(`verifyInviteRoute:${inviteId}`, {
    minDurationMs: 250,
    metadata: {
      trace_group: 'invites',
      trace_kind: 'verify_invite',
    },
  });

  const { user } = await getCurrentAuthUser();
  perf.step('auth_loaded');

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'unauthorized',
        redirectTo: `/${locale}/auth/login?next=/${locale}/invite/${inviteId}`,
      },
      { status: 401 },
    );
  }

  const admin = createSupabaseAdminClient();
  const verification = await verifyInviteAdmission({
    admin,
    inviteId,
    userId: user.id,
    userEmail: user.email,
  });
  perf.step('invite_verified');

  if (!verification.ok) {
    perf.done({ reason: verification.reason });
    return NextResponse.json(
      {
        ok: false,
        reason: verification.reason,
        feedbackKey: getInviteAdmissionFeedbackKey(verification.reason),
        sessionAdmission: verification.sessionAdmission ?? null,
      },
      { status: verification.status },
    );
  }

  perf.done({
    groupId: verification.invite.groupId,
    invitedDuringSessionId: verification.invite.invitedDuringSessionId,
    alreadyMember: verification.alreadyMember,
  });

  return NextResponse.json({
    ok: true,
    invite: verification.invite,
    alreadyMember: verification.alreadyMember,
    sessionAdmission: verification.sessionAdmission,
    redirectTo: `/${locale}/groups/${verification.invite.groupId}`,
  });
}

export async function GET(request: Request, context: RouteContext) {
  return handleVerify(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  const body = (await request.json().catch(() => null)) as VerifyPayload | null;
  return handleVerify(request, context, body);
}
