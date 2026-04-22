import type { AppLocale } from '@/i18n/routing';
import { sendEmail } from '@/lib/email/mailersend';
import { renderPlainTextEmail, renderTransactionalEmail } from '@/lib/email/templates';
import { getAppUrl } from '@/lib/env';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';

type AccountEmailInput = {
  locale: AppLocale;
  email: string;
  userId?: string | null;
  displayName?: string | null;
};

function greetingName(input: AccountEmailInput) {
  return input.displayName?.trim() || input.email.split('@')[0] || 'ActiveBoard member';
}

export async function sendAccountWelcomeEmail(input: AccountEmailInput) {
  const dashboardUrl = `${getAppUrl()}/${input.locale}/dashboard`;
  const name = greetingName(input);
  const isFrench = input.locale === 'fr';
  const emailContent = isFrench
    ? {
        title: 'Votre compte ActiveBoard est pret',
        preheader: 'Bienvenue sur ActiveBoard. Vous pouvez maintenant creer ou rejoindre un groupe.',
        intro: [
          `Bonjour ${name},`,
          "Votre compte ActiveBoard vient d'etre cree avec succes.",
          "ActiveBoard vous aide a structurer les sessions de groupe, suivre les reponses et garder un historique clair de votre constance.",
        ],
        details: [
          { label: 'Compte', value: input.email },
          { label: 'Prochaine etape', value: 'Creer ou rejoindre un groupe' },
        ],
        action: { label: 'Ouvrir ActiveBoard', url: dashboardUrl },
        secondaryNote:
          "Si vous venez d'utiliser le parcours de creation de groupe, connectez-vous pour finaliser la synchronisation de votre groupe et de vos invitations.",
      }
    : {
        title: 'Your ActiveBoard account is ready',
        preheader: 'Welcome to ActiveBoard. You can now create or join a group.',
        intro: [
          `Hi ${name},`,
          'Your ActiveBoard account was created successfully.',
          'ActiveBoard helps you structure group sessions, track answers, and keep a clear record of consistency.',
        ],
        details: [
          { label: 'Account', value: input.email },
          { label: 'Next step', value: 'Create or join a group' },
        ],
        action: { label: 'Open ActiveBoard', url: dashboardUrl },
        secondaryNote:
          'If you just used the create-group flow, sign in to finish syncing your group and invitations.',
      };

  try {
    const response = await sendEmail({
      to: input.email,
      subject: isFrench ? 'Bienvenue sur ActiveBoard' : 'Welcome to ActiveBoard',
      text: renderPlainTextEmail(emailContent),
      html: renderTransactionalEmail(emailContent),
    });

    await logAppEvent({
      eventName: APP_EVENTS.accountWelcomeEmailSent,
      locale: input.locale,
      userId: input.userId ?? undefined,
      metadata: {
        email: input.email,
        provider: 'mailersend',
        provider_message_id: response.id,
      },
      useAdmin: true,
    });
  } catch (error) {
    await logAppEvent({
      eventName: APP_EVENTS.accountWelcomeEmailFailed,
      level: 'error',
      locale: input.locale,
      userId: input.userId ?? undefined,
      metadata: {
        email: input.email,
        error_message: error instanceof Error ? error.message : 'Unknown welcome email error',
      },
      useAdmin: true,
    });
  }
}

export async function sendPasswordChangedEmail(input: AccountEmailInput) {
  const isFrench = input.locale === 'fr';
  const emailContent = isFrench
    ? {
        title: 'Votre mot de passe a ete modifie',
        preheader: 'Notification de securite ActiveBoard concernant votre mot de passe.',
        intro: [
          'Bonjour,',
          "Le mot de passe de votre compte ActiveBoard vient d'etre modifie.",
          "Cette notification est envoyee pour vous permettre de reagir rapidement si vous n'etes pas a l'origine de cette action.",
        ],
        details: [
          { label: 'Compte', value: input.email },
          { label: 'Action', value: 'Modification du mot de passe' },
          { label: 'Heure', value: new Intl.DateTimeFormat('fr', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()) },
        ],
        action: { label: 'Ouvrir ActiveBoard', url: `${getAppUrl()}/fr/profile` },
        safetyNote:
          "Si vous n'avez pas demande cette modification, changez immediatement votre mot de passe et contactez le support ActiveBoard.",
      }
    : {
        title: 'Your password was changed',
        preheader: 'ActiveBoard security notification about your password.',
        intro: [
          'Hi,',
          'The password for your ActiveBoard account was just changed.',
          'This notification helps you react quickly if you did not perform this action.',
        ],
        details: [
          { label: 'Account', value: input.email },
          { label: 'Action', value: 'Password change' },
          { label: 'Time', value: new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()) },
        ],
        action: { label: 'Open ActiveBoard', url: `${getAppUrl()}/en/profile` },
        safetyNote:
          'If you did not request this change, update your password immediately and contact ActiveBoard support.',
      };

  try {
    const response = await sendEmail({
      to: input.email,
      subject: isFrench ? 'Votre mot de passe ActiveBoard a ete modifie' : 'Your ActiveBoard password was changed',
      text: renderPlainTextEmail(emailContent),
      html: renderTransactionalEmail(emailContent),
    });

    await logAppEvent({
      eventName: APP_EVENTS.passwordChangedEmailSent,
      locale: input.locale,
      userId: input.userId ?? undefined,
      metadata: {
        email: input.email,
        provider: 'mailersend',
        provider_message_id: response.id,
      },
      useAdmin: true,
    });
  } catch (error) {
    await logAppEvent({
      eventName: APP_EVENTS.passwordChangedEmailFailed,
      level: 'error',
      locale: input.locale,
      userId: input.userId ?? undefined,
      metadata: {
        email: input.email,
        error_message: error instanceof Error ? error.message : 'Unknown password changed email error',
      },
      useAdmin: true,
    });
  }
}
