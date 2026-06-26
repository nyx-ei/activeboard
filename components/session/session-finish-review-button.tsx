'use client';

import { CalendarClock, Check, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { markDashboardPayloadStale } from '@/components/dashboard/dashboard-data-cache';
import type { PlanNextAccess } from '@/lib/session/plan-next-access';

type Candidate = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  compatibilityScore?: number;
};

export function SessionFinishReviewButton({
  locale,
  sessionId,
  groupId,
  questionGoal,
  planNextAccess,
  label,
  pendingLabel,
}: {
  locale: string;
  sessionId: string;
  groupId: string;
  questionGoal: number;
  planNextAccess?: PlanNextAccess;
  label: string;
  pendingLabel: string;
}) {
  const router = useRouter();
  const [isFinishing, setIsFinishing] = useState(false);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(() =>
    getDefaultNextSessionValue(),
  );
  const [sessionName, setSessionName] = useState(
    locale === 'fr' ? 'Session suivante' : 'Next session',
  );
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>(
    [],
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canInviteCandidates = Boolean(planNextAccess?.canInviteCandidates);
  const isLockedTestPlan = Boolean(
    planNextAccess?.isTestPhase && !canInviteCandidates,
  );
  const lockedQuestionGoal =
    planNextAccess?.lockedQuestionGoal ?? questionGoal;

  useEffect(() => {
    if (!isLockedTestPlan) {
      return;
    }

    setSessionName(
      locale === 'fr'
        ? `Session test ${planNextAccess?.nextTestSessionNumber ?? 1}`
        : `Test session ${planNextAccess?.nextTestSessionNumber ?? 1}`,
    );
  }, [isLockedTestPlan, locale, planNextAccess?.nextTestSessionNumber]);

  useEffect(() => {
    if (!canInviteCandidates || !isPlannerOpen) {
      setCandidates([]);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(
        `/api/session-candidates?query=${encodeURIComponent(candidateSearch.trim())}`,
        {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        },
      )
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as {
            ok?: boolean;
            candidates?: Candidate[];
          } | null;

          if (!response.ok || !payload?.ok || cancelled) {
            return;
          }

          setCandidates(payload.candidates ?? []);
        })
        .catch(() => {
          if (!cancelled) {
            setCandidates([]);
          }
        });
    }, candidateSearch.trim() ? 160 : 0);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [canInviteCandidates, candidateSearch, isPlannerOpen]);

  async function finishReview() {
    setIsFinishing(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/finish-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ locale }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        redirectTo?: string;
      } | null;

      if (payload?.redirectTo && response.ok) {
        window.sessionStorage.removeItem('activeboard:session-flow-active');
        markDashboardPayloadStale('sessions');
        markDashboardPayloadStale('performance');
        router.prefetch(payload.redirectTo as never);
        router.replace(payload.redirectTo as never);
        return;
      }

      setErrorMessage(payload?.message ?? pendingLabel);
      setIsFinishing(false);
    } catch {
      setErrorMessage(pendingLabel);
      setIsFinishing(false);
    }
  }

  async function planNextAndFinish() {
    if (isFinishing) {
      return;
    }

    setIsFinishing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({
          locale,
          groupId,
          sessionName,
          scheduledAt,
          questionGoal: isLockedTestPlan ? lockedQuestionGoal : questionGoal,
          timerMode: 'per_question',
          timerSeconds: 90,
          participantUserIds: selectedCandidateIds,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        calendarInvitesDispatchUrl?: string;
      } | null;

      if (!response.ok || payload?.ok === false) {
        setErrorMessage(payload?.message ?? pendingLabel);
        setIsFinishing(false);
        return;
      }

      if (payload?.calendarInvitesDispatchUrl) {
        void fetch(payload.calendarInvitesDispatchUrl, {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          keepalive: true,
        });
      }

      await finishReview();
    } catch {
      setErrorMessage(pendingLabel);
      setIsFinishing(false);
    }
  }

  return (
    <div>
      {isPlannerOpen ? (
        <div className="mb-3 overflow-hidden rounded-[14px] border border-white/60 bg-[#071512]/85 p-3 ring-1 ring-brand/15 sm:p-4">
          <p className="text-sm font-extrabold text-white sm:text-base">
            {locale === 'fr'
              ? 'Planifie la prochaine session'
              : 'Schedule the next session'}
          </p>
          <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(210px,0.78fr)]">
            <label className="min-w-0">
              <span className="sr-only">
                {locale === 'fr' ? 'Nom de la session' : 'Session name'}
              </span>
              <input
                value={sessionName}
                onChange={(event) => setSessionName(event.target.value)}
                readOnly={isLockedTestPlan}
                className="field h-11 min-w-0 rounded-[9px] px-3 text-sm"
                placeholder={
                  locale === 'fr' ? 'Session suivante' : 'Next session'
                }
              />
            </label>
            <label className="field flex h-11 min-w-0 items-center gap-2 rounded-[9px] px-3">
              <CalendarClock
                className="h-4 w-4 shrink-0 text-brand"
                aria-hidden="true"
                strokeWidth={1.8}
              />
              <input
                type={isLockedTestPlan ? 'time' : 'datetime-local'}
                value={
                  isLockedTestPlan ? scheduledAt.slice(11, 16) : scheduledAt
                }
                min={
                  isLockedTestPlan ? undefined : getMinDateTimeLocalValue()
                }
                onChange={(event) =>
                  setScheduledAt(
                    isLockedTestPlan
                      ? mergeLockedDateWithTime(scheduledAt, event.target.value)
                      : event.target.value,
                  )
                }
                className="min-w-0 flex-1 bg-transparent text-xs outline-none [color-scheme:dark] sm:text-sm"
                aria-label={
                  locale === 'fr'
                    ? 'Date de la prochaine session'
                    : 'Next session date'
                }
              />
            </label>
          </div>
          {canInviteCandidates ? (
            <div className="mt-3 rounded-[12px] border border-white/[0.08] bg-white/[0.025] p-2">
              <label className="flex h-10 items-center gap-2 rounded-[9px] border border-white/[0.06] bg-[#071512] px-3">
                <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <input
                  value={candidateSearch}
                  onChange={(event) => setCandidateSearch(event.target.value)}
                  placeholder={
                    locale === 'fr'
                      ? 'Rechercher par courriel'
                      : 'Search by email'
                  }
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                />
              </label>
              <div className="mt-2 max-h-36 space-y-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {candidates.map((candidate) => {
                  const selected = selectedCandidateIds.includes(candidate.id);

                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() =>
                        setSelectedCandidateIds((current) =>
                          selected
                            ? current.filter((id) => id !== candidate.id)
                            : [...current, candidate.id],
                        )
                      }
                      className={`flex w-full items-center gap-3 rounded-[9px] px-2 py-2 text-left transition ${
                        selected
                          ? 'bg-brand/10 text-white'
                          : 'text-slate-300 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#22504a] bg-cover bg-center text-[11px] font-bold text-[#9FF0CE]"
                        style={{
                          backgroundImage: candidate.avatarUrl
                            ? `url("${candidate.avatarUrl}")`
                            : undefined,
                        }}
                      >
                        {candidate.avatarUrl
                          ? null
                          : getInitials(candidate.name || candidate.email)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">
                          {candidate.name}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {candidate.compatibilityScore
                            ? locale === 'fr'
                              ? `${candidate.compatibilityScore} créneaux compatibles`
                              : `${candidate.compatibilityScore} compatible slots`
                            : candidate.email}
                        </span>
                      </span>
                      {selected ? (
                        <Check className="h-4 w-4 text-brand" aria-hidden="true" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <button
            type="button"
            disabled={isFinishing || !sessionName.trim() || !scheduledAt}
            onClick={() => void planNextAndFinish()}
            className="mt-3 h-11 w-full rounded-[9px] bg-brand text-sm font-extrabold text-[#06120e] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isFinishing
              ? pendingLabel
              : locale === 'fr'
                ? 'Planifier puis sauvegarder'
                : 'Schedule and save'}
          </button>
        </div>
      ) : null}
      <button
        type="button"
        disabled={isFinishing}
        onClick={() => {
          if (isFinishing) {
            return;
          }
          setIsPlannerOpen(true);
        }}
        className="hover:bg-brand/10 h-10 w-full rounded-[7px] border border-brand bg-transparent text-sm font-extrabold text-brand disabled:cursor-not-allowed disabled:opacity-70"
        aria-busy={isFinishing}
        aria-label={label}
      >
        {isFinishing
          ? pendingLabel
          : locale === 'fr'
            ? "Sauvegarder le progrès du jour"
            : "Save today's progress"}
      </button>
      {errorMessage ? (
        <p className="mt-3 text-center text-sm font-semibold text-rose-300">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

function getDefaultNextSessionValue() {
  const next = new Date();
  next.setDate(next.getDate() + 2);
  next.setMinutes(0, 0, 0);
  return formatDateTimeLocalValue(next);
}

function getMinDateTimeLocalValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15, 0, 0);
  return formatDateTimeLocalValue(now);
}

function formatDateTimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function mergeLockedDateWithTime(currentValue: string, nextTime: string) {
  const currentDate = currentValue.slice(0, 10);
  if (!currentDate || !nextTime) {
    return currentValue;
  }

  return `${currentDate}T${nextTime}`;
}

function getInitials(value: string) {
  return (
    value
      .split(/[\s@._-]+/)
      .map((part) => part.trim()[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'AB'
  );
}
