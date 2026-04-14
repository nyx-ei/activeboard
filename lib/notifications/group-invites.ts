import type { AppLocale } from '@/i18n/routing';
import { getAppUrl } from '@/lib/env';
import { sendEmail } from '@/lib/email/mailersend';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';

type SendGroupInviteEmailInput = {
  locale: AppLocale;
  groupId: string;
  groupName: string;
  inviteCode: string;
  inviteeEmail: string;
  inviterUserId: string;
  inviterName: string;
};

function buildGroupInviteCopy(input: SendGroupInviteEmailInput) {
  const dashboardUrl = `${getAppUrl()}/${input.locale}/dashboard`;
  const authUrl = `${getAppUrl()}/${input.locale}/auth/login?next=/${input.locale}/dashboard`;

  if (input.locale === 'fr') {
    return {
      subject: `Invitation ActiveBoard : ${input.groupName}`,
      text: [
        'Bonjour,',
        '',
        `${input.inviterName} vous invite à rejoindre le groupe "${input.groupName}" sur ActiveBoard.`,
        `Code d'invitation : ${input.inviteCode}`,
        `Ouvrir ActiveBoard : ${authUrl}`,
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <p>Bonjour,</p>
          <p><strong>${input.inviterName}</strong> vous invite à rejoindre le groupe <strong>${input.groupName}</strong> sur ActiveBoard.</p>
          <p><strong>Code d'invitation :</strong> ${input.inviteCode}</p>
          <p><a href="${authUrl}">Ouvrir ActiveBoard</a></p>
        </div>
      `,
    };
  }

  return {
    subject: `ActiveBoard invite: ${input.groupName}`,
    text: [
      'Hi,',
      '',
      `${input.inviterName} invited you to join "${input.groupName}" on ActiveBoard.`,
      `Invitation code: ${input.inviteCode}`,
      `Open ActiveBoard: ${dashboardUrl}`,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <p>Hi,</p>
        <p><strong>${input.inviterName}</strong> invited you to join <strong>${input.groupName}</strong> on ActiveBoard.</p>
        <p><strong>Invitation code:</strong> ${input.inviteCode}</p>
        <p><a href="${dashboardUrl}">Open ActiveBoard</a></p>
      </div>
    `,
  };
}

export async function sendGroupInviteEmail(input: SendGroupInviteEmailInput) {
  const copy = buildGroupInviteCopy(input);

  try {
    const response = await sendEmail({
      to: input.inviteeEmail,
      subject: copy.subject,
      html: copy.html,
      text: copy.text,
    });

    await logAppEvent({
      eventName: APP_EVENTS.groupInviteEmailSent,
      locale: input.locale,
      userId: input.inviterUserId,
      groupId: input.groupId,
      metadata: {
        invitee_email: input.inviteeEmail,
        provider: 'mailersend',
        provider_message_id: response.id,
      },
      useAdmin: true,
    });
  } catch (error) {
    await logAppEvent({
      eventName: APP_EVENTS.groupInviteEmailFailed,
      level: 'error',
      locale: input.locale,
      userId: input.inviterUserId,
      groupId: input.groupId,
      metadata: {
        invitee_email: input.inviteeEmail,
        error_message: error instanceof Error ? error.message : 'Unknown group invite email error',
      },
      useAdmin: true,
    });
  }
}
