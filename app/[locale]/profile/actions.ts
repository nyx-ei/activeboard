'use server';

import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { hasEmailEnv } from '@/lib/env';
import { sendPasswordChangedEmail } from '@/lib/notifications/account';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withFeedback } from '@/lib/utils';

export async function updateProfileAction(formData: FormData) {
  const locale = ((formData.get('locale') as string | null) ?? 'en') as AppLocale;
  const displayName = ((formData.get('displayName') as string | null) ?? '').trim();
  const examSession = ((formData.get('examSession') as string | null) ?? '').trim();
  const questionBanks = formData.getAll('questionBanks').map((value) => String(value));
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const user = await requireUser(locale);

  if (!displayName) {
    redirect(withFeedback(`/${locale}/profile`, 'error', t('missingFields')));
  }

  const supabase = createSupabaseServerClient();
  const { error: authError } = await supabase.auth.updateUser({
    data: {
      ...user.user_metadata,
      full_name: displayName,
      exam_session: examSession || null,
      question_banks: questionBanks,
    },
  });

  if (authError) {
    redirect(withFeedback(`/${locale}/profile`, 'error', t('actionFailed')));
  }

  const { error: profileError } = await supabase
    .schema('public')
    .from('users')
    .update({
      display_name: displayName,
      exam_session: examSession
        ? (examSession as 'april_may_2026' | 'august_september_2026' | 'october_2026' | 'planning_ahead')
        : null,
      question_banks: questionBanks,
    })
    .eq('id', user.id);

  if (profileError) {
    redirect(withFeedback(`/${locale}/profile`, 'error', t('actionFailed')));
  }

  redirect(withFeedback(`/${locale}/profile`, 'success', t('profileUpdated')));
}

export async function updatePasswordAction(formData: FormData) {
  const locale = ((formData.get('locale') as string | null) ?? 'en') as AppLocale;
  const password = ((formData.get('password') as string | null) ?? '').trim();
  const t = await getTranslations({ locale, namespace: 'Feedback' });

  const user = await requireUser(locale);

  if (password.length < 8) {
    redirect(withFeedback(`/${locale}/profile`, 'error', t('passwordTooShort')));
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(withFeedback(`/${locale}/profile`, 'error', t('actionFailed')));
  }

  if (hasEmailEnv() && user.email) {
    await sendPasswordChangedEmail({
      locale,
      email: user.email,
      userId: user.id,
      displayName: user.user_metadata.full_name ?? user.email,
    });
  }

  redirect(withFeedback(`/${locale}/profile`, 'success', t('passwordUpdated')));
}
