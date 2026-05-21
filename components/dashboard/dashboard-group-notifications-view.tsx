'use client';

import { useState } from 'react';
import { ArrowLeft, Bell, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Link } from '@/i18n/navigation';

export type DashboardGroupNotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};

type DashboardGroupNotificationsViewProps = {
  groupId: string;
  backHref: string;
  groupName: string;
  notifications: DashboardGroupNotificationItem[];
  unreadCount: number;
  locale: string;
  labels: {
    back: string;
    title: string;
    description: string;
    empty: string;
    unread: string;
  };
};

export function DashboardGroupNotificationsView({
  groupId,
  backHref,
  groupName,
  notifications: initialNotifications,
  unreadCount: initialUnreadCount,
  locale,
  labels,
}: DashboardGroupNotificationsViewProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  async function openNotification(notification: DashboardGroupNotificationItem) {
    if (!notification.readAt) {
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, readAt } : item,
        ),
      );
      setUnreadCount((current) => Math.max(0, current - 1));

      void fetch(`/api/groups/${groupId}/notifications`, {
        method: 'PATCH',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: notification.id }),
      });
    }

    router.push(notification.href as never);
  }

  return (
    <main className="flex flex-1 flex-col bg-[#00100f]">
      <section className="mx-auto w-full max-w-[1440px] px-3 pb-10 pt-0 sm:px-2">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={backHref as never}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-white/[0.06] bg-white/[0.025] px-3 text-[13px] font-medium text-[#d7e3df] transition hover:border-[#20D9A3]/35 hover:bg-[#20D9A3]/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {labels.back}
          </Link>
          <MetricPill>
            {unreadCount > 0
              ? labels.unread.replace('{count}', String(unreadCount))
              : groupName}
          </MetricPill>
        </div>

        <header className="mb-[18px] flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="m-0 text-[30px] font-medium leading-[1.15] tracking-normal text-[#e8f4f0]">
              {labels.title}
            </h1>
            <p className="mt-2 max-w-[640px] text-[14px] leading-[1.55] text-[#8fa7a2]">
              {labels.description}
            </p>
          </div>
        </header>

        <section className="v11-card p-4 sm:p-5">
          <div className="max-h-[min(72vh,680px)] space-y-2 overflow-y-auto pr-1">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  locale={locale}
                  onOpen={() => void openNotification(notification)}
                />
              ))
            ) : (
              <div className="rounded-[12px] border border-dashed border-white/[0.08] px-4 py-8 text-center text-sm font-semibold text-[#8fa7a2]">
                {labels.empty}
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function NotificationRow({
  notification,
  locale,
  onOpen,
}: {
  notification: DashboardGroupNotificationItem;
  locale: string;
  onOpen: () => void;
}) {
  const isUnread = !notification.readAt;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-start gap-3 rounded-[12px] border px-3 py-3 text-left transition hover:bg-white/[0.04] sm:px-4 sm:py-4 ${
        isUnread
          ? 'border-[#20D9A3]/25 bg-[#20D9A3]/[0.06]'
          : 'border-white/[0.055] bg-white/[0.02]'
      }`}
    >
      <span
        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border ${
          isUnread
            ? 'border-[#20D9A3]/25 bg-[#20D9A3]/10 text-[#9FF0CE]'
            : 'border-white/[0.055] bg-white/[0.025] text-[#8fa7a2]'
        }`}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-start justify-between gap-3">
          <span className="min-w-0 text-[15px] font-semibold leading-5 text-[#e8f4f0]">
            {notification.title}
          </span>
          {isUnread ? (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#20D9A3]" />
          ) : null}
        </span>
        <span className="mt-1 block text-[13px] leading-5 text-[#8fa7a2]">
          {notification.body}
        </span>
        <span className="mt-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[#5f7b75]">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {formatNotificationDate(notification.createdAt, locale)}
        </span>
      </span>
    </button>
  );
}

function MetricPill({ children }: { children: string }) {
  return (
    <span className="inline-flex h-7 items-center rounded-full border border-white/[0.06] bg-white/[0.025] px-3 text-[12px] font-medium text-[#8fa7a2]">
      {children}
    </span>
  );
}

function formatNotificationDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
