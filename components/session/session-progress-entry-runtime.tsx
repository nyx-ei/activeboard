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
      sessionMeta={`${Math.min(answeredCount, questionGoal)}/${questionGoal}Q - ${timerSeconds} sec`}
    />
  );
}
