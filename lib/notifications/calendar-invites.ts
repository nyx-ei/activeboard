import { Buffer } from 'node:buffer';

import { getAppUrl } from '@/lib/env';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/types';
import { buildSessionIcs } from '@/lib/calendar/ics';
import { sendEmailWithResend } from '@/lib/email/resend';

type SessionRow = Database['public']['Tables']['sessions']['Row'];

function buildCalendarInviteCopy(args: {
  locale: 'en' | 'fr';
  memberName: string;
  groupName: string;
  sessionName: string;
  scheduledAt: string;
  shareCode: string;
  meetingLink: string | null;
}) {
  const dateText = new Intl.DateTimeFormat(args.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(args.scheduledAt));

  const sessionLabel = args.sessionName || args.groupName;

  if (args.locale === 'fr') {
    return {
      subject: `Invitation calendrier ActiveBoard : ${sessionLabel}`,
      text: [
        `Bonjour ${args.memberName},`,
        '',
        `La session "${sessionLabel}" du groupe "${args.groupName}" a ete programmee.`,
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
          <p>La session <strong>${sessionLabel}</strong> du groupe <strong>${args.groupName}</strong> a ete programmee.</p>
          <p><strong>Horaire :</strong> ${dateText}<br /><strong>Code de session :</strong> ${args.shareCode}</p>
          ${args.meetingLink ? `<p><strong>Lien de reunion :</strong> <a href="${args.meetingLink}">${args.meetingLink}</a></p>` : ''}
          <p>Tu trouveras en piece jointe une invitation calendrier (.ics).</p>
          <p><a href="${getAppUrl()}/fr/dashboard">Ouvrir ActiveBoard</a></p>
        </div>
      `,
      description: `Session ActiveBoard pour ${args.groupName}. Code de session: ${args.shareCode}${args.meetingLink ? ` - Lien: ${args.meetingLink}` : ''}`,
    };
  }

  return {
    subject: `ActiveBoard calendar invite: ${sessionLabel}`,
    text: [
      `Hi ${args.memberName},`,
      '',
      `The "${sessionLabel}" session for "${args.groupName}" has been scheduled.`,
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
        <p>The <strong>${sessionLabel}</strong> session for <strong>${args.groupName}</strong> has been scheduled.</p>
        <p><strong>Time:</strong> ${dateText}<br /><strong>Session code:</strong> ${args.shareCode}</p>
        ${args.meetingLink ? `<p><strong>Meeting link:</strong> <a href="${args.meetingLink}">${args.meetingLink}</a></p>` : ''}
        <p>An .ics calendar invite is attached.</p>
        <p><a href="${getAppUrl()}/en/dashboard">Open ActiveBoard</a></p>
      </div>
    `,
    description: `ActiveBoard session for ${args.groupName}. Session code: ${args.shareCode}${args.meetingLink ? ` - Meeting link: ${args.meetingLink}` : ''}`,
  };
}

export async function sendSessionCalendarInvites(session: Pick<SessionRow, 'id' | 'group_id' | 'name' | 'scheduled_at' | 'share_code' | 'meeting_link' | 'timer_seconds'>) {
  const supabase = createSupabaseAdminClient();

  const [{ data: group }, { data: memberships }, { data: alreadySentRows }] = await Promise.all([
    supabase.schema('public').from('groups').select('id, name').eq('id', session.group_id).maybeSingle(),
    supabase.schema('public').from('group_members').select('user_id').eq('group_id', session.group_id),
    supabase
      .schema('public')
      .from('session_calendar_invites')
      .select('user_id')
      .eq('session_id', session.id),
  ]);

  const memberIds = [...new Set((memberships ?? []).map((membership) => membership.user_id))];
  if (memberIds.length === 0) {
    return { attempted: 0, sent: 0 };
  }

  const { data: users } = await supabase
    .schema('public')
    .from('users')
    .select('id, email, display_name, locale')
    .in('id', memberIds);

  const sentUserIds = new Set((alreadySentRows ?? []).map((row) => row.user_id));
  let attempted = 0;
  let sent = 0;

  for (const user of users ?? []) {
    if (!user.email || sentUserIds.has(user.id)) {
      continue;
    }

    attempted += 1;

    const copy = buildCalendarInviteCopy({
      locale: user.locale,
      memberName: user.display_name ?? user.email,
      groupName: group?.name ?? 'ActiveBoard',
      sessionName: session.name ?? group?.name ?? 'ActiveBoard',
      scheduledAt: session.scheduled_at,
      shareCode: session.share_code,
      meetingLink: session.meeting_link,
    });

    const ics = buildSessionIcs({
      sessionId: session.id,
      sessionName: session.name ?? group?.name ?? 'ActiveBoard',
      groupName: group?.name ?? 'ActiveBoard',
      scheduledAt: session.scheduled_at,
      durationMinutes: Math.max(30, Math.ceil(session.timer_seconds / 60) * 10),
      meetingLink: session.meeting_link,
      description: copy.description,
    });

    try {
      const providerResponse = await sendEmailWithResend({
        to: user.email,
        subject: copy.subject,
        html: copy.html,
        text: copy.text,
        attachments: [
          {
            filename: 'activeboard-session.ics',
            content: Buffer.from(ics, 'utf8').toString('base64'),
            contentType: 'text/calendar; charset=utf-8; method=REQUEST',
          },
        ],
      });

      const { error: insertError } = await supabase
        .schema('public')
        .from('session_calendar_invites')
        .insert({
          session_id: session.id,
          user_id: user.id,
          provider_message_id: providerResponse.id,
        });

      if (insertError) {
        throw new Error(`Failed to persist calendar invite receipt: ${insertError.message}`);
      }

      sent += 1;

      await logAppEvent({
        eventName: APP_EVENTS.sessionCalendarInviteSent,
        locale: user.locale,
        userId: user.id,
        groupId: session.group_id,
        sessionId: session.id,
        metadata: {
          provider: 'resend',
        },
        useAdmin: true,
      });
    } catch (error) {
      await logAppEvent({
        eventName: APP_EVENTS.sessionCalendarInviteFailed,
        level: 'error',
        locale: user.locale,
        userId: user.id,
        groupId: session.group_id,
        sessionId: session.id,
        metadata: {
          error_message: error instanceof Error ? error.message : 'Unknown calendar invite error',
        },
        useAdmin: true,
      });
    }
  }

  return { attempted, sent };
}
