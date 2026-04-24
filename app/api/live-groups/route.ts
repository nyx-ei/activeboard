import { NextResponse } from 'next/server';

import { getUserAccessState, hasUserTierCapability } from '@/lib/billing/gating';
import { getLiveGroupsForUser } from '@/lib/groups/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get('locale') === 'fr' ? 'fr' : 'en';
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const accessState = await getUserAccessState(user.id);
  if (!hasUserTierCapability(accessState, 'canBrowseLookupLayer')) {
    return NextResponse.json({ ok: true, groups: [] });
  }

  const groups = await getLiveGroupsForUser(user.id, locale);
  return NextResponse.json({ ok: true, groups });
}
