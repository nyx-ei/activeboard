'use client';

import { CalendarDays, Clock, LinkIcon, LockKeyhole, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useMemo, useState, useTransition } from 'react';

import { SessionProgressPanel } from '@/components/session/session-progress-panel';
import type { PlanNextAccess } from '@/lib/session/plan-next-access';

type SessionPlanNextRuntimeProps = {
  locale: string;
  sessionId: string;
  groupId: string;
  sessionTitle: string;
  questionGoal: number;
  timerSeconds: number;
  timerMode: 'per_question' | 'global';
  planNextAccess?: PlanNextAccess;
};

const copy = {
  en: {
    back: 'Back',
    title: 'Schedule next session',
    sessionName: 'Session name',
    questions: 'Questions',
    timer: 'Timer',
    date: 'Date',
    time: 'Time',
    meetingLink: 'Meeting link',
    schedule: 'Schedule next session',
    scheduling: 'Scheduling...',
    locked: 'Locked for test sessions',
    error: 'The next session could not be scheduled. Please try again.',
  },
  fr: {
    back: 'Retour',
    title: 'Planifier la prochaine séance',
    sessionName: 'Nom de la séance',
    questions: 'Questions',
    timer: 'Minuteur',
    date: 'Date',
    time: 'Heure',
    meetingLink: 'Lien de réunion',
    schedule: 'Planifier la prochaine séance',
    scheduling: 'Planification...',
    locked: 'Verrouillé pour les séances test',
    error: "La prochaine séance n'a pas pu être planifiée. Réessaie.",
  },
} as const;

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toTimeInputValue(date: Date) {
  return date.toTimeString().slice(0, 5);
}

function getDefaultDate() {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  date.setMinutes(0, 0, 0);
  if (date.getHours() < 8) {
    date.setHours(8);
  } else {
    date.setHours(date.getHours() + 1);
  }
  return date;
}

export function SessionPlanNextRuntime({
  locale,
  sessionId,
  groupId,
  sessionTitle,
  questionGoal,
  timerSeconds,
  timerMode,
  planNextAccess,
}: SessionPlanNextRuntimeProps) {
  const language = locale === 'fr' ? 'fr' : 'en';
  const t = copy[language];
  const router = useRouter();
  const defaultDate = useMemo(() => getDefaultDate(), []);
  const isLockedTestPlan = Boolean(
    planNextAccess?.isTestPhase && !planNextAccess.canInviteCandidates,
  );
  const [sessionName, setSessionName] = useState(sessionTitle);
  const [dateValue, setDateValue] = useState(toDateInputValue(defaultDate));
  const [timeValue, setTimeValue] = useState(toTimeInputValue(defaultDate));
  const [questions, setQuestions] = useState(String(questionGoal));
  const [seconds, setSeconds] = useState(String(timerSeconds));
  const [meetingLink, setMeetingLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canSubmit =
    sessionName.trim().length > 0 &&
    dateValue.length > 0 &&
    timeValue.length > 0 &&
    Number(questions) > 0 &&
    Number(seconds) > 0;

  function submitPlan() {
    if (!canSubmit || isPending) {
      return;
    }

    startTransition(async () => {
      setError(null);
      const scheduledAt = new Date(`${dateValue}T${timeValue}`);
      if (Number.isNaN(scheduledAt.getTime())) {
        setError(t.error);
        return;
      }

      const createResponse = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: language,
          groupId,
          sessionName: sessionName.trim(),
          scheduledAt: scheduledAt.toISOString(),
          questionGoal: Number(questions),
          timerMode,
          timerSeconds: Number(seconds),
          meetingLink: meetingLink.trim(),
          forceCreate: true,
          continuitySessionId: sessionId,
          returnTo: `/${language}/sessions/${sessionId}?stage=progress&feedback=done`,
        }),
      });
      const createPayload = (await createResponse
        .json()
        .catch(() => null)) as { message?: string } | null;

      if (!createResponse.ok) {
        setError(createPayload?.message ?? t.error);
        return;
      }

      const finishResponse = await fetch(
        `/api/sessions/${sessionId}/finish-review`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: language }),
        },
      );
      const finishPayload = (await finishResponse
        .json()
        .catch(() => null)) as { message?: string } | null;

      if (!finishResponse.ok) {
        setError(finishPayload?.message ?? t.error);
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
      activeStep="plan-next"
      backHref={`/sessions/${sessionId}?stage=progress&feedback=done`}
      backLabel={t.back}
      sessionHref={`/sessions/${sessionId}?stage=review`}
      feedbackHref={`/sessions/${sessionId}?stage=feedback`}
      sessionMeta={`${questionGoal}/${questionGoal}Q - ${timerSeconds} sec`}
      planNextMeta="XX - XXhXX"
    >
        <div className="rounded-[18px] border border-white/10 bg-[#111827] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.25)] sm:p-6">
          <h2 className="text-xl font-extrabold text-white">{t.title}</h2>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-extrabold text-slate-300">
                {t.sessionName}
              </span>
              <input
                value={sessionName}
                onChange={(event) => setSessionName(event.target.value)}
                className="h-12 rounded-[8px] border border-white/10 bg-[#202938] px-4 text-sm font-bold text-white outline-none transition focus:border-brand"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label={t.questions}
                value={questions}
                onChange={setQuestions}
                locked={isLockedTestPlan}
              />
              <NumberField
                label={t.timer}
                value={seconds}
                onChange={setSeconds}
                locked={isLockedTestPlan}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FieldShell label={t.date} locked={isLockedTestPlan}>
                <CalendarDays className="h-4 w-4 text-slate-500" aria-hidden />
                <input
                  type="date"
                  value={dateValue}
                  onChange={(event) => setDateValue(event.target.value)}
                  disabled={isLockedTestPlan}
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none disabled:opacity-70"
                />
              </FieldShell>
              <FieldShell label={t.time}>
                <Clock className="h-4 w-4 text-slate-500" aria-hidden />
                <input
                  type="time"
                  value={timeValue}
                  onChange={(event) => setTimeValue(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none"
                />
              </FieldShell>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-extrabold text-slate-300">
                {t.meetingLink}
              </span>
              <span className="flex h-12 items-center gap-3 rounded-[8px] border border-white/10 bg-[#202938] px-4 transition focus-within:border-brand">
                <LinkIcon className="h-4 w-4 text-slate-500" aria-hidden />
                <input
                  value={meetingLink}
                  onChange={(event) => setMeetingLink(event.target.value)}
                  placeholder="https://..."
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none"
                />
              </span>
            </label>
          </div>

          {isLockedTestPlan ? (
            <p className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-amber-200">
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              {t.locked}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 text-sm font-bold text-rose-300">{error}</p>
          ) : null}

          <button
            type="button"
            onClick={submitPlan}
            disabled={!canSubmit || isPending}
            className="button-primary mt-6 w-full justify-center rounded-[8px] px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? t.scheduling : t.schedule}
          </button>
        </div>
    </SessionProgressPanel>
  );
}

function NumberField({
  label,
  value,
  onChange,
  locked,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
}) {
  return (
    <FieldShell label={label} locked={locked}>
      <Users className="h-4 w-4 text-slate-500" aria-hidden />
      <input
        type="number"
        min={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={locked}
        className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none disabled:opacity-70"
      />
    </FieldShell>
  );
}

function FieldShell({
  label,
  locked = false,
  children,
}: {
  label: string;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="flex items-center gap-2 text-sm font-extrabold text-slate-300">
        {label}
        {locked ? (
          <LockKeyhole className="h-3.5 w-3.5 text-amber-200" aria-hidden />
        ) : null}
      </span>
      <span className="flex h-12 min-w-0 items-center gap-2 rounded-[8px] border border-white/10 bg-[#202938] px-3 transition focus-within:border-brand">
        {children}
      </span>
    </label>
  );
}
