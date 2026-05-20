import { redirect } from 'next/navigation';

import type { AppLocale } from '@/i18n/routing';

export default async function GroupsIndexPage({
  params,
}: {
  params: { locale: string };
}) {
  const locale = params.locale as AppLocale;
  redirect(`/${locale}/dashboard`);
}
