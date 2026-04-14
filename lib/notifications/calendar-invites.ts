import { Buffer } from 'node:buffer';

import { getAppUrl } from '@/lib/env';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/types';
import { buildSessionIcs } from '@/lib/calendar/ics';
import { sendEmail } from '@/lib/email/mailersend';
import { renderPlainTextEmail, renderTransactionalEmail } from '@/lib/email/templates';

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
      text: renderPlainTextEmail({
        title: 'Session ActiveBoard programmée',
        preheader: `${sessionLabel} est maintenant dans votre calendrier ActiveBoard.`,
        intro: [
          `Bonjour ${args.memberName},`,
          `La session "${sessionLabel}" du groupe "${args.groupName}" a été programmée.`,
          'Ajoutez l’invitation calendrier jointe et ouvrez ActiveBoard au moment de la session pour répondre aux questions.',
        ],
        details: [
          { label: 'Groupe', value: args.groupName },
          { label: 'Session', value: sessionLabel },
          { label: 'Horaire', value: dateText },
          { label: 'Code de session', value: args.shareCode },
          ...(args.meetingLink ? [{ label: 'Lien de réunion', value: args.meetingLink }] : []),
        ],
        action: { label: 'Ouvrir ActiveBoard', url: `${getAppUrl()}/fr/dashboard` },
        secondaryNote: 'Une invitation calendrier .ics est jointe à cet email.',
      }),
      html: renderTransactionalEmail({
        title: 'Session ActiveBoard programmée',
        preheader: `${sessionLabel} est maintenant dans votre calendrier ActiveBoard.`,
        intro: [
          `Bonjour ${args.memberName},`,
          `La session "${sessionLabel}" du groupe "${args.groupName}" a été programmée.`,
          'Ajoutez l’invitation calendrier jointe et ouvrez ActiveBoard au moment de la session pour répondre aux questions.',
        ],
        details: [
          { label: 'Groupe', value: args.groupName },
          { label: 'Session', value: sessionLabel },
          { label: 'Horaire', value: dateText },
          { label: 'Code de session', value: args.shareCode },
          ...(args.meetingLink ? [{ label: 'Lien de réunion', value: args.meetingLink }] : []),
        ],
        action: { label: 'Ouvrir ActiveBoard', url: `${getAppUrl()}/fr/dashboard` },
        secondaryNote: 'Une invitation calendrier .ics est jointe à cet email.',
      }),
      description: `Session ActiveBoard pour ${args.groupName}. Code de session: ${args.shareCode}${args.meetingLink ? ` - Lien: ${args.meetingLink}` : ''}`,
    };
  }

  return {
    subject: `ActiveBoard calendar invite: ${sessionLabel}`,
    text: renderPlainTextEmail({
      title: 'ActiveBoard session scheduled',
      preheader: `${sessionLabel} is now ready in your ActiveBoard calendar.`,
      intro: [
        `Hi ${args.memberName},`,
        `The "${sessionLabel}" session for "${args.groupName}" has been scheduled.`,
        'Add the attached calendar invite and open ActiveBoard when the session starts to answer questions.',
      ],
      details: [
        { label: 'Group', value: args.groupName },
        { label: 'Session', value: sessionLabel },
        { label: 'Time', value: dateText },
        { label: 'Session code', value: args.shareCode },
        ...(args.meetingLink ? [{ label: 'Meeting link', value: args.meetingLink }] : []),
      ],
      action: { label: 'Open ActiveBoard', url: `${getAppUrl()}/en/dashboard` },
      secondaryNote: 'A calendar .ics invite is attached to this email.',
    }),
    html: renderTransactionalEmail({
      title: 'ActiveBoard session scheduled',
      preheader: `${sessionLabel} is now ready in your ActiveBoard calendar.`,
      intro: [
        `Hi ${args.memberName},`,
        `The "${sessionLabel}" session for "${args.groupName}" has been scheduled.`,
        'Add the attached calendar invite and open ActiveBoard when the session starts to answer questions.',
      ],
      details: [
        { label: 'Group', value: args.groupName },
        { label: 'Session', value: sessionLabel },
        { label: 'Time', value: dateText },
        { label: 'Session code', value: args.shareCode },
        ...(args.meetingLink ? [{ label: 'Meeting link', value: args.meetingLink }] : []),
      ],
      action: { label: 'Open ActiveBoard', url: `${getAppUrl()}/en/dashboard` },
      secondaryNote: 'A calendar .ics invite is attached to this email.',
    }),
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
      const providerResponse = await sendEmail({
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
          provider: 'mailersend',
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
