import { ArrowLeft, Check, UserRound } from 'lucide-react';
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
  sessionMeta?: string;
  feedbackMeta?: React.ReactNode;
  planNextMeta?: string;
  children?: React.ReactNode;
};

const copy = {
  en: {
    back: 'Back',
    progress: 'Session progress',
    sessionActive: 'Sprint',
    sessionDone: 'Sprint reviewed',
    sessionMeta: '30/30Q - 90 sec',
    feedback: 'Peer feedback',
    feedbackMeta: '1 question, 1 min',
    planNext: 'Plan next session',
    planNextMeta: 'XX - XXhXX',
    statusStarted: 'Started',
    statusReview: 'Review',
    statusPlan: 'Next',
    statusDone: 'Done',
  },
  fr: {
    back: 'Retour',
    progress: 'Progression de la seance',
    sessionActive: 'Sprint',
    sessionDone: 'Sprint revise',
    sessionMeta: '30/30Q - 90 sec',
    feedback: 'Feedback',
    feedbackMeta: '1 question, 1 min',
    planNext: 'Planifier la suite',
    planNextMeta: 'XX - XXhXX',
    statusStarted: 'Demarree',
    statusReview: 'Review',
    statusPlan: 'Suite',
    statusDone: 'Terminee',
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
  meta,
  state,
  href,
  statusLabel,
  isLast = false,
}: {
  label: string;
  meta: React.ReactNode;
  state: SessionProgressStepState;
  href?: string;
  statusLabel: string | null;
  isLast?: boolean;
}) {
  const content = (
    <div className={`relative grid grid-cols-[22px_minmax(0,1fr)] gap-3 ${isLast ? '' : 'pb-3'}`}>
      {!isLast ? (
        <span
          className={`absolute left-[10px] top-7 h-[calc(100%-20px)] border-l border-dashed ${
            state === 'pending' ? 'border-white/15' : 'border-brand/45'
          }`}
          aria-hidden="true"
        />
      ) : null}

      <span
        className={`relative z-10 mt-4 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${
          state === 'done'
            ? 'border-brand bg-brand text-[#04120e]'
            : state === 'active'
              ? 'border-brand bg-[#052820] text-brand shadow-[0_0_0_5px_rgba(32,217,163,0.08)]'
              : 'border-white/25 bg-[#071a18] text-transparent'
        }`}
      >
        {state === 'done' ? (
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        ) : null}
      </span>

      <div
        className={`min-h-[58px] rounded-[4px] border border-dashed px-3 py-2.5 transition ${
          state === 'active'
            ? 'border-brand/70 bg-brand/[0.065]'
            : state === 'done'
              ? 'border-brand/35 bg-white/[0.025]'
              : 'border-[#9db5cf]/30 bg-white/[0.015]'
        } ${href ? 'hover:border-brand/80 hover:bg-brand/10' : ''}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className={`truncate text-sm font-extrabold ${
                state === 'pending' ? 'text-[#95a9bd]' : 'text-white'
              }`}
            >
              {label}
            </p>
            <div className="mt-1 min-h-[18px] text-[11px] font-semibold text-[#8fa7a2]">
              {meta}
            </div>
          </div>
          {statusLabel ? (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black ${
                state === 'active'
                  ? 'bg-brand text-[#04120e]'
                  : 'bg-brand/85 text-[#04120e]'
              }`}
            >
              {statusLabel}
            </span>
          ) : null}
        </div>
      </div>
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

function FeedbackAvatarPreview() {
  return (
    <div
      className="flex -space-x-1.5"
      aria-label="Peer feedback participants"
    >
      {[0, 1, 2, 3].map((index) => (
        <span
          key={index}
          className={`grid h-5 w-5 place-items-center rounded-full border border-[#071f1c] bg-[#123b34] text-[#9ff0ce] ${
            index === 1 ? 'bg-brand text-[#04120e]' : ''
          }`}
        >
          <UserRound className="h-3 w-3" aria-hidden="true" />
        </span>
      ))}
    </div>
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
  sessionMeta,
  feedbackMeta,
  planNextMeta,
  children,
}: SessionProgressPanelProps) {
  const t = getCopy(locale);
  const sessionState = getStepState('session', activeStep);
  const feedbackState = getStepState('feedback', activeStep);
  const planNextState = getStepState('plan-next', activeStep);

  function getStatusLabel(
    step: SessionProgressStep,
    state: SessionProgressStepState,
  ) {
    if (state === 'done') {
      return t.statusDone;
    }

    if (state !== 'active') {
      return null;
    }

    if (step === 'session') {
      return t.statusStarted;
    }

    return step === 'feedback' ? t.statusReview : t.statusPlan;
  }

  return (
    <main className="min-h-screen bg-[#001915] px-4 py-6 text-white sm:px-6">
      <section className="mx-auto flex w-full max-w-[430px] flex-col gap-5">
        <div className="flex items-center gap-4">
          <Link
            href={backHref}
            prefetch={false}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-brand/50 hover:text-white"
            aria-label={backLabel ?? t.back}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
              {t.progress}
            </p>
            <h1 className="truncate text-2xl font-extrabold text-white">
              {sessionTitle}
            </h1>
          </div>
        </div>

        <div className="rounded-[12px] border border-white/10 bg-[#071f1c]/70 p-4 shadow-[inset_0_0_35px_rgba(32,217,163,0.045)]">
          <ProgressStep
            href={sessionHref}
            state={sessionState}
            label={sessionState === 'done' ? t.sessionDone : t.sessionActive}
            meta={sessionMeta ?? t.sessionMeta}
            statusLabel={getStatusLabel('session', sessionState)}
          />
          <ProgressStep
            href={feedbackHref}
            state={feedbackState}
            label={t.feedback}
            meta={feedbackMeta ?? <FeedbackAvatarPreview />}
            statusLabel={getStatusLabel('feedback', feedbackState)}
          />
          <ProgressStep
            href={planNextHref}
            state={planNextState}
            label={t.planNext}
            meta={planNextMeta ?? t.planNextMeta}
            statusLabel={getStatusLabel('plan-next', planNextState)}
            isLast
          />
        </div>

        {children ? children : null}
      </section>
    </main>
  );
}
