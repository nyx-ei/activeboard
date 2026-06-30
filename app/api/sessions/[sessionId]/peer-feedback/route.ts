import { NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type RouteContext = {
  params: { sessionId: string };
};

type PeerFeedbackPayload = {
  feedback?: Array<{
    userId?: string;
    willStudyAgain?: boolean;
  }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const sessionId = params.sessionId;
  const body = (await request.json().catch(() => null)) as
    | PeerFeedbackPayload
    | null;
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: session } = await admin
    .schema('public')
    .from('sessions')
    .select('id, group_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session?.group_id) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const { data: members } = await admin
    .schema('public')
    .from('group_members')
    .select('user_id')
    .eq('group_id', session.group_id);
  const memberIds = new Set((members ?? []).map((member) => member.user_id));

  if (!memberIds.has(user.id)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const rows = (body?.feedback ?? [])
    .filter(
      (item) =>
        item.userId &&
        item.userId !== user.id &&
        memberIds.has(item.userId) &&
        typeof item.willStudyAgain === 'boolean',
    )
    .map((item) => ({
      session_id: sessionId,
      reviewer_user_id: user.id,
      subject_user_id: item.userId as string,
      will_study_again: item.willStudyAgain as boolean,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, saved: 0 });
  }

  const { error } = await admin
    .schema('public')
    .from('session_peer_feedback')
    .upsert(rows, {
      onConflict: 'session_id,reviewer_user_id,subject_user_id',
    });

  if (error) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true, saved: rows.length });
}
