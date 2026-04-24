import { NextResponse } from 'next/server';

import { getShellGroupsForUser } from '@/lib/groups/server';
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

  const groups = await getShellGroupsForUser(user.id, locale);
  return NextResponse.json({ ok: true, groups });
}
