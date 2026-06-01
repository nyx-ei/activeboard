import { notFound } from 'next/navigation';

import { OpsDashboardView } from '@/components/ops/ops-dashboard-view';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { getOpsDashboardData } from '@/lib/ops/dashboard';

type OpsDashboardPageProps = {
  params: { locale: string };
};

function canAccessOpsDashboard(email: string | undefined) {
  const allowlist = process.env.OPS_DASHBOARD_ALLOWED_EMAILS;

  if (!allowlist) {
    return true;
  }

  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  return allowlist
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizedEmail);
}

export default async function OpsDashboardPage({
  params,
}: OpsDashboardPageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);

  if (!canAccessOpsDashboard(user.email)) {
    notFound();
  }

  const data = await getOpsDashboardData();

  return <OpsDashboardView backHref="/dashboard" data={data} />;
}
