import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { headers } from 'next/headers';

import { OpsDashboardView } from '@/components/ops/ops-dashboard-view';
import type { AppLocale } from '@/i18n/routing';
import { canAccessOpsDashboard } from '@/lib/admin/access';
import { requireUser } from '@/lib/auth';
import { getOpsDashboardData } from '@/lib/ops/dashboard';

type OpsDashboardPageProps = {
  params: { locale: string };
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OpsDashboardPage({
  params,
}: OpsDashboardPageProps) {
  noStore();
  headers();

  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);

  if (!canAccessOpsDashboard(user.email)) {
    notFound();
  }

  const data = await getOpsDashboardData();

  return <OpsDashboardView backHref="/dashboard" data={data} />;
}
