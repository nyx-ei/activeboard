'use client';

import { CalendarClock } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { markDashboardPayloadStale } from '@/components/dashboard/dashboard-data-cache';

export function SessionFinishReviewButton({
  locale,
  sessionId,
  groupId,
  questionGoal,
  label,
  pendingLabel,
}: {
  locale: string;
  sessionId: string;
  groupId: string;
  questionGoal: number;
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
    locale === 'fr' ? 'Prochaine session' : 'Next session',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        window.setTimeout(() => router.refresh(), 0);
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
          questionGoal,
          timerMode: 'per_question',
          timerSeconds: 90,
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
              ? 'Planifie la prochaine session avant de quitter'
              : 'Schedule the next session before leaving'}
          </p>
          <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(210px,0.78fr)]">
            <label className="min-w-0">
              <span className="sr-only">
                {locale === 'fr' ? 'Nom de la session' : 'Session name'}
              </span>
              <input
                value={sessionName}
                onChange={(event) => setSessionName(event.target.value)}
                className="field h-11 min-w-0 rounded-[9px] px-3 text-sm"
                placeholder={
                  locale === 'fr' ? 'Prochaine session' : 'Next session'
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
                type="datetime-local"
                value={scheduledAt}
                min={getMinDateTimeLocalValue()}
                onChange={(event) => setScheduledAt(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-xs outline-none [color-scheme:dark] sm:text-sm"
                aria-label={
                  locale === 'fr'
                    ? 'Date de la prochaine session'
                    : 'Next session date'
                }
              />
            </label>
          </div>
          <button
            type="button"
            disabled={isFinishing || !sessionName.trim() || !scheduledAt}
            onClick={() => void planNextAndFinish()}
            className="mt-3 h-11 w-full rounded-[9px] bg-brand text-sm font-extrabold text-[#06120e] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isFinishing
              ? pendingLabel
              : locale === 'fr'
                ? 'Planifier et terminer'
                : 'Schedule and finish'}
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
      >
        {isFinishing ? pendingLabel : label}
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
