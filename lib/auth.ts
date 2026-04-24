import { cache } from 'react';
import { redirect } from 'next/navigation';

import type { AppLocale } from '@/i18n/routing';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const getCurrentUser = cache(async () => {
  const supabase = createSupabaseServerClient();
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
