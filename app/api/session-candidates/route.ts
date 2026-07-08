import { NextResponse } from 'next/server';

import { getRankedSeriousCandidates } from '@/lib/matching/serious-candidates';
import { getPlanNextAccess } from '@/lib/session/plan-next-access';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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
  const locale = url.searchParams.get('locale') === 'fr' ? 'fr' : 'en';
  const result = await getRankedSeriousCandidates({
    userId: user.id,
    locale,
    query,
  });

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
