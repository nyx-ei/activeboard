import { getAppUrl } from '@/lib/env';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/types';
import { sendEmailWithResend } from '@/lib/email/resend';

const REMINDER_WINDOWS = [
  { key: '24h', minutesBefore: 24 * 60 },
  { key: '1h', minutesBefore: 60 },
] as const;

const REMINDER_TOLERANCE_MINUTES = 15;

type ReminderWindowKey = (typeof REMINDER_WINDOWS)[number]['key'];

type UserRow = Database['public']['Tables']['users']['Row'];
type ReminderMembershipRow = Pick<Database['public']['Tables']['group_members']['Row'], 'group_id' | 'user_id'>;

function getDueReminderKeys(scheduledAt: string, now: Date): ReminderWindowKey[] {
  const minutesUntilStart = (new Date(scheduledAt).getTime() - now.getTime()) / 60000;

  if (minutesUntilStart <= 0) {
    return [];
  }

  return REMINDER_WINDOWS.filter(
    (window) =>
      minutesUntilStart <= window.minutesBefore &&
      minutesUntilStart > window.minutesBefore - REMINDER_TOLERANCE_MINUTES,
  ).map((window) => window.key);
}

function formatReminderMeta(key: ReminderWindowKey) {
  return key === '24h'
    ? { label: '24 hours', short: '24h' }
    : { label: '1 hour', short: '1h' };
}

function buildReminderCopy(args: {
  locale: 'en' | 'fr';
  memberName: string;
  groupName: string;
  sessionName: string;
  scheduledAt: string;
  shareCode: string;
  meetingLink: string | null;
  reminderKey: ReminderWindowKey;
}) {
  const dateText = new Intl.DateTimeFormat(args.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(args.scheduledAt));

  const reminderMeta = formatReminderMeta(args.reminderKey);
  const sessionLabel = args.sessionName || args.groupName;

  if (args.locale === 'fr') {
    return {
      subject: `Rappel ActiveBoard : ${sessionLabel} dans ${reminderMeta.short}`,
      text: [
        `Bonjour ${args.memberName},`,
        '',
        `La session "${sessionLabel}" du groupe "${args.groupName}" commence dans ${reminderMeta.label}.`,
        `Horaire : ${dateText}`,
        `Code de session : ${args.shareCode}`,
        args.meetingLink ? `Lien de reunion : ${args.meetingLink}` : null,
        `Ouvrir ActiveBoard : ${getAppUrl()}/fr/dashboard`,
      ]
        .filter(Boolean)
        .join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <p>Bonjour ${args.memberName},</p>
          <p>La session <strong>${sessionLabel}</strong> du groupe <strong>${args.groupName}</strong> commence dans ${reminderMeta.label}.</p>
          <p><strong>Horaire :</strong> ${dateText}<br /><strong>Code de session :</strong> ${args.shareCode}</p>
          ${args.meetingLink ? `<p><strong>Lien de reunion :</strong> <a href="${args.meetingLink}">${args.meetingLink}</a></p>` : ''}
          <p><a href="${getAppUrl()}/fr/dashboard">Ouvrir ActiveBoard</a></p>
        </div>
      `,
    };
  }

  return {
    subject: `ActiveBoard reminder: ${sessionLabel} starts in ${reminderMeta.short}`,
    text: [
      `Hi ${args.memberName},`,
      '',
      `Your "${sessionLabel}" session for "${args.groupName}" starts in ${reminderMeta.label}.`,
      `Time: ${dateText}`,
      `Session code: ${args.shareCode}`,
      args.meetingLink ? `Meeting link: ${args.meetingLink}` : null,
      `Open ActiveBoard: ${getAppUrl()}/en/dashboard`,
    ]
      .filter(Boolean)
      .join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <p>Hi ${args.memberName},</p>
        <p>Your <strong>${sessionLabel}</strong> session for <strong>${args.groupName}</strong> starts in ${reminderMeta.label}.</p>
        <p><strong>Time:</strong> ${dateText}<br /><strong>Session code:</strong> ${args.shareCode}</p>
        ${args.meetingLink ? `<p><strong>Meeting link:</strong> <a href="${args.meetingLink}">${args.meetingLink}</a></p>` : ''}
        <p><a href="${getAppUrl()}/en/dashboard">Open ActiveBoard</a></p>
      </div>
    `,
  };
}

export async function dispatchDueSessionReminders(now = new Date()) {
  const supabase = createSupabaseAdminClient();
  const upperBound = new Date(now.getTime() + (24 * 60 + REMINDER_TOLERANCE_MINUTES) * 60000).toISOString();

  const { data: sessions, error: sessionsError } = await supabase
    .schema('public')
    .from('sessions')
    .select('id, group_id, name, scheduled_at, share_code, meeting_link, status')
    .eq('status', 'scheduled')
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', upperBound);

  if (sessionsError) {
    throw new Error(`Failed to load scheduled sessions: ${sessionsError.message}`);
  }

  const dueSessions = (sessions ?? []).flatMap((session) =>
    getDueReminderKeys(session.scheduled_at, now).map((reminderKey) => ({ session, reminderKey })),
  );

  if (dueSessions.length === 0) {
    return { scannedSessions: sessions?.length ?? 0, attemptedReminders: 0, sentReminders: 0 };
  }

  const groupIds = [...new Set(dueSessions.map(({ session }) => session.group_id))];
  const sessionIds = [...new Set(dueSessions.map(({ session }) => session.id))];

  const [{ data: groups }, { data: memberships }, { data: sentReminderRows }] = await Promise.all([
    supabase.schema('public').from('groups').select('id, name').in('id', groupIds),
    supabase.schema('public').from('group_members').select('group_id, user_id').in('group_id', groupIds),
    supabase
      .schema('public')
      .from('session_email_reminders')
      .select('session_id, user_id, reminder_key')
      .in('session_id', sessionIds),
  ]);

  const memberIds = [...new Set((memberships ?? []).map((row) => row.user_id))];
  const { data: users } =
    memberIds.length > 0
      ? await supabase.schema('public').from('users').select('id, email, display_name, locale').in('id', memberIds)
      : { data: [] as Pick<UserRow, 'id' | 'email' | 'display_name' | 'locale'>[] };

  const groupsById = new Map((groups ?? []).map((group) => [group.id, group]));
  const usersById = new Map((users ?? []).map((user) => [user.id, user]));
  const membersByGroup = new Map<string, ReminderMembershipRow[]>();

  for (const member of memberships ?? []) {
    const current = membersByGroup.get(member.group_id) ?? [];
    current.push(member);
    membersByGroup.set(member.group_id, current);
  }

  const sentReminderKeys = new Set(
    (sentReminderRows ?? []).map((row) => `${row.session_id}:${row.user_id}:${row.reminder_key}`),
  );

  let attemptedReminders = 0;
  let sentReminders = 0;

  for (const { session, reminderKey } of dueSessions) {
    const group = groupsById.get(session.group_id);
    const members = membersByGroup.get(session.group_id) ?? [];

    for (const member of members) {
      const user = usersById.get(member.user_id);

      if (!user?.email) {
        continue;
      }

      const sentKey = `${session.id}:${user.id}:${reminderKey}`;
      if (sentReminderKeys.has(sentKey)) {
        continue;
      }

      attemptedReminders += 1;

      const copy = buildReminderCopy({
        locale: user.locale,
        memberName: user.display_name ?? user.email,
        groupName: group?.name ?? 'ActiveBoard',
        sessionName: session.name ?? group?.name ?? 'ActiveBoard',
        scheduledAt: session.scheduled_at,
        shareCode: session.share_code,
        meetingLink: session.meeting_link,
        reminderKey,
      });

      try {
        const providerResponse = await sendEmailWithResend({
          to: user.email,
          subject: copy.subject,
          html: copy.html,
          text: copy.text,
        });

        const { error: reminderInsertError } = await supabase
          .schema('public')
          .from('session_email_reminders')
          .insert({
            session_id: session.id,
            user_id: user.id,
            reminder_key: reminderKey,
            provider_message_id: providerResponse.id,
          });

        if (reminderInsertError) {
          throw new Error(`Failed to persist reminder receipt: ${reminderInsertError.message}`);
        }

        sentReminderKeys.add(sentKey);
        sentReminders += 1;

        await logAppEvent({
          eventName: APP_EVENTS.sessionReminderSent,
          locale: user.locale,
          userId: user.id,
          groupId: session.group_id,
          sessionId: session.id,
          metadata: {
            reminder_key: reminderKey,
            provider: 'resend',
          },
          useAdmin: true,
        });
      } catch (error) {
        await logAppEvent({
          eventName: APP_EVENTS.sessionReminderFailed,
          level: 'error',
          locale: user.locale,
          userId: user.id,
          groupId: session.group_id,
          sessionId: session.id,
          metadata: {
            reminder_key: reminderKey,
            error_message: error instanceof Error ? error.message : 'Unknown reminder error',
          },
          useAdmin: true,
        });
      }
    }
  }

  return {
    scannedSessions: sessions?.length ?? 0,
    attemptedReminders,
    sentReminders,
  };
}
