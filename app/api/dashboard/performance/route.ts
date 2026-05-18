import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { getDashboardPerformanceData } from '@/lib/demo/data';

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const data = await getDashboardPerformanceData(user.id);

  return NextResponse.json(
    {
      ok: true,
      metrics: data.metrics,
      profileAnalytics: {
        heatmap: data.profileAnalytics.heatmap,
        blueprintGrid: data.profileAnalytics.blueprintGrid,
        errorTypeBreakdown: data.profileAnalytics.errorTypeBreakdown,
        weeklyTrend: data.profileAnalytics.weeklyTrend,
        confidenceCalibration: data.profileAnalytics.confidenceCalibration,
      },
      sessionConfidenceBreakdown: data.sessionConfidenceBreakdown,
      progressQuadrants: data.progressQuadrants,
      progressQuadrantQuestions: data.progressQuadrantQuestions,
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  );
}
