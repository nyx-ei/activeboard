import { Buffer } from 'node:buffer';

import { buildSessionIcs } from '@/lib/calendar/ics';
import { sendEmail } from '@/lib/email/mailersend';
import { renderPlainTextEmail, renderTransactionalEmail } from '@/lib/email/templates';
import { getAppUrl } from '@/lib/env';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/types';

type SessionRow = Database['public']['Tables']['sessions']['Row'];

type CalendarInviteSession = Pick<
  SessionRow,
  | 'id'
  | 'group_id'
  | 'name'
  | 'scheduled_at'
  | 'share_code'
  | 'meeting_link'
  | 'timer_seconds'
> &
  Partial<Pick<SessionRow, 'leader_id'>>;

function normalizeLocale(locale: string | null | undefined): 'en' | 'fr' {
  return locale === 'fr' ? 'fr' : 'en';
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getMemberLine(
  user: { display_name: string | null; email: string; phone_number?: string | null },
  locale: 'en' | 'fr',
) {
  const name = user.display_name?.trim() || user.email;
  const phone = user.phone_number?.trim() || (locale === 'fr' ? 'telephone non renseigne' : 'no phone');
  return `${name} · ${phone} · ${user.email}`;
}

function buildCoordinationLinks(args: {
  emails: string[];
  sessionLabel: string;
  locale: 'en' | 'fr';
}) {
  const subject =
    args.locale === 'fr'
      ? `Session ActiveBoard - ${args.sessionLabel}`
      : `ActiveBoard session - ${args.sessionLabel}`;
  const body =
    args.locale === 'fr'
      ? `Bonjour, confirmons l'heure exacte, le lien de reunion et le demarrage de la session ActiveBoard "${args.sessionLabel}".`
      : `Hi, let's confirm the exact time, meeting link, and session start for "${args.sessionLabel}" on ActiveBoard.`;

  return {
    emailGroupUrl: `mailto:${args.emails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(body)}`,
  };
}

function buildCalendarInviteCopy(args: {
  locale: 'en' | 'fr';
  memberName: string;
  groupName: string;
  sessionName: string;
  scheduledAt: string;
  shareCode: string;
  meetingLink: string | null;
  leaderName: string;
  memberDetails: string[];
  emailGroupUrl: string;
  whatsappUrl: string;
}) {
  const dateText = new Intl.DateTimeFormat(args.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(args.scheduledAt));

  const sessionLabel = args.sessionName || args.groupName;
  const sharedDetails = [
    {
      label:
        args.locale === 'fr'
          ? 'Responsable de demarrage'
          : 'Start responsible',
      value: args.leaderName,
    },
    {
      label: args.locale === 'fr' ? 'Membres' : 'Members',
      value: args.memberDetails.join('\n'),
    },
    {
      label:
        args.locale === 'fr'
          ? 'Créer le groupe WhatsApp'
          : 'Create WhatsApp group',
      value: args.whatsappUrl,
    },
    {
      label:
        args.locale === 'fr'
          ? 'Envoyer un courriel au groupe'
          : 'Email the group',
      value: args.emailGroupUrl,
    },
  ];
  const leaderNote =
    args.locale === 'fr'
      ? "Responsabilite de demarrage : creer le groupe WhatsApp ou le fil email, confirmer l'heure exacte, partager le lien de reunion et cliquer sur Demarrer. Ce n'est pas un role de chef, d'enseignant, d'evaluateur ou de garant de performance. Chaque membre confirme sa presence et repond lui-meme au feedback apres la session. La Qbank peut venir de n'importe quel membre. Si WhatsApp bloque, utilisez le courriel."
      : 'Start responsibility: create the WhatsApp group or email thread, confirm the exact time, share the meeting link, and click Start session. This is not a boss, teacher, evaluator, or performance-owner role. Each member confirms their own attendance and answers their own post-session feedback. The Qbank can come from anyone. If WhatsApp blocks you, use email.';

  if (args.locale === 'fr') {
    const emailArgs = {
      title: 'Session ActiveBoard programmee',
      preheader: `${sessionLabel} est maintenant dans votre calendrier ActiveBoard.`,
      intro: [
        `Bonjour ${args.memberName},`,
        `La session "${sessionLabel}" du groupe "${args.groupName}" a ete programmee.`,
        "Ajoutez l'invitation calendrier jointe et ouvrez ActiveBoard au moment de la session pour repondre aux questions.",
      ],
      details: [
        { label: 'Groupe', value: args.groupName },
        { label: 'Session', value: sessionLabel },
        { label: 'Horaire', value: dateText },
        { label: 'Code de session', value: args.shareCode },
        ...(args.meetingLink ? [{ label: 'Lien de reunion', value: args.meetingLink }] : []),
        ...sharedDetails,
      ],
      action: { label: 'Ouvrir ActiveBoard', url: `${getAppUrl()}/fr/dashboard` },
      secondaryNote: leaderNote,
    };

    return {
      subject: `Invitation calendrier ActiveBoard : ${sessionLabel}`,
      text: renderPlainTextEmail(emailArgs),
      html: renderTransactionalEmail(emailArgs),
      description: `Session ActiveBoard pour ${args.groupName}. Code de session: ${args.shareCode}${args.meetingLink ? ` - Lien: ${args.meetingLink}` : ''}`,
    };
  }

  const emailArgs = {
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
      ...sharedDetails,
    ],
    action: { label: 'Open ActiveBoard', url: `${getAppUrl()}/en/dashboard` },
    secondaryNote: leaderNote,
  };

  return {
    subject: `ActiveBoard calendar invite: ${sessionLabel}`,
    text: renderPlainTextEmail(emailArgs),
    html: renderTransactionalEmail(emailArgs),
    description: `ActiveBoard session for ${args.groupName}. Session code: ${args.shareCode}${args.meetingLink ? ` - Meeting link: ${args.meetingLink}` : ''}`,
  };
}

export async function sendSessionCalendarInvites(session: CalendarInviteSession) {
  const supabase = createSupabaseAdminClient();

  const [{ data: group }, { data: memberships }, { data: alreadySentRows }] = await Promise.all([
    supabase
      .schema('public')
      .from('groups')
      .select('id, name, created_by')
      .eq('id', session.group_id)
      .maybeSingle(),
    supabase
      .schema('public')
      .from('group_members')
      .select('user_id, is_founder')
      .eq('group_id', session.group_id),
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
    .select('id, email, display_name, locale, phone_number')
    .in('id', memberIds);

  const usersList = users ?? [];
  const usersById = new Map(usersList.map((user) => [user.id, user]));
  const leaderId =
    session.leader_id ??
    (memberships ?? []).find((membership) => membership.is_founder)?.user_id ??
    group?.created_by ??
    memberIds[0];
  const leader = leaderId ? usersById.get(leaderId) : null;
  const leaderName = leader?.display_name?.trim() || leader?.email || 'ActiveBoard';
  const sentUserIds = new Set((alreadySentRows ?? []).map((row) => row.user_id));
  const sentEmails = new Set<string>();
  let attempted = 0;
  let sent = 0;

  for (const user of usersList) {
    if (!user.email || sentUserIds.has(user.id)) {
      continue;
    }

    const normalizedRecipientEmail = normalizeEmail(user.email);
    if (sentEmails.has(normalizedRecipientEmail)) {
      continue;
    }

    attempted += 1;
    const locale = normalizeLocale(user.locale);
    const sessionLabel = session.name ?? group?.name ?? 'ActiveBoard';
    const links = buildCoordinationLinks({
      emails: usersList.map((member) => member.email).filter(Boolean),
      sessionLabel,
      locale,
    });

    const copy = buildCalendarInviteCopy({
      locale,
      memberName: user.display_name ?? user.email,
      groupName: group?.name ?? 'ActiveBoard',
      sessionName: sessionLabel,
      scheduledAt: session.scheduled_at,
      shareCode: session.share_code,
      meetingLink: session.meeting_link,
      leaderName,
      memberDetails: usersList.map((member) => getMemberLine(member, locale)),
      ...links,
    });

    const ics = buildSessionIcs({
      sessionId: session.id,
      sessionName: sessionLabel,
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

      sentEmails.add(normalizedRecipientEmail);
      sent += 1;

      await logAppEvent({
        eventName: APP_EVENTS.sessionCalendarInviteSent,
        locale,
        userId: user.id,
        groupId: session.group_id,
        sessionId: session.id,
        metadata: { provider: 'mailersend' },
        useAdmin: true,
      });
    } catch (error) {
      await logAppEvent({
        eventName: APP_EVENTS.sessionCalendarInviteFailed,
        level: 'error',
        locale,
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
