'use client';

import { HelpCircle, ThumbsDown, ThumbsUp, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useState, useTransition } from 'react';

import { SessionProgressPanel } from '@/components/session/session-progress-panel';

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

      router.replace(
        `/${language}/sessions/${sessionId}?stage=progress&feedback=done`,
      );
      router.refresh();
    });
  }

  return (
    <SessionProgressPanel
      locale={language}
      sessionTitle={sessionTitle}
      activeStep="feedback"
      backHref={`/sessions/${sessionId}?stage=progress`}
      backLabel={t.back}
      sessionHref={`/sessions/${sessionId}?stage=review`}
    >
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
    </SessionProgressPanel>
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
