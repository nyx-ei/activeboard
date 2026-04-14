import { getEmailServerEnv } from '@/lib/env';

type SendEmailInput = {
  attachments?: Array<{
    filename: string;
    content: string;
    contentType?: string;
  }>;
  to: string;
  subject: string;
  html: string;
  text: string;
};

type MailerSendResponse = {
  id: string;
};

export async function sendEmail({ to, subject, html, text, attachments }: SendEmailInput): Promise<MailerSendResponse> {
  const { mailerSendApiKey, mailerSendFromEmail, mailerSendFromName } = getEmailServerEnv();

  const response = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mailerSendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: {
        email: mailerSendFromEmail,
        name: mailerSendFromName,
      },
      to: [{ email: to }],
      subject,
      html,
      text,
      attachments: attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        disposition: 'attachment',
      })),
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`MailerSend email failed (${response.status}): ${responseText}`);
  }

  return {
    id: response.headers.get('x-message-id') ?? crypto.randomUUID(),
  };
}
