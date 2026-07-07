'use client';

import { ArrowLeft, Check, HelpCircle, ThumbsDown, ThumbsUp, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useState, useTransition } from 'react';

import { Link } from '@/i18n/navigation';

type Peer = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

type FeedbackValue = 'yes' | 'no' | 'not_enough';

type SessionPeerFeedbackRuntimeProps = {
  locale: string;
  sessionId: string;
  sessionTitle: string;
  peers: Peer[];
};

const copy = {
  en: {
    back: 'Back',
    title: 'Peer feedback',
    progress: 'Session progress',
    sessionDone: 'Sprint reviewed',
    feedback: 'Peer feedback',
    planNext: 'Plan next session',
    question: 'Would you study with this person again?',
    yes: 'Yes',
    no: 'No',
    notEnough: 'Not enough',
    note: 'Your feedback stays private and is only used for matching.',
    empty: 'No other participant to evaluate for this session.',
    submit: 'Submit feedback',
    submitting: 'Submitting...',
    error: 'Feedback could not be submitted. Please try again.',
  },
  fr: {
    back: 'Retour',
    title: 'Feedback',
    progress: 'Progression de la séance',
    sessionDone: 'Sprint révisé',
    feedback: 'Feedback',
    planNext: 'Planifier la suite',
    question: 'Étudierais-tu encore avec cette personne ?',
    yes: 'Oui',
    no: 'Non',
    notEnough: 'Pas assez',
    note: 'Ton feedback reste privé et sert uniquement au matching.',
    empty: 'Aucun autre participant à évaluer pour cette séance.',
    submit: 'Soumettre le feedback',
    submitting: 'Soumission...',
    error: "Le feedback n'a pas pu être soumis. Réessaie.",
  },
} as const;

export function SessionPeerFeedbackRuntime({
  locale,
  sessionId,
  sessionTitle,
  peers,
}: SessionPeerFeedbackRuntimeProps) {
  const language = locale === 'fr' ? 'fr' : 'en';
  const t = copy[language];
  const router = useRouter();
  const [responses, setResponses] = useState<Record<string, FeedbackValue>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canSubmit =
    peers.length === 0 || peers.every((peer) => Boolean(responses[peer.id]));

  function setPeerResponse(peerId: string, value: FeedbackValue) {
    setResponses((current) => ({ ...current, [peerId]: value }));
    setError(null);
  }

  function submitFeedback() {
    if (!canSubmit || isPending) {
      return;
    }

    startTransition(async () => {
      setError(null);
      const feedback = peers.flatMap((peer) => {
        const value = responses[peer.id];
        if (!value || value === 'not_enough') {
          return [];
        }
        return [{ userId: peer.id, willStudyAgain: value === 'yes' }];
      });

      const response = await fetch(`/api/sessions/${sessionId}/peer-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      });

      if (!response.ok) {
        setError(t.error);
        return;
      }

      router.replace(`/${language}/sessions/${sessionId}?stage=plan-next`);
      router.refresh();
    });
  }

  return (
    <main className="min-h-screen bg-[#001915] px-4 py-6 text-white sm:px-6">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div className="flex items-center gap-4">
          <Link
            href={`/sessions/${sessionId}?stage=review`}
            prefetch={false}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-brand/50 hover:text-white"
            aria-label={t.back}
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
            <ProgressStep done label={t.sessionDone} />
            <ProgressStep active label={t.feedback} />
            <ProgressStep label={t.planNext} />
          </div>
        </div>

        <div className="rounded-[18px] border border-white/10 bg-[#111827] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.25)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-white">{t.title}</h2>
              <p className="mt-2 max-w-xl text-sm font-semibold text-slate-400">
                {t.question}
              </p>
            </div>
            <div className="hidden h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand sm:flex">
              <HelpCircle className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {peers.length === 0 ? (
              <p className="rounded-[12px] border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold text-slate-300">
                {t.empty}
              </p>
            ) : (
              peers.map((peer) => (
                <div
                  key={peer.id}
                  className="grid gap-3 rounded-[14px] border border-white/10 bg-white/[0.035] p-3 sm:grid-cols-[1fr_auto]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {peer.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={peer.avatarUrl}
                        alt=""
                        className="h-11 w-11 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#17483d] text-slate-200">
                        <UserRound className="h-5 w-5" aria-hidden="true" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-white">
                        {peer.name}
                      </p>
                      <p className="truncate text-xs font-semibold text-slate-500">
                        {peer.email}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:min-w-[310px]">
                    <FeedbackButton
                      active={responses[peer.id] === 'yes'}
                      label={t.yes}
                      icon={<ThumbsUp className="h-4 w-4" aria-hidden="true" />}
                      onClick={() => setPeerResponse(peer.id, 'yes')}
                    />
                    <FeedbackButton
                      active={responses[peer.id] === 'no'}
                      label={t.no}
                      icon={<ThumbsDown className="h-4 w-4" aria-hidden="true" />}
                      onClick={() => setPeerResponse(peer.id, 'no')}
                    />
                    <FeedbackButton
                      active={responses[peer.id] === 'not_enough'}
                      label={t.notEnough}
                      onClick={() => setPeerResponse(peer.id, 'not_enough')}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <p className="mt-5 text-xs font-semibold text-slate-500">{t.note}</p>
          {error ? (
            <p className="mt-4 text-sm font-bold text-rose-300">{error}</p>
          ) : null}

          <button
            type="button"
            onClick={submitFeedback}
            disabled={!canSubmit || isPending}
            className="button-primary mt-6 w-full justify-center rounded-[8px] px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? t.submitting : t.submit}
          </button>
        </div>
      </section>
    </main>
  );
}

function ProgressStep({
  label,
  active = false,
  done = false,
}: {
  label: string;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-[12px] border px-3 py-3 text-sm font-extrabold ${
        active
          ? 'border-brand bg-brand/10 text-brand'
          : done
            ? 'border-brand/35 bg-white/[0.03] text-white'
            : 'border-white/10 bg-white/[0.025] text-slate-500'
      }`}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full border ${
          done
            ? 'border-brand bg-brand text-[#04120e]'
            : active
              ? 'border-brand text-brand'
              : 'border-white/15 text-transparent'
        }`}
      >
        {done ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function FeedbackButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border px-2 text-xs font-extrabold transition ${
        active
          ? 'border-brand bg-brand text-[#04120e]'
          : 'border-white/10 bg-[#0b1324] text-slate-300 hover:border-brand/40'
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
