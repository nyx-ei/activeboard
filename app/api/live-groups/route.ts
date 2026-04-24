import { NextResponse } from 'next/server';

import { getUserAccessState, hasUserTierCapability } from '@/lib/billing/gating';
import { type AppLocale, routing } from '@/i18n/routing';
import { getLiveGroupsForUser } from '@/lib/live-groups/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
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
    return NextResponse.json({ ok: true, groups: [] });
  }

  const url = new URL(request.url);
  const localeParam = url.searchParams.get('locale');
  const locale: AppLocale = routing.locales.includes(localeParam as AppLocale)
    ? (localeParam as AppLocale)
    : routing.defaultLocale;
  const groups = await getLiveGroupsForUser(user.id, locale);
  return NextResponse.json({ ok: true, groups });
}
