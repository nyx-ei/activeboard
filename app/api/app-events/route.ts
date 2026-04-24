import { NextResponse } from 'next/server';

import type { AppLocale } from '@/i18n/routing';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const CLIENT_ALLOWED_EVENTS = new Set<string>([
  APP_EVENTS.pwaInstallPromptShown,
  APP_EVENTS.pwaInstallAccepted,
  APP_EVENTS.pwaLaunchedFromHomeScreen,
]);

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        eventName?: string;
        locale?: AppLocale;
        metadata?: Record<string, string | number | boolean | null | undefined>;
      }
    | null;

  if (!body?.eventName || !CLIENT_ALLOWED_EVENTS.has(body.eventName)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await logAppEvent({
    eventName: body.eventName,
    locale: body.locale ?? null,
    userId: user.id,
    metadata: body.metadata,
  });

  return NextResponse.json({ ok: true });
}
