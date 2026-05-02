import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { getDashboardSessionsData } from '@/lib/demo/data';

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const data = await getDashboardSessionsData(user);

  return NextResponse.json(
    {
      ok: true,
      groups: data.groups.map((group) => ({
        id: group.id,
        name: group.name,
        memberCount: group.memberCount,
      })),
      sessions: data.sessions,
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  );
}
