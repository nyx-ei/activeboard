import { NextResponse } from 'next/server';

import { getGroupMemberPerformance } from '@/lib/groups/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const groupId = new URL(request.url).searchParams.get('groupId');
  if (!groupId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('group_id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const members = await getGroupMemberPerformance(groupId, user.email ?? '');
  return NextResponse.json({ ok: true, members });
}
