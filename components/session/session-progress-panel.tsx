import { ArrowLeft, Check } from 'lucide-react';
import type React from 'react';

import { Link } from '@/i18n/navigation';

type SessionProgressStep = 'session' | 'feedback' | 'plan-next';
type SessionProgressStepState = 'done' | 'active' | 'pending';

type SessionProgressPanelProps = {
  locale: string;
  sessionTitle: string;
  activeStep: SessionProgressStep;
  backHref: string;
  backLabel?: string;
  sessionHref?: string;
  feedbackHref?: string;
  planNextHref?: string;
  children: React.ReactNode;
};

const copy = {
  en: {
    back: 'Back',
    progress: 'Session progress',
    sessionActive: 'Sprint',
    sessionDone: 'Sprint reviewed',
    feedback: 'Peer feedback',
    planNext: 'Plan next session',
  },
  fr: {
    back: 'Retour',
    progress: 'Progression de la séance',
    sessionActive: 'Sprint',
    sessionDone: 'Sprint révisé',
    feedback: 'Feedback',
    planNext: 'Planifier la suite',
  },
} as const;

function getCopy(locale: string) {
  return locale === 'fr' ? copy.fr : copy.en;
}

function getStepState(
  step: SessionProgressStep,
  activeStep: SessionProgressStep,
): SessionProgressStepState {
  const order: SessionProgressStep[] = ['session', 'feedback', 'plan-next'];
  const stepIndex = order.indexOf(step);
  const activeIndex = order.indexOf(activeStep);

  if (stepIndex < activeIndex) {
    return 'done';
  }

  if (stepIndex === activeIndex) {
    return 'active';
  }

  return 'pending';
}

function ProgressStep({
  label,
  state,
  href,
}: {
  label: string;
  state: SessionProgressStepState;
  href?: string;
}) {
  const content = (
    <div
      className={`flex min-h-[52px] items-center gap-3 rounded-[12px] border px-3 py-3 text-sm font-extrabold transition ${
        state === 'active'
          ? 'border-brand bg-brand/10 text-brand'
          : state === 'done'
            ? 'border-brand/35 bg-white/[0.03] text-white'
            : 'border-white/10 bg-white/[0.025] text-slate-500'
      } ${href ? 'hover:border-brand/55 hover:bg-brand/10' : ''}`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
          state === 'done'
            ? 'border-brand bg-brand text-[#04120e]'
            : state === 'active'
              ? 'border-brand text-brand'
              : 'border-white/15 text-transparent'
        }`}
      >
        {state === 'done' ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} prefetch={false} className="block">
      {content}
    </Link>
  );
}

export function SessionProgressPanel({
  locale,
  sessionTitle,
  activeStep,
  backHref,
  backLabel,
  sessionHref,
  feedbackHref,
  planNextHref,
  children,
}: SessionProgressPanelProps) {
  const t = getCopy(locale);
  const sessionState = getStepState('session', activeStep);

  return (
    <main className="min-h-screen bg-[#001915] px-4 py-6 text-white sm:px-6">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div className="flex items-center gap-4">
          <Link
            href={backHref}
            prefetch={false}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-brand/50 hover:text-white"
            aria-label={backLabel ?? t.back}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
              {t.progress}
            </p>
            <h1 className="text-2xl font-extrabold text-white">
              {sessionTitle}
            </h1>
          </div>
        </div>

        <div className="rounded-[18px] border border-brand/35 bg-[#082c24]/70 p-4 shadow-[inset_0_0_35px_rgba(32,217,163,0.06)]">
          <div className="grid gap-3 sm:grid-cols-3">
            <ProgressStep
              href={sessionHref}
              state={sessionState}
              label={sessionState === 'done' ? t.sessionDone : t.sessionActive}
            />
            <ProgressStep
              href={feedbackHref}
              state={getStepState('feedback', activeStep)}
              label={t.feedback}
            />
            <ProgressStep
              href={planNextHref}
              state={getStepState('plan-next', activeStep)}
              label={t.planNext}
            />
          </div>
        </div>

        {children}
      </section>
    </main>
  );
}
