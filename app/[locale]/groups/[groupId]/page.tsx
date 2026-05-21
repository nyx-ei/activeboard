import { redirect } from 'next/navigation';

import type { AppLocale } from '@/i18n/routing';

export default function GroupRoutePage({
  params,
  searchParams,
}: {
  params: { locale: string; groupId: string };
  searchParams: { live?: string };
}) {
  const locale = params.locale as AppLocale;

  if (searchParams.live === '1') {
    redirect(`/${locale}/lookup`);
  }

  redirect(`/${locale}/dashboard?groupId=${encodeURIComponent(params.groupId)}`);
}
