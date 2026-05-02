import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import type { AppLocale } from '@/i18n/routing';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const getCurrentUser = cache(async () => {
  const supabase = createSupabaseServerClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  const claims = claimsData?.claims;

  if (!claimsError && claims?.sub) {
    const metadata =
      typeof claims.user_metadata === 'object' && claims.user_metadata !== null
        ? claims.user_metadata
        : {};

    return {
      id: claims.sub,
      aud: typeof claims.aud === 'string' ? claims.aud : 'authenticated',
      created_at:
        typeof claims.iat === 'number'
          ? new Date(claims.iat * 1000).toISOString()
          : new Date(0).toISOString(),
      email: typeof claims.email === 'string' ? claims.email : undefined,
      user_metadata: metadata,
      app_metadata:
        typeof claims.app_metadata === 'object' && claims.app_metadata !== null
          ? claims.app_metadata
          : {},
    } as User;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

export async function requireUser(locale: AppLocale) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  return user;
}
