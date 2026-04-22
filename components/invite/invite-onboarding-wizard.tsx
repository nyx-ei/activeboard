'use client';

import { useMemo, useState } from 'react';

import {
  AVAILABILITY_HOURS,
  AVAILABILITY_WEEKDAYS,
  CURATED_TIMEZONES,
} from '@/components/dashboard/user-schedule-form';
import type { AvailabilityGrid, AvailabilityWeekday } from '@/lib/schedule/availability';
import { DEFAULT_AVAILABILITY_GRID } from '@/lib/schedule/availability';

type InviteOnboardingWizardProps = {
  locale: string;
  inviteId: string;
  redirectTo: string;
  groupName: string;
  inviteCode: string;
  inviteSchedules: Array<{
    weekday: string;
    start_time: string;
    end_time: string;
  }>;
  scheduleConflicts: Array<{
    groupName: string;
    weekday: string;
    startTime: string;
    endTime: string;
  }>;
  initialExamSession: string;
  initialLanguage: 'en' | 'fr';
  initialTimezone: string;
  initialQuestionBanks: string[];
  initialAvailabilityGrid: AvailabilityGrid;
  completeAction: (formData: FormData) => void;
  declineAction: (formData: FormData) => void;
  labels: {
    inheritedHint: string;
    examStepTitle: string;
    examStepDescription: string;
    examSession: string;
    selectPlaceholder: string;
    examAprilMay2026: string;
    examAugustSeptember2026: string;
    examOctober2026: string;
    examPlanningAhead: string;
    language: string;
    languageEnglish: string;
    languageFrench: string;
    timezone: string;
    questionBanks: string;
    bankCmcPrep: string;
    bankOther: string;
    next: string;
    back: string;
    scheduleStepTitle: string;
    scheduleStepDescription: string;
    setScheduleNow: string;
    continueWithoutSchedule: string;
    slotsCount: string;
    empty: string;
    weekdays: Record<AvailabilityWeekday, string>;
    reviewStepTitle: string;
    reviewStepDescription: string;
    invitationCode: string;
    groupSchedule: string;
    noSchedule: string;
    conflictTitle: string;
    conflictDescription: string;
    conflictNote: string;
    decline: string;
    joinGroup: string;
    stepExam: string;
    stepSchedule: string;
    stepReview: string;
  };
};

const QUESTION_BANKS = [
  { value: 'cmc_prep', labelKey: 'bankCmcPrep' },
  { value: 'aceqbank', label: 'AceQbank' },
  { value: 'uworld', label: 'UWorld' },
  { value: 'canadaqbank', label: 'CanadaQBank' },
  { value: 'amboss', label: 'Amboss' },
  { value: 'other', labelKey: 'bankOther' },
] as const;

function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function InviteOnboardingWizard({
  locale,
  inviteId,
  redirectTo,
  groupName,
  inviteCode,
  inviteSchedules,
  scheduleConflicts,
  initialExamSession,
  initialLanguage,
  initialTimezone,
  initialQuestionBanks,
  initialAvailabilityGrid,
  completeAction,
  declineAction,
  labels,
}: InviteOnboardingWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [examSession, setExamSession] = useState(initialExamSession);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'fr'>(initialLanguage);
  const [timezone, setTimezone] = useState(initialTimezone || 'UTC');
  const [selectedBanks, setSelectedBanks] = useState<Set<string>>(() => new Set(initialQuestionBanks));
  const [setScheduleNow, setSetScheduleNow] = useState(
    AVAILABILITY_WEEKDAYS.some((weekday: AvailabilityWeekday) => (initialAvailabilityGrid[weekday] ?? []).length > 0),
  );
  const [grid, setGrid] = useState<AvailabilityGrid>(initialAvailabilityGrid ?? DEFAULT_AVAILABILITY_GRID);

  const timezoneOptions = useMemo(() => {
    if (timezone && !CURATED_TIMEZONES.includes(timezone)) {
      return [timezone, ...CURATED_TIMEZONES];
    }

    return CURATED_TIMEZONES;
  }, [timezone]);

  const slotCount = AVAILABILITY_WEEKDAYS.reduce(
    (sum: number, weekday: AvailabilityWeekday) => sum + grid[weekday].length,
    0,
  );

  function toggleBank(value: string) {
    setSelectedBanks((current) => {
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

  function toggleSlot(weekday: AvailabilityWeekday, hour: number) {
    setGrid((current) => {
      const existing = current[weekday];
      const nextHours = existing.includes(hour)
        ? existing.filter((value) => value !== hour)
        : [...existing, hour].sort((left, right) => left - right);

      return {
        ...current,
        [weekday]: nextHours,
      };
    });
  }

  function renderStepPill(index: 1 | 2 | 3, label: string) {
    const active = step === index;
    const completed = step > index;

    return (
      <div
        key={label}
        className={[
          'flex h-9 flex-1 items-center justify-center rounded-full border px-3 text-xs font-semibold',
          active || completed
            ? 'border-brand/35 bg-brand/12 text-brand'
            : 'border-white/10 bg-white/[0.03] text-slate-500',
        ].join(' ')}
      >
        {label}
      </div>
    );
  }

  return (
    <section className="surface-mockup w-full max-w-[620px] p-4 sm:p-6">
      <div className="grid grid-cols-3 gap-2">
        {renderStepPill(1, labels.stepExam)}
        {renderStepPill(2, labels.stepSchedule)}
        {renderStepPill(3, labels.stepReview)}
      </div>

      {step === 1 ? (
        <div className="mt-6">
          <h2 className="text-xl font-semibold text-white">{labels.examStepTitle}</h2>
          <p className="mt-2 text-sm text-slate-400">{labels.examStepDescription}</p>
          <p className="mt-2 text-xs text-slate-500">{labels.inheritedHint}</p>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-300">{labels.examSession}</span>
              <select
                value={examSession}
                onChange={(event) => setExamSession(event.target.value)}
                className="field h-10 rounded-[8px] px-3 py-2 text-sm"
              >
                <option value="">{labels.selectPlaceholder}</option>
                <option value="april_may_2026">{labels.examAprilMay2026}</option>
                <option value="august_september_2026">{labels.examAugustSeptember2026}</option>
                <option value="october_2026">{labels.examOctober2026}</option>
                <option value="planning_ahead">{labels.examPlanningAhead}</option>
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">{labels.language}</span>
                <select
                  value={selectedLanguage}
                  onChange={(event) => setSelectedLanguage(event.target.value === 'fr' ? 'fr' : 'en')}
                  className="field h-10 rounded-[8px] px-3 py-2 text-sm"
                >
                  <option value="en">{labels.languageEnglish}</option>
                  <option value="fr">{labels.languageFrench}</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-300">{labels.timezone}</span>
                <select
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  className="field h-10 rounded-[8px] px-3 py-2 text-sm"
                >
                  {timezoneOptions.map((option: string) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-300">{labels.questionBanks}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {QUESTION_BANKS.map((bank) => {
                  const label = 'label' in bank ? bank.label : labels[bank.labelKey];
                  const selected = selectedBanks.has(bank.value);

                  return (
                    <button
                      key={bank.value}
                      type="button"
                      onClick={() => toggleBank(bank.value)}
                      className={[
                        'h-9 min-w-0 truncate rounded-[8px] border px-3 text-left text-xs font-medium transition',
                        selected
                          ? 'border-brand/35 bg-brand/12 text-brand'
                          : 'border-white/10 bg-white/[0.035] text-slate-400 hover:border-brand/30 hover:bg-brand/10 hover:text-brand',
                      ].join(' ')}
                      title={label}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!examSession}
              className="button-primary h-11 w-full rounded-[8px] px-5 text-sm disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
            >
              {labels.next}
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-6">
          <h2 className="text-xl font-semibold text-white">{labels.scheduleStepTitle}</h2>
          <p className="mt-2 text-sm text-slate-400">{labels.scheduleStepDescription}</p>

          <button
            type="button"
            onClick={() => setSetScheduleNow((value: boolean) => !value)}
            className={[
              'mt-5 flex w-full items-center gap-3 rounded-[12px] border px-4 py-4 text-left text-base font-medium transition',
              setScheduleNow
                ? 'border-brand/35 bg-brand/10 text-white'
                : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.05]',
            ].join(' ')}
          >
            <span
              className={[
                'flex h-5 w-5 items-center justify-center rounded-[5px] border text-xs font-bold',
                setScheduleNow ? 'border-brand bg-brand text-[#04111f]' : 'border-white/15 text-transparent',
              ].join(' ')}
            >
              ✓
            </span>
            <span>{labels.setScheduleNow}</span>
          </button>

          {setScheduleNow ? (
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                  {labels.slotsCount.replace('{count}', String(slotCount))}
                </span>
              </div>

              <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="w-max min-w-full">
                  <div className="grid grid-cols-[72px_repeat(17,28px)] gap-1.5">
                    <div />
                    {AVAILABILITY_HOURS.map((hour: number) => (
                      <div key={hour} className="text-center text-[10px] font-semibold text-slate-500">
                        {formatHourLabel(hour)}
                      </div>
                    ))}
                    {AVAILABILITY_WEEKDAYS.map((weekday: AvailabilityWeekday) => (
                      <div key={weekday} className="contents">
                        <div className="flex items-center text-xs font-semibold text-white">{labels.weekdays[weekday]}</div>
                        {AVAILABILITY_HOURS.map((hour: number) => {
                          const isActive = grid[weekday].includes(hour);
                          return (
                            <button
                              key={`${weekday}-${hour}`}
                              type="button"
                              onClick={() => toggleSlot(weekday, hour)}
                              className={[
                                'h-8 rounded-[8px] border text-[10px] font-semibold transition',
                                isActive
                                  ? 'border-brand bg-brand/20 text-brand'
                                  : 'border-border bg-white/[0.03] text-slate-500 hover:border-white/20 hover:bg-white/[0.05] hover:text-white',
                              ].join(' ')}
                              aria-pressed={isActive}
                            >
                              {isActive ? '✓' : ''}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {slotCount === 0 ? <p className="mt-3 text-xs text-slate-500">{labels.empty}</p> : null}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="h-11 rounded-[8px] border border-white/10 bg-transparent px-5 text-sm font-semibold text-white transition hover:bg-white/[0.04]"
            >
              {labels.back}
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="button-primary h-11 rounded-[8px] px-5 text-sm"
            >
              {setScheduleNow ? labels.next : labels.continueWithoutSchedule}
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-6">
          <h2 className="text-xl font-semibold text-white">{labels.reviewStepTitle}</h2>
          <p className="mt-2 text-sm text-slate-400">{labels.reviewStepDescription}</p>

          <div className="mt-5 rounded-[12px] border border-white/[0.06] bg-white/[0.03] p-4">
            <p className="text-base font-semibold text-white">{groupName}</p>
            <p className="mt-2 break-all text-xs text-slate-400">{labels.invitationCode.replace('{code}', inviteCode)}</p>
            {inviteSchedules.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{labels.groupSchedule}</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-400">
                  {inviteSchedules.map((schedule, index) => (
                    <li key={`${schedule.weekday}-${schedule.start_time}-${index}`}>
                      {schedule.weekday} · {schedule.start_time}–{schedule.end_time}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">{labels.noSchedule}</p>
            )}
          </div>

          {scheduleConflicts.length > 0 ? (
            <div className="mt-4 rounded-[12px] border border-amber-400/20 bg-amber-400/[0.08] p-4">
              <p className="text-sm font-semibold text-amber-300">{labels.conflictTitle}</p>
              <p className="mt-2 text-sm leading-6 text-amber-100/80">{labels.conflictDescription}</p>
              <ul className="mt-3 space-y-1 text-xs text-amber-100/75">
                {scheduleConflicts.slice(0, 4).map((conflict, index) => (
                  <li key={`${conflict.groupName}-${conflict.weekday}-${index}`}>
                    {conflict.groupName} · {conflict.weekday} · {conflict.startTime}–{conflict.endTime}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs font-medium text-amber-200">{labels.conflictNote}</p>
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <form action={declineAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="inviteId" value={inviteId} />
              <input type="hidden" name="intent" value="decline" />
              <input type="hidden" name="redirectTo" value={`/${locale}/dashboard`} />
              <button
                type="submit"
                className="h-11 w-full rounded-[8px] border border-white/10 bg-transparent px-4 text-sm font-semibold text-white transition hover:bg-white/[0.04]"
              >
                {labels.decline}
              </button>
            </form>

            <form action={completeAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="inviteId" value={inviteId} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <input type="hidden" name="examSession" value={examSession} />
              <input type="hidden" name="language" value={selectedLanguage} />
              <input type="hidden" name="timezone" value={timezone} />
              <input type="hidden" name="availabilityGrid" value={JSON.stringify(setScheduleNow ? grid : DEFAULT_AVAILABILITY_GRID)} />
              {[...selectedBanks].map((bank) => (
                <input key={bank} type="hidden" name="questionBanks" value={bank} />
              ))}
              <button type="submit" className="button-primary h-11 w-full rounded-[8px] px-4 text-sm">
                {labels.joinGroup}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
