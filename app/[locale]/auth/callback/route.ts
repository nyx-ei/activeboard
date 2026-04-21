import { NextResponse } from 'next/server';

import { routing, type AppLocale } from '@/i18n/routing';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { hasEmailEnv } from '@/lib/env';
import { sendAccountWelcomeEmail } from '@/lib/notifications/account';
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
    const { data: existingProfile } = await supabase
      .schema('public')
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    const profile: Database['public']['Tables']['users']['Insert'] = {
      id: user.id,
      email: user.email ?? '',
      display_name:
        user.user_metadata.full_name ?? user.user_metadata.name ?? user.email?.split('@')[0] ?? null,
      avatar_url: user.user_metadata.avatar_url ?? null,
      exam_type:
        typeof user.user_metadata.exam_type === 'string'
          ? (user.user_metadata.exam_type as 'mccqe1' | 'usmle' | 'plab' | 'other')
          : null,
      exam_session:
        typeof user.user_metadata.exam_session === 'string'
          ? (user.user_metadata.exam_session as 'april_may_2026' | 'august_september_2026' | 'october_2026' | 'planning_ahead')
          : null,
      question_banks: Array.isArray(user.user_metadata.question_banks)
        ? user.user_metadata.question_banks.filter((value): value is string => typeof value === 'string')
        : [],
      locale,
    };

    await supabase.schema('public').from('users').upsert(
      profile,
      { onConflict: 'id' },
    );

    if (!existingProfile && hasEmailEnv() && user.email) {
      await sendAccountWelcomeEmail({
        locale,
        email: user.email,
        userId: user.id,
        displayName: profile.display_name,
      });
    }

    await logAppEvent({
      eventName: APP_EVENTS.authCallbackSucceeded,
      locale,
      userId: user.id,
      metadata: {
        provider: typeof user.app_metadata.provider === 'string' ? user.app_metadata.provider : null,
      },
    });
  }

  let redirectPath = next?.startsWith('/') ? next : `/${locale}/dashboard`;

  if (!next && user?.id) {
    const { data: firstMembership } = await supabase
      .schema('public')
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!firstMembership?.group_id) {
      redirectPath = `/${locale}/create-group`;
    }
  }

  return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
}
