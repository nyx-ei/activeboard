import type { AppLocale } from '@/i18n/routing';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type InAppNotificationType =
  | 'session_scheduled'
  | 'session_starting_soon'
  | 'session_started'
  | 'session_cancelled'
  | 'group_invite'
  | 'group_invite_accepted'
  | 'group_member_added';

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type NotificationCopy = {
  titleEn: string;
  titleFr: string;
  bodyEn: string;
  bodyFr: string;
};

type CreateInAppNotificationInput = NotificationCopy & {
  userId: string;
  type: InAppNotificationType;
  targetPath: string;
  groupId?: string | null;
  sessionId?: string | null;
  invitationId?: string | null;
  admin?: SupabaseAdminClient;
};

type CreateGroupNotificationsInput = NotificationCopy & {
  groupId: string;
  type: InAppNotificationType;
  targetPath: string;
  actorUserId?: string | null;
  sessionId?: string | null;
  invitationId?: string | null;
  admin?: SupabaseAdminClient;
};

function getAdmin(admin?: SupabaseAdminClient) {
  return admin ?? createSupabaseAdminClient();
}

function notificationsTable(admin: SupabaseAdminClient) {
  return (admin.schema('public') as unknown as {
    from: (relation: 'notifications') => {
      insert: (values: unknown) => Promise<{ error: { message?: string } | null }>;
    };
  }).from('notifications');
}

export function withLocalePath(locale: AppLocale, targetPath: string) {
  if (targetPath.startsWith(`/${locale}/`)) {
    return targetPath;
  }

  const normalized = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
  return `/${locale}${normalized}`;
}

export async function createInAppNotification({
  admin: providedAdmin,
  userId,
  groupId = null,
  sessionId = null,
  invitationId = null,
  type,
  titleEn,
  titleFr,
  bodyEn,
  bodyFr,
  targetPath,
}: CreateInAppNotificationInput) {
  const admin = getAdmin(providedAdmin);
  const { error } = await notificationsTable(admin).insert({
    user_id: userId,
    group_id: groupId,
    session_id: sessionId,
    invitation_id: invitationId,
    type,
    title_en: titleEn,
    title_fr: titleFr,
    body_en: bodyEn,
    body_fr: bodyFr,
    target_path: targetPath,
  });

  if (error) {
    console.error('createInAppNotification failed', {
      type,
      userId,
      groupId,
      sessionId,
      invitationId,
      error: error.message,
    });
  }
}

export async function createGroupNotifications({
  admin: providedAdmin,
  groupId,
  actorUserId = null,
  sessionId = null,
  invitationId = null,
  type,
  titleEn,
  titleFr,
  bodyEn,
  bodyFr,
  targetPath,
}: CreateGroupNotificationsInput) {
  const admin = getAdmin(providedAdmin);
  const { data: memberships } = await admin
    .schema('public')
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId);
  const userIds = Array.from(
    new Set(
      (memberships ?? [])
        .map((membership) => membership.user_id)
        .filter(
          (userId): userId is string =>
            Boolean(userId) && userId !== actorUserId,
        ),
    ),
  );

  if (userIds.length === 0) {
    return;
  }

  const { error } = await notificationsTable(admin).insert(
    userIds.map((userId) => ({
      user_id: userId,
      group_id: groupId,
      session_id: sessionId,
      invitation_id: invitationId,
      type,
      title_en: titleEn,
      title_fr: titleFr,
      body_en: bodyEn,
      body_fr: bodyFr,
      target_path: targetPath,
    })),
  );

  if (error) {
    console.error('createGroupNotifications failed', {
      type,
      groupId,
      sessionId,
      invitationId,
      error: error.message,
    });
  }
}
