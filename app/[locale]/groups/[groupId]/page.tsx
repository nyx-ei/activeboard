import { redirect } from 'next/navigation';

import type { AppLocale } from '@/i18n/routing';

export default function GroupRoutePage({
  params,
}: {
  params: { locale: string; groupId: string };
}) {
  const locale = params.locale as AppLocale;

  redirect(`/${locale}/dashboard?groupId=${encodeURIComponent(params.groupId)}`);
}
