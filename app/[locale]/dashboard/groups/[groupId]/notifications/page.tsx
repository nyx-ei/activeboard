import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import {
  DashboardGroupNotificationsView,
  type DashboardGroupNotificationItem,
} from '@/components/dashboard/dashboard-group-notifications-view';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { withLocalePath } from '@/lib/notifications/in-app';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type DashboardGroupNotificationsPageProps = {
  params: { locale: string; groupId: string };
};

type NotificationRow = {
  id: string;
  title_en: string;
  title_fr: string;
  body_en: string;
  body_fr: string;
  target_path: string;
  read_at: string | null;
  created_at: string;
};

export default async function DashboardGroupNotificationsPage({
  params,
}: DashboardGroupNotificationsPageProps) {
  const locale = params.locale as AppLocale;
  const groupId = params.groupId;
  const user = await requireUser(locale);
  const t = await getTranslations('Dashboard');
  const supabase = createSupabaseServerClient();

  const [{ data: membership }, { data: group }] = await Promise.all([
    supabase
      .schema('public')
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .schema('public')
      .from('groups')
      .select('id, name')
      .eq('id', groupId)
      .maybeSingle(),
  ]);

  if (!membership || !group) {
    notFound();
  }

  const [notificationsResult, unreadResult] = await Promise.all([
    (supabase.schema('public') as unknown as {
      from: (relation: 'notifications') => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => {
              order: (
                column: string,
                options: { ascending: boolean },
              ) => {
                limit: (count: number) => Promise<{
                  data: NotificationRow[] | null;
                }>;
              };
            };
          };
        };
      };
    })
      .from('notifications')
      .select(
        'id, title_en, title_fr, body_en, body_fr, target_path, read_at, created_at',
      )
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(80),
    (supabase.schema('public') as unknown as {
      from: (relation: 'notifications') => {
        select: (
          columns: string,
          options: { count: 'exact'; head: true },
        ) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => {
              is: (
                column: string,
                value: null,
              ) => Promise<{ count: number | null }>;
            };
          };
        };
      };
    })
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .is('read_at', null),
  ]);

  const notifications: DashboardGroupNotificationItem[] = (
    notificationsResult.data ?? []
  ).map((notification) => ({
    id: notification.id,
    title: locale === 'fr' ? notification.title_fr : notification.title_en,
    body: locale === 'fr' ? notification.body_fr : notification.body_en,
    href: withLocalePath(locale, notification.target_path),
    readAt: notification.read_at,
    createdAt: notification.created_at,
  }));

  return (
    <DashboardGroupNotificationsView
      groupId={groupId}
      backHref={`/dashboard?groupId=${encodeURIComponent(groupId)}`}
      groupName={group.name}
      notifications={notifications}
      unreadCount={unreadResult.count ?? 0}
      locale={locale}
      labels={{
        back: t('secondaryBackToDashboard'),
        title: t('zoneGroupNotificationsTitle'),
        description: t('zoneGroupNotificationsDescription'),
        empty: t('zoneGroupNotificationsEmpty'),
        unread: t('zoneGroupNotificationsUnread', { count: '{count}' }),
      }}
    />
  );
}
