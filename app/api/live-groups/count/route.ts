import { NextResponse } from 'next/server';

import { getUserAccessState, hasUserTierCapability } from '@/lib/billing/gating';
import { getLiveGroupCountForUser } from '@/lib/live-groups/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  const accessState = await getUserAccessState(user.id);
  const canBrowseLookupLayer = hasUserTierCapability(accessState, 'canBrowseLookupLayer');

  if (!canBrowseLookupLayer) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const count = await getLiveGroupCountForUser(user.id);
  return NextResponse.json({ ok: true, count });
}
