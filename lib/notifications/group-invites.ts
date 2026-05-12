import type { AppLocale } from '@/i18n/routing';
import { getAppUrl } from '@/lib/env';
import { sendEmail } from '@/lib/email/mailersend';
import {
  renderPlainTextEmail,
  renderTransactionalEmail,
} from '@/lib/email/templates';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';

type SendGroupInviteEmailInput = {
  locale: AppLocale;
  inviteId: string;
  groupId: string;
  groupName: string;
  inviteCode: string;
  inviteeEmail: string;
  inviterUserId: string;
  inviterName: string;
  variant?: 'group_invite' | 'mid_session_check_in';
  sessionId?: string;
  sessionName?: string | null;
  sessionShareCode?: string | null;
};

type SendGroupMemberAddedEmailInput = {
  locale: AppLocale;
  groupId: string;
  groupName: string;
  memberEmail: string;
  memberName?: string | null;
  inviterUserId: string;
  inviterName: string;
};

function buildGroupInviteCopy(input: SendGroupInviteEmailInput) {
  const authUrl = `${getAppUrl()}/${input.locale}/auth/login?next=/${input.locale}/invite/${input.inviteId}`;
  const isMidSessionInvite = input.variant === 'mid_session_check_in';

  if (input.locale === 'fr') {
    if (isMidSessionInvite) {
      return {
        subject: `Check-in ActiveBoard : ${input.groupName}`,
        content: {
          title: 'Invitation à rejoindre le check-in de session',
          preheader: `${input.inviterName} vous invite à rejoindre une session ActiveBoard en cours.`,
          intro: [
            'Bonjour,',
            `${input.inviterName} vous invite à rejoindre le groupe "${input.groupName}" pendant une session ActiveBoard en cours.`,
            'Acceptez l’invitation avec cette adresse email. Vous pourrez entrer dans le groupe et rejoindre le flux de session selon les règles d’admission en cours.',
          ],
          details: [
            { label: 'Groupe', value: input.groupName },
            { label: 'Invité par', value: input.inviterName },
            ...(input.sessionName
              ? [{ label: 'Session', value: input.sessionName }]
              : []),
            ...(input.sessionShareCode
              ? [{ label: 'Code de session', value: input.sessionShareCode }]
              : []),
            {
              label: "Code d'invitation",
              value: input.inviteCode || 'Disponible dans ActiveBoard',
            },
          ],
          action: { label: "Accepter l'invitation", url: authUrl },
          secondaryNote:
            'Si vous avez déjà un compte ActiveBoard, connectez-vous avec cette adresse email. Sinon, créez un compte puis poursuivez depuis la page d’invitation.',
          safetyNote:
            'Cette invitation ne modifie pas les réponses déjà soumises par les participants.',
        },
      };
    }

    return {
      subject: `Invitation ActiveBoard : ${input.groupName}`,
      content: {
        title: 'Vous avez reçu une invitation de groupe',
        preheader: `${input.inviterName} vous invite à rejoindre ${input.groupName} sur ActiveBoard.`,
        intro: [
          'Bonjour,',
          `${input.inviterName} vous invite à rejoindre le groupe "${input.groupName}" sur ActiveBoard.`,
          'Une fois connecté, vous pourrez accéder aux sessions du groupe, répondre aux questions et participer à la révision structurée.',
        ],
        details: [
          { label: 'Groupe', value: input.groupName },
          { label: 'Invité par', value: input.inviterName },
          {
            label: "Code d'invitation",
            value: input.inviteCode || 'Disponible dans ActiveBoard',
          },
        ],
        action: { label: "Accepter l'invitation", url: authUrl },
        secondaryNote:
          'Si vous avez déjà un compte ActiveBoard, connectez-vous avec cette adresse email. Sinon, créez un compte puis poursuivez depuis la page d’invitation.',
      },
    };
  }

  if (isMidSessionInvite) {
    return {
      subject: `ActiveBoard check-in: ${input.groupName}`,
      content: {
        title: 'Join this session check-in',
        preheader: `${input.inviterName} invited you to join an active ActiveBoard session.`,
        intro: [
          'Hi,',
          `${input.inviterName} invited you to join "${input.groupName}" during an active ActiveBoard session.`,
          'Accept the invitation with this email address. You can enter the group and join the session flow according to the current admission rules.',
        ],
        details: [
          { label: 'Group', value: input.groupName },
          { label: 'Invited by', value: input.inviterName },
          ...(input.sessionName
            ? [{ label: 'Session', value: input.sessionName }]
            : []),
          ...(input.sessionShareCode
            ? [{ label: 'Session code', value: input.sessionShareCode }]
            : []),
          {
            label: 'Invitation code',
            value: input.inviteCode || 'Available in ActiveBoard',
          },
        ],
        action: { label: 'Accept invitation', url: authUrl },
        secondaryNote:
          'If you already have an ActiveBoard account, sign in with this email address. Otherwise, create an account and continue from the invitation page.',
        safetyNote:
          'This invitation does not change answers that participants have already submitted.',
      },
    };
  }

  return {
    subject: `ActiveBoard invite: ${input.groupName}`,
    content: {
      title: 'You received a group invitation',
      preheader: `${input.inviterName} invited you to join ${input.groupName} on ActiveBoard.`,
      intro: [
        'Hi,',
        `${input.inviterName} invited you to join "${input.groupName}" on ActiveBoard.`,
        'After signing in, you can access the group sessions, answer questions, and take part in the structured review.',
      ],
      details: [
        { label: 'Group', value: input.groupName },
        { label: 'Invited by', value: input.inviterName },
        {
          label: 'Invitation code',
          value: input.inviteCode || 'Available in ActiveBoard',
        },
      ],
      action: { label: 'Accept invitation', url: authUrl },
      secondaryNote:
        'If you already have an ActiveBoard account, sign in with this email address. Otherwise, create an account and continue from the invitation page.',
    },
  };
}

export async function sendGroupInviteEmail(input: SendGroupInviteEmailInput) {
  const copy = buildGroupInviteCopy(input);

  try {
    const response = await sendEmail({
      to: input.inviteeEmail,
      subject: copy.subject,
      html: renderTransactionalEmail(copy.content),
      text: renderPlainTextEmail(copy.content),
    });

    await logAppEvent({
      eventName: APP_EVENTS.groupInviteEmailSent,
      locale: input.locale,
      userId: input.inviterUserId,
      groupId: input.groupId,
      metadata: {
        invite_id: input.inviteId,
        invitee_email: input.inviteeEmail,
        template_variant: input.variant ?? 'group_invite',
        session_id: input.sessionId,
        session_share_code: input.sessionShareCode,
        source:
          input.variant === 'mid_session_check_in'
            ? 'session_on_the_fly_invite'
            : 'group_invite',
        funnel_stage:
          input.variant === 'mid_session_check_in' ? 'email_sent' : undefined,
        provider: 'mailersend',
        provider_message_id: response.id,
      },
      useAdmin: true,
    });

    return { ok: true as const };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unknown group invite email error';

    await logAppEvent({
      eventName: APP_EVENTS.groupInviteEmailFailed,
      level: 'error',
      locale: input.locale,
      userId: input.inviterUserId,
      groupId: input.groupId,
      metadata: {
        invite_id: input.inviteId,
        invitee_email: input.inviteeEmail,
        template_variant: input.variant ?? 'group_invite',
        session_id: input.sessionId,
        session_share_code: input.sessionShareCode,
        source:
          input.variant === 'mid_session_check_in'
            ? 'session_on_the_fly_invite'
            : 'group_invite',
        funnel_stage:
          input.variant === 'mid_session_check_in' ? 'email_failed' : undefined,
        error_message: errorMessage,
      },
      useAdmin: true,
    });

    return { ok: false as const, errorMessage };
  }
}

export async function sendGroupMemberAddedEmail(
  input: SendGroupMemberAddedEmailInput,
) {
  const dashboardUrl = `${getAppUrl()}/${input.locale}/groups/${input.groupId}`;
  const memberName =
    input.memberName?.trim() ||
    input.memberEmail.split('@')[0] ||
    'ActiveBoard member';
  const isFrench = input.locale === 'fr';
  const content = isFrench
    ? {
        title: 'Vous avez été ajouté à un groupe',
        preheader: `${input.inviterName} vous a ajouté au groupe ${input.groupName}.`,
        intro: [
          `Bonjour ${memberName},`,
          `${input.inviterName} vous a ajouté directement au groupe "${input.groupName}" sur ActiveBoard.`,
          'Vous pouvez maintenant consulter les sessions, rejoindre le groupe actif et participer aux prochaines questions.',
        ],
        details: [
          { label: 'Groupe', value: input.groupName },
          { label: 'Ajouté par', value: input.inviterName },
          { label: 'Compte ajouté', value: input.memberEmail },
        ],
        action: { label: 'Ouvrir le groupe', url: dashboardUrl },
        safetyNote:
          'Si vous ne reconnaissez pas ce groupe, ignorez cet email ou contactez le support ActiveBoard.',
      }
    : {
        title: 'You were added to a group',
        preheader: `${input.inviterName} added you to ${input.groupName}.`,
        intro: [
          `Hi ${memberName},`,
          `${input.inviterName} added you directly to "${input.groupName}" on ActiveBoard.`,
          'You can now view sessions, join the active group, and participate in upcoming questions.',
        ],
        details: [
          { label: 'Group', value: input.groupName },
          { label: 'Added by', value: input.inviterName },
          { label: 'Added account', value: input.memberEmail },
        ],
        action: { label: 'Open group', url: dashboardUrl },
        safetyNote:
          'If you do not recognize this group, ignore this email or contact ActiveBoard support.',
      };

  try {
    const response = await sendEmail({
      to: input.memberEmail,
      subject: isFrench
        ? `Vous avez été ajouté à ${input.groupName}`
        : `You were added to ${input.groupName}`,
      html: renderTransactionalEmail(content),
      text: renderPlainTextEmail(content),
    });

    await logAppEvent({
      eventName: APP_EVENTS.groupMemberAddedEmailSent,
      locale: input.locale,
      userId: input.inviterUserId,
      groupId: input.groupId,
      metadata: {
        member_email: input.memberEmail,
        provider: 'mailersend',
        provider_message_id: response.id,
      },
      useAdmin: true,
    });
  } catch (error) {
    await logAppEvent({
      eventName: APP_EVENTS.groupMemberAddedEmailFailed,
      level: 'error',
      locale: input.locale,
      userId: input.inviterUserId,
      groupId: input.groupId,
      metadata: {
        member_email: input.memberEmail,
        error_message:
          error instanceof Error
            ? error.message
            : 'Unknown group member added email error',
      },
      useAdmin: true,
    });
  }
}
