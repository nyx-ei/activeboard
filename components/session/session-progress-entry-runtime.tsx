import { SessionProgressPanel } from '@/components/session/session-progress-panel';

type SessionProgressEntryRuntimeProps = {
  locale: string;
  sessionId: string;
  sessionTitle: string;
  status: string;
  sessionHref: string;
  questionGoal: number;
  timerSeconds: number;
  answeredCount: number;
  reviewedCount: number;
  scheduledAt?: string;
  meetingLink?: string | null;
  feedbackSubmitted?: boolean;
};

function getActiveStep({
  status,
  reviewedCount,
  questionGoal,
  feedbackSubmitted,
}: {
  status: string;
  reviewedCount: number;
  questionGoal: number;
  feedbackSubmitted: boolean;
}) {
  if (status === 'completed' || feedbackSubmitted) {
    return 'plan-next' as const;
  }

  if (reviewedCount >= questionGoal) {
    return 'feedback' as const;
  }

  return 'session' as const;
}

export function SessionProgressEntryRuntime({
  locale,
  sessionId,
  sessionTitle,
  status,
  sessionHref,
  questionGoal,
  timerSeconds,
  answeredCount,
  reviewedCount,
  scheduledAt,
  meetingLink,
  feedbackSubmitted = false,
}: SessionProgressEntryRuntimeProps) {
  const language = locale === 'fr' ? 'fr' : 'en';
  const reviewDone = reviewedCount >= questionGoal || status === 'completed';
  const canOpenPlanNext = feedbackSubmitted;
  const activeStep = getActiveStep({
    status,
    reviewedCount,
    questionGoal,
    feedbackSubmitted,
  });

  const countdownLabel =
    status === 'scheduled' && meetingLink && scheduledAt
      ? getTodayCountdownLabel(language, scheduledAt)
      : null;
  const sessionStatusLabel =
    status === 'scheduled'
      ? language === 'fr'
        ? 'Planifiée'
        : 'Planned'
      : undefined;

  return (
    <SessionProgressPanel
      locale={language}
      sessionTitle={sessionTitle}
      activeStep={activeStep}
      backHref="/dashboard"
      sessionHref={sessionHref}
      feedbackHref={
        reviewDone ? `/sessions/${sessionId}?stage=feedback` : undefined
      }
      planNextHref={
        canOpenPlanNext ? `/sessions/${sessionId}?stage=plan-next` : undefined
      }
      sessionMeta={`${Math.min(answeredCount, questionGoal)}/${questionGoal}Q - ${timerSeconds} sec${
        countdownLabel ? ` · ${countdownLabel}` : ''
      }`}
      sessionStatusLabel={sessionStatusLabel}
    />
  );
}

function getTodayCountdownLabel(locale: 'en' | 'fr', scheduledAt: string) {
  const date = new Date(scheduledAt);
  const now = new Date();

  if (
    !Number.isFinite(date.getTime()) ||
    date.getFullYear() !== now.getFullYear() ||
    date.getMonth() !== now.getMonth() ||
    date.getDate() !== now.getDate()
  ) {
    return null;
  }

  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) {
    return locale === 'fr' ? 'maintenant' : 'now';
  }

  const hours = Math.max(1, Math.ceil(diffMs / (60 * 60 * 1000)));
  return locale === 'fr' ? `dans ${hours}h` : `in ${hours}h`;
}
