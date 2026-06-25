import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { getDashboardPerformanceSummaryData } from '@/lib/demo/data';

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const data = await getDashboardPerformanceSummaryData(user.id);

  return NextResponse.json(
    {
      ok: true,
      metrics: data.metrics,
      profileAnalytics: {
        heatmap: data.profileAnalytics.heatmap,
      },
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  );
}
