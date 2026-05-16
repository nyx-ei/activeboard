import { getAppUrl, hasEmailEnv } from '@/lib/env';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/mailersend';
import { renderPlainTextEmail, renderTransactionalEmail } from '@/lib/email/templates';

const TRIAL_WARNING_THRESHOLD = 85;
const TRIAL_QUESTION_LIMIT = 100;

function normalizeLocale(locale: string | null | undefined): 'en' | 'fr' {
  return locale === 'fr' ? 'fr' : 'en';
}

function buildTrialWarningCopy(args: { locale: 'en' | 'fr'; memberName: string; remaining: number }) {
  if (args.locale === 'fr') {
    return {
      subject: 'ActiveBoard : plus que 15 questions avant facturation',
      text: renderPlainTextEmail({
        title: 'Ton essai ActiveBoard arrive à sa limite',
        preheader: 'Il ne reste presque plus de questions gratuites.',
        intro: [
          `Bonjour ${args.memberName},`,
          `Tu as atteint ${TRIAL_WARNING_THRESHOLD} questions répondues sur ${TRIAL_QUESTION_LIMIT}.`,
          `Il te reste ${args.remaining} questions gratuites avant que la facturation devienne obligatoire pour continuer les sessions.`,
        ],
        action: { label: 'Voir la facturation', url: `${getAppUrl()}/fr/billing` },
        secondaryNote: 'Active ton moyen de paiement maintenant pour éviter une interruption pendant les prochaines sessions.',
      }),
      html: renderTransactionalEmail({
        title: 'Ton essai ActiveBoard arrive à sa limite',
        preheader: 'Il ne reste presque plus de questions gratuites.',
        intro: [
          `Bonjour ${args.memberName},`,
          `Tu as atteint ${TRIAL_WARNING_THRESHOLD} questions répondues sur ${TRIAL_QUESTION_LIMIT}.`,
          `Il te reste ${args.remaining} questions gratuites avant que la facturation devienne obligatoire pour continuer les sessions.`,
        ],
        action: { label: 'Voir la facturation', url: `${getAppUrl()}/fr/billing` },
        secondaryNote: 'Active ton moyen de paiement maintenant pour éviter une interruption pendant les prochaines sessions.',
      }),
    };
  }

  return {
    subject: 'ActiveBoard: 15 questions left before billing',
    text: renderPlainTextEmail({
      title: 'Your ActiveBoard trial is close to its limit',
      preheader: 'You are almost out of free questions.',
      intro: [
        `Hi ${args.memberName},`,
        `You have reached ${TRIAL_WARNING_THRESHOLD} answered questions out of ${TRIAL_QUESTION_LIMIT}.`,
        `You have ${args.remaining} free questions left before billing is required to keep joining or starting sessions.`,
      ],
      action: { label: 'View billing', url: `${getAppUrl()}/en/billing` },
      secondaryNote: 'Add your payment method now to avoid an interruption during your next study sessions.',
    }),
    html: renderTransactionalEmail({
      title: 'Your ActiveBoard trial is close to its limit',
      preheader: 'You are almost out of free questions.',
      intro: [
        `Hi ${args.memberName},`,
        `You have reached ${TRIAL_WARNING_THRESHOLD} answered questions out of ${TRIAL_QUESTION_LIMIT}.`,
        `You have ${args.remaining} free questions left before billing is required to keep joining or starting sessions.`,
      ],
      action: { label: 'View billing', url: `${getAppUrl()}/en/billing` },
      secondaryNote: 'Add your payment method now to avoid an interruption during your next study sessions.',
    }),
  };
}

export async function sendTrialWarningEmailIfNeeded(userId: string) {
  if (!hasEmailEnv()) {
    return { sent: false as const, skipped: true as const, reason: 'email_not_configured' };
  }

  const supabase = createSupabaseAdminClient();
  const { data: user } = await supabase
    .schema('public')
    .from('users')
    .select('id, email, display_name, locale, questions_answered')
    .eq('id', userId)
    .maybeSingle();

  if (!user?.email) {
    return { sent: false as const, skipped: true as const, reason: 'missing_email' };
  }

  if (user.questions_answered < TRIAL_WARNING_THRESHOLD || user.questions_answered >= TRIAL_QUESTION_LIMIT) {
    return { sent: false as const, skipped: true as const, reason: 'outside_threshold' };
  }

  const { data: existingLog } = await supabase
    .schema('public')
    .from('app_logs')
    .select('id')
    .eq('event_name', APP_EVENTS.trialWarningEmailSent)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (existingLog) {
    return { sent: false as const, skipped: true as const, reason: 'already_sent' };
  }

  const remaining = Math.max(TRIAL_QUESTION_LIMIT - user.questions_answered, 0);
  const locale = normalizeLocale(user.locale);
  const copy = buildTrialWarningCopy({
    locale,
    memberName: user.display_name ?? user.email,
    remaining,
  });

  try {
    await sendEmail({
      to: user.email,
      subject: copy.subject,
      html: copy.html,
      text: copy.text,
    });

    await logAppEvent({
      eventName: APP_EVENTS.trialWarningEmailSent,
      locale,
      userId,
      metadata: {
        questions_answered: user.questions_answered,
        remaining_questions: remaining,
      },
      useAdmin: true,
    });

    return { sent: true as const, skipped: false as const };
  } catch (error) {
    await logAppEvent({
      eventName: APP_EVENTS.trialWarningEmailFailed,
      level: 'error',
      locale,
      userId,
      metadata: {
        questions_answered: user.questions_answered,
        error_message: error instanceof Error ? error.message : 'Unknown trial warning email error',
      },
      useAdmin: true,
    });

    return { sent: false as const, skipped: false as const, reason: 'send_failed' };
  }
}

export async function dispatchDueTrialWarningEmails(limit = 100) {
  if (!hasEmailEnv()) {
    return {
      scannedUsers: 0,
      attemptedWarnings: 0,
      sentWarnings: 0,
      skipped: true,
      reason: 'email_not_configured',
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data: users, error } = await supabase
    .schema('public')
    .from('users')
    .select('id')
    .gte('questions_answered', TRIAL_WARNING_THRESHOLD)
    .lt('questions_answered', TRIAL_QUESTION_LIMIT)
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load trial warning candidates: ${error.message}`);
  }

  let attemptedWarnings = 0;
  let sentWarnings = 0;

  for (const user of users ?? []) {
    attemptedWarnings += 1;
    const result = await sendTrialWarningEmailIfNeeded(user.id);
    if (result.sent) {
      sentWarnings += 1;
    }
  }

  return {
    scannedUsers: users?.length ?? 0,
    attemptedWarnings,
    sentWarnings,
  };
}
