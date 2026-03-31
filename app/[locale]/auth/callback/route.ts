import { NextResponse } from 'next/server';

import { routing, type AppLocale } from '@/i18n/routing';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

type RouteContext = {
  params: {
    locale: string;
  };
};

export async function GET(request: Request, { params }: RouteContext) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next');
  const locale: AppLocale = routing.locales.includes(params.locale as AppLocale)
    ? (params.locale as AppLocale)
    : routing.defaultLocale;

  if (!code) {
    return NextResponse.redirect(new URL(`/${locale}/auth/login`, requestUrl.origin));
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/${locale}/auth/login?error=auth_callback_failed`, requestUrl.origin),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id) {
    const profile: Database['public']['Tables']['users']['Insert'] = {
      id: user.id,
      email: user.email ?? '',
      display_name:
        user.user_metadata.full_name ?? user.user_metadata.name ?? user.email?.split('@')[0] ?? null,
      avatar_url: user.user_metadata.avatar_url ?? null,
      locale,
    };

    await supabase.schema('public').from('users').upsert(
      profile,
      { onConflict: 'id' },
    );

    await logAppEvent({
      eventName: APP_EVENTS.authCallbackSucceeded,
      locale,
      userId: user.id,
      metadata: {
        provider: typeof user.app_metadata.provider === 'string' ? user.app_metadata.provider : null,
      },
    });
  }

  const redirectPath = next?.startsWith('/') ? next : `/${locale}/dashboard`;

  return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
}
