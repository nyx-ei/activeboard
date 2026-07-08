import { CalendarClock, Play, Timer } from 'lucide-react';

import { Link } from '@/i18n/navigation';
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
};

const copy = {
  en: {
    continue: 'Continue',
    sessionDetails: 'Session details',
    questions: 'questions',
    answered: 'answered',
    reviewed: 'reviewed',
    timer: 'per question',
  },
  fr: {
    continue: 'Continuer',
    sessionDetails: 'Détails de la séance',
    questions: 'questions',
    answered: 'répondues',
    reviewed: 'révisées',
    timer: 'par question',
  },
} as const;

function getCopy(locale: string) {
  return locale === 'fr' ? copy.fr : copy.en;
}

function getActiveStep(
  status: string,
  reviewedCount: number,
  questionGoal: number,
) {
  if (status === 'completed') {
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
}: SessionProgressEntryRuntimeProps) {
  const language = locale === 'fr' ? 'fr' : 'en';
  const t = getCopy(language);
  const reviewDone = reviewedCount >= questionGoal || status === 'completed';
  const activeStep = getActiveStep(status, reviewedCount, questionGoal);

  return (
    <SessionProgressPanel
      locale={language}
      sessionTitle={sessionTitle}
      activeStep={activeStep}
      backHref="/dashboard"
      sessionHref={sessionHref}
      feedbackHref={reviewDone ? `/sessions/${sessionId}?stage=feedback` : undefined}
      planNextHref={reviewDone ? `/sessions/${sessionId}?stage=plan-next` : undefined}
    >
      <div className="rounded-[18px] border border-white/10 bg-[#111827] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.25)] sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-brand/10 text-brand">
            <Play className="ml-0.5 h-6 w-6 fill-current" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold text-white">
              {t.sessionDetails}
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-400">
              {questionGoal} {t.questions} · {timerSeconds}s {t.timer}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[13px] border border-white/[0.08] bg-white/[0.035] p-4">
            <CalendarClock className="h-4 w-4 text-brand" aria-hidden="true" />
            <p className="mt-2 text-2xl font-extrabold text-white">
              {Math.min(answeredCount, questionGoal)}/{questionGoal}
            </p>
            <p className="text-xs font-semibold text-slate-500">{t.answered}</p>
          </div>
          <div className="rounded-[13px] border border-white/[0.08] bg-white/[0.035] p-4">
            <Timer className="h-4 w-4 text-brand" aria-hidden="true" />
            <p className="mt-2 text-2xl font-extrabold text-white">
              {Math.min(reviewedCount, questionGoal)}/{questionGoal}
            </p>
            <p className="text-xs font-semibold text-slate-500">{t.reviewed}</p>
          </div>
        </div>

        <Link
          href={sessionHref}
          prefetch={false}
          className="button-primary mt-6 flex w-full justify-center rounded-[8px] px-5 py-3 text-sm"
        >
          {t.continue}
        </Link>
      </div>
    </SessionProgressPanel>
  );
}
