import { NextResponse } from 'next/server';

import type { AppLocale } from '@/i18n/routing';
import { createPerfTracker } from '@/lib/observability/perf';
import {
  getCurrentAuthUser,
  getSessionAccessSnapshot,
  loadSessionRuntimeAccess,
} from '@/lib/session/flow';

type RouteContext = {
  params: { sessionId: string };
};

type QuitPayload = {
  locale?: string;
};

export async function POST(request: Request, { params }: RouteContext) {
  const sessionId = params.sessionId;
  const body = (await request.json().catch(() => null)) as QuitPayload | null;
  const locale = (body?.locale === 'fr' ? 'fr' : 'en') as AppLocale;
  const perf = createPerfTracker(`quitSessionRoute:${sessionId}`, {
    sessionId,
    minDurationMs: 250,
    metadata: {
      trace_group: 'sessions',
      trace_kind: 'quit_session',
    },
  });

  const { supabase, user } = await getCurrentAuthUser();
  perf.step('auth_loaded');

  if (!user) {
    return NextResponse.json(
      { ok: false, redirectTo: `/${locale}/auth/login` },
      { status: 401 },
    );
  }

  const access = await loadSessionRuntimeAccess(
    supabase,
    sessionId,
    user.id,
    false,
  );
  const session = getSessionAccessSnapshot(access);
  perf.step('session_loaded');

  if (!session) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  if (session.status !== 'completed' && session.status !== 'incomplete') {
    await supabase
      .schema('public')
      .from('sessions')
      .update({ status: 'incomplete' })
      .eq('id', sessionId);
    perf.step('session_marked_incomplete');
  }

  perf.done({ status: session.status });

  return NextResponse.json({
    ok: true,
    redirectTo: `/${locale}/dashboard?view=sessions`,
  });
}
