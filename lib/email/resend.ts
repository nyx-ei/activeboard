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

export async function sendEmailWithResend({ to, subject, html, text, attachments }: SendEmailInput) {
  const { resendApiKey, resendFromEmail } = getEmailServerEnv();

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: [to],
      subject,
      html,
      text,
      attachments,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Resend email failed (${response.status}): ${responseText}`);
  }

  return response.json() as Promise<{ id: string }>;
}
