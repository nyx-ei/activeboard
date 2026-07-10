'use client';

import {
  CalendarClock,
  CheckCircle2,
  LockKeyhole,
  Mail,
  Search,
  Send,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useEffect, useMemo, useState, useTransition } from 'react';

import { Link } from '@/i18n/navigation';
import type { PlanNextAccess } from '@/lib/session/plan-next-access';

type SeriousCandidate = {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string | null;
  avatarUrl: string | null;
  classificationLabel: string;
  compatibilityScore: number;
  profileScore: number;
  questionsReviewed: number;
  sessionsAttended: number;
  nextSessionsPlanned: number;
  positivePeerVotes: number;
  totalPeerVotes: number;
  punctualityRate: number | null;
  lastActiveAt: string | null;
};

type SeriousCandidatesPanelProps = {
  locale: string;
  planNextAccess?: PlanNextAccess;
};

const copy = {
  en: {
    lockedTitle: 'You completed your test sessions.',
    lockedDescription:
      'Unlock serious candidates and schedule real sessions.',
    unlock: 'Unlock serious candidates',
    unlockedTitle: 'Serious candidates',
    unlockedDescription:
      'Ranked by same exam/language, shared availability, attendance, reviewed questions, next-session planning, and peer feedback.',
    search: 'Search serious candidates',
    empty: 'No serious candidate is available yet.',
    planNext: 'Plan next session',
    createGroup: 'Create study group',
    groupName: 'Group name',
    groupNamePlaceholder: 'MCCQE focused review group',
    selected: '{count}/4 selected',
    sendInvitations: 'Send invitations',
    sending: 'Sending...',
    error: 'The study group could not be created.',
    sessions: 'sessions',
    reviewed: 'reviewed',
    punctuality: 'punctuality',
    nextPlanned: 'next planned',
    positiveFeedback: 'positive feedback',
    lastActive: 'last active',
    contact: 'Contact',
    bestMatch: 'Best match',
  },
  fr: {
    lockedTitle: 'Tu as terminé tes séances test.',
    lockedDescription:
      'Débloque les candidats sérieux et planifie des séances réelles.',
    unlock: 'Débloquer les candidats sérieux',
    unlockedTitle: 'Candidats sérieux',
    unlockedDescription:
      'Classés par examen/langue, disponibilités partagées, présence, questions révisées, planification et feedback pair-à-pair.',
    search: 'Rechercher des candidats sérieux',
    empty: 'Aucun candidat sérieux disponible pour le moment.',
    planNext: 'Planifier la prochaine séance',
    createGroup: 'Créer un groupe',
    groupName: 'Nom du groupe',
    groupNamePlaceholder: 'Groupe de révision MCCQE',
    selected: '{count}/4 sélectionnés',
    sendInvitations: 'Envoyer les invitations',
    sending: 'Envoi...',
    error: "Le groupe n'a pas pu être créé.",
    sessions: 'séances',
    reviewed: 'révisées',
    punctuality: 'ponctualité',
    nextPlanned: 'suite planifiée',
    positiveFeedback: 'feedback positif',
    lastActive: 'dernière activité',
    contact: 'Contact',
    bestMatch: 'Meilleur match',
  },
} as const;

export function SeriousCandidatesPanel({
  locale,
  planNextAccess,
}: SeriousCandidatesPanelProps) {
  const language = locale === 'fr' ? 'fr' : 'en';
  const t = copy[language];
  const completedTestSessions = planNextAccess?.completedTestSessions ?? 0;
  const requiredTestSessions = planNextAccess?.requiredTestSessions ?? 3;
  const isTestComplete = completedTestSessions >= requiredTestSessions;
  const isUnlocked = Boolean(planNextAccess?.canInviteCandidates);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<SeriousCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isUnlocked) {
      setCandidates([]);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      void fetch(
        `/api/session-candidates?locale=${language}&query=${encodeURIComponent(query.trim())}`,
        {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        },
      )
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as {
            ok?: boolean;
            candidates?: SeriousCandidate[];
          } | null;

          if (!cancelled) {
            setCandidates(response.ok && payload?.ok ? (payload.candidates ?? []) : []);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setCandidates([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });
    }, query.trim() ? 180 : 0);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [isUnlocked, language, query]);

  const selectedCandidates = useMemo(
    () =>
      candidates.filter((candidate) =>
        selectedCandidateIds.includes(candidate.id),
      ),
    [candidates, selectedCandidateIds],
  );
  const canCreateGroup =
    groupName.trim().length > 0 && selectedCandidateIds.length > 0;

  function toggleCandidate(candidateId: string) {
    setError(null);
    setSelectedCandidateIds((current) => {
      if (current.includes(candidateId)) {
        return current.filter((id) => id !== candidateId);
      }
      if (current.length >= 4) {
        return current;
      }
      return [...current, candidateId];
    });
  }

  function openPlanNext() {
    window.dispatchEvent(new CustomEvent('activeboard:open-create-session'));
  }

  function createGroup() {
    if (!canCreateGroup || isPending) {
      return;
    }

    startTransition(async () => {
      setError(null);
      const response = await fetch('/api/serious-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({
          locale: language,
          groupName: groupName.trim(),
          candidateIds: selectedCandidateIds,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        redirectTo?: string;
      } | null;

      if (!response.ok || !payload?.redirectTo) {
        setError(t.error);
        return;
      }

      window.location.assign(payload.redirectTo);
    });
  }

  if (isTestComplete && !isUnlocked) {
    return (
      <section className="rounded-[24px] border border-amber-300/30 bg-amber-300/[0.08] p-5 shadow-[inset_0_0_34px_rgba(251,191,36,0.06)] sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-amber-300 text-[#062b22]">
              <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-white">
                {t.lockedTitle}
              </h2>
              <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-[#d8c89a]">
                {t.lockedDescription}
              </p>
            </div>
          </div>
          <Link
            href="/billing"
            className="inline-flex h-11 items-center justify-center rounded-[9px] bg-brand px-5 text-sm font-extrabold text-[#06120e] transition hover:bg-[#2fe9b1]"
          >
            {t.unlock}
          </Link>
        </div>
      </section>
    );
  }

  if (!isUnlocked) {
    return null;
  }

  return (
    <section className="rounded-[24px] border border-[#20D9A3]/25 bg-[#06221d]/84 p-4 shadow-[inset_0_0_40px_rgba(32,217,163,0.055)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-xs font-extrabold text-brand">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t.bestMatch}
          </p>
          <h2 className="mt-3 text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl">
            {t.unlockedTitle}
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#8fa7a2]">
            {t.unlockedDescription}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={openPlanNext}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[9px] border border-brand/35 bg-brand/10 px-4 text-sm font-extrabold text-brand transition hover:bg-brand/15"
          >
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            {t.planNext}
          </button>
          <button
            type="button"
            onClick={() => setIsGroupOpen((current) => !current)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[9px] bg-brand px-4 text-sm font-extrabold text-[#06120e] transition hover:bg-[#2fe9b1]"
          >
            <UsersRound className="h-4 w-4" aria-hidden="true" />
            {t.createGroup}
          </button>
        </div>
      </div>

      <label className="mt-5 flex h-11 items-center gap-2 rounded-[10px] border border-white/[0.08] bg-[#071512] px-3">
        <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.search}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-600"
        />
      </label>

      {isGroupOpen ? (
        <div className="mt-4 rounded-[16px] border border-white/[0.08] bg-white/[0.035] p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="grid gap-2">
              <span className="text-sm font-extrabold text-slate-300">
                {t.groupName}
              </span>
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder={t.groupNamePlaceholder}
                className="field h-11 rounded-[9px] px-3 text-sm"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                disabled={!canCreateGroup || isPending}
                onClick={createGroup}
                className="button-primary h-11 rounded-[9px] px-4 text-sm disabled:opacity-60"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {isPending ? t.sending : t.sendInvitations}
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs font-bold text-slate-500">
            {t.selected.replace('{count}', String(selectedCandidateIds.length))}
          </p>
          {selectedCandidates.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedCandidates.map((candidate) => (
                <span
                  key={candidate.id}
                  className="rounded-full bg-brand/10 px-3 py-1 text-xs font-extrabold text-brand"
                >
                  {candidate.name}
                </span>
              ))}
            </div>
          ) : null}
          {error ? (
            <p className="mt-3 text-sm font-bold text-rose-300">{error}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {candidates.map((candidate, index) => {
          const selected = selectedCandidateIds.includes(candidate.id);

          return (
            <article
              key={candidate.id}
              className={`rounded-[16px] border p-4 transition ${
                selected
                  ? 'border-brand/55 bg-brand/10'
                  : 'border-white/[0.08] bg-[#0b2522]'
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggleCandidate(candidate.id)}
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                    selected
                      ? 'border-brand bg-brand text-[#06120e]'
                      : 'border-white/15 text-transparent'
                  }`}
                  aria-label={candidate.name}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-extrabold text-white">
                      {index + 1}. {candidate.name}
                    </h3>
                    <span className="rounded-full border border-brand/25 bg-brand/10 px-2 py-0.5 text-[10px] font-extrabold text-brand">
                      {candidate.classificationLabel}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 truncate text-xs font-semibold text-slate-400">
                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{candidate.email}</span>
                  </p>
                  {candidate.phoneNumber ? (
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {t.contact}: {candidate.phoneNumber}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-brand">
                    {candidate.profileScore}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    score
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-[#b8c7c4] sm:grid-cols-3">
                <Metric value={candidate.sessionsAttended} label={t.sessions} />
                <Metric value={candidate.questionsReviewed} label={t.reviewed} />
                <Metric
                  value={
                    candidate.punctualityRate === null
                      ? '--'
                      : `${candidate.punctualityRate}%`
                  }
                  label={t.punctuality}
                />
                <Metric value={candidate.nextSessionsPlanned} label={t.nextPlanned} />
                <Metric
                  value={`${candidate.positivePeerVotes}/${candidate.totalPeerVotes}`}
                  label={t.positiveFeedback}
                />
                <Metric
                  value={formatLastActive(candidate.lastActiveAt, language)}
                  label={t.lastActive}
                />
              </div>
            </article>
          );
        })}
      </div>

      {!isLoading && candidates.length === 0 ? (
        <div className="mt-4 rounded-[14px] border border-white/[0.08] bg-white/[0.035] p-5 text-center text-sm font-semibold text-slate-400">
          {t.empty}
        </div>
      ) : null}
    </section>
  );
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.025] p-2">
      <p className="text-sm font-extrabold text-white">{value}</p>
      <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.1em] text-slate-500">
        {label}
      </p>
    </div>
  );
}

function formatLastActive(value: string | null, locale: 'en' | 'fr') {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    month: 'short',
    day: '2-digit',
  }).format(date);
}
