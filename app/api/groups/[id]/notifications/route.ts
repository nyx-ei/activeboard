import { NextResponse } from 'next/server';

import type { AppLocale } from '@/i18n/routing';
import { withLocalePath } from '@/lib/notifications/in-app';
import { getCurrentAuthUser } from '@/lib/session/flow';

type RouteContext = {
  params: { id: string };
};

type NotificationRow = {
  id: string;
  type: string;
  title_en: string;
  title_fr: string;
  body_en: string;
  body_fr: string;
  target_path: string;
  read_at: string | null;
  created_at: string;
};

type PatchPayload = {
  notificationId?: unknown;
};

function parseLocale(request: Request): AppLocale {
  const locale = new URL(request.url).searchParams.get('locale');
  return locale === 'fr' ? 'fr' : 'en';
}

function notificationsTable(supabase: Awaited<ReturnType<typeof getCurrentAuthUser>>['supabase']) {
  return (supabase.schema('public') as unknown as {
    from: (relation: 'notifications') => {
      select: (
        columns: string,
        options?: { count?: 'exact'; head?: boolean },
      ) => {
        eq: (column: string, value: string) => unknown;
      };
      update: (values: unknown) => {
        eq: (
          column: string,
          value: string,
        ) => {
          eq: (
            column: string,
            value: string,
          ) => {
            eq: (
              column: string,
              value: string,
            ) => Promise<{ error: { message?: string } | null }>;
          };
        };
      };
    };
  }).from('notifications');
}

export async function GET(request: Request, { params }: RouteContext) {
  const groupId = params.id;
  const locale = parseLocale(request);
  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const [notificationsResult, unreadResult] = await Promise.all([
    (notificationsTable(supabase).select(
      'id, type, title_en, title_fr, body_en, body_fr, target_path, read_at, created_at',
    ) as {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          order: (
            column: string,
            options: { ascending: boolean },
          ) => {
            limit: (count: number) => Promise<{
              data: NotificationRow[] | null;
              error: { message?: string } | null;
            }>;
          };
        };
      };
    })
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(50),
    (notificationsTable(supabase).select('id', {
      count: 'exact',
      head: true,
    }) as {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          is: (
            column: string,
            value: null,
          ) => Promise<{ count: number | null; error: { message?: string } | null }>;
        };
      };
    })
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .is('read_at', null),
  ]);

  if (notificationsResult.error || unreadResult.error) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      unreadCount: unreadResult.count ?? 0,
      notifications: (notificationsResult.data ?? []).map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: locale === 'fr' ? notification.title_fr : notification.title_en,
        body: locale === 'fr' ? notification.body_fr : notification.body_en,
        href: withLocalePath(locale, notification.target_path),
        readAt: notification.read_at,
        createdAt: notification.created_at,
      })),
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  );
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const groupId = params.id;
  const payload = (await request.json().catch(() => null)) as PatchPayload | null;
  const notificationId =
    typeof payload?.notificationId === 'string' ? payload.notificationId : '';
  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!notificationId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { error } = await notificationsTable(supabase)
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', user.id)
    .eq('group_id', groupId);

  if (error) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
