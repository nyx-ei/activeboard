import { getAppUrl, hasEmailEnv } from '@/lib/env';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/mailersend';
import { renderPlainTextEmail, renderTransactionalEmail } from '@/lib/email/templates';

const TRIAL_WARNING_THRESHOLD = 85;
const TRIAL_QUESTION_LIMIT = 100;

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
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { data: user } = await supabase
    .schema('public')
    .from('users')
    .select('id, email, display_name, locale, questions_answered')
    .eq('id', userId)
    .maybeSingle();

  if (!user?.email || user.questions_answered < TRIAL_WARNING_THRESHOLD || user.questions_answered >= TRIAL_QUESTION_LIMIT) {
    return;
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
    return;
  }

  const remaining = Math.max(TRIAL_QUESTION_LIMIT - user.questions_answered, 0);
  const copy = buildTrialWarningCopy({
    locale: user.locale,
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
      locale: user.locale,
      userId,
      metadata: {
        questions_answered: user.questions_answered,
        remaining_questions: remaining,
      },
      useAdmin: true,
    });
  } catch (error) {
    await logAppEvent({
      eventName: APP_EVENTS.trialWarningEmailFailed,
      level: 'error',
      locale: user.locale,
      userId,
      metadata: {
        questions_answered: user.questions_answered,
        error_message: error instanceof Error ? error.message : 'Unknown trial warning email error',
      },
      useAdmin: true,
    });
  }
}
