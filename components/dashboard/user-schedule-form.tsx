'use client';

import { Fragment, useMemo, useState } from 'react';

import { SubmitButton } from '@/components/ui/submit-button';
import {
  AVAILABILITY_HOURS as BASE_AVAILABILITY_HOURS,
  AVAILABILITY_WEEKDAYS as BASE_AVAILABILITY_WEEKDAYS,
  DEFAULT_AVAILABILITY_GRID,
  type AvailabilityGrid,
  type AvailabilityWeekday,
} from '@/lib/schedule/availability';

export const AVAILABILITY_HOURS = BASE_AVAILABILITY_HOURS;
export const AVAILABILITY_WEEKDAYS = BASE_AVAILABILITY_WEEKDAYS;

type UserScheduleFormProps = {
  action: (formData: FormData) => void;
  locale: string;
  compact?: boolean;
  labels: {
    title: string;
    description: string;
    timezone: string;
    save: string;
    savePending: string;
    empty: string;
    slotsCount: string;
    weekdays: Record<AvailabilityWeekday, string>;
  };
  initialTimezone: string;
  initialGrid: AvailabilityGrid;
};

export const CURATED_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'America/Halifax',
  'America/St_Johns',
  'Europe/London',
  'Europe/Paris',
  'Europe/Brussels',
  'Europe/Amsterdam',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Zurich',
  'Europe/Vienna',
  'Europe/Stockholm',
  'Europe/Copenhagen',
  'Europe/Oslo',
  'Europe/Helsinki',
  'Europe/Warsaw',
  'Europe/Prague',
  'Europe/Lisbon',
];

function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function UserScheduleForm({
  action,
  locale,
  compact = false,
  labels,
  initialTimezone,
  initialGrid,
}: UserScheduleFormProps) {
  const [timezone, setTimezone] = useState(initialTimezone || 'UTC');
  const [grid, setGrid] = useState<AvailabilityGrid>(initialGrid ?? DEFAULT_AVAILABILITY_GRID);

  const timezoneOptions = useMemo(() => {
    if (initialTimezone && !CURATED_TIMEZONES.includes(initialTimezone)) {
      return [initialTimezone, ...CURATED_TIMEZONES];
    }

    return CURATED_TIMEZONES;
  }, [initialTimezone]);

  const slotCount = AVAILABILITY_WEEKDAYS.reduce((sum, weekday) => sum + grid[weekday].length, 0);

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

  return (
    <form action={action} className={compact ? 'surface-mockup p-4' : 'surface p-5'}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="availabilityGrid" value={JSON.stringify(grid)} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className={compact ? 'text-sm font-bold text-white' : 'text-base font-bold text-white'}>
            {labels.title}
          </h2>
          {compact ? null : <p className="mt-1 text-sm text-slate-400">{labels.description}</p>}
        </div>
        <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
          {labels.slotsCount.replace('{count}', String(slotCount))}
        </span>
      </div>

      <div className={compact ? 'mt-3' : 'mt-5'}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">{labels.timezone}</span>
          <select
            name="timezone"
            className={compact ? 'field h-10 rounded-[8px] px-3 py-2 text-sm' : 'field'}
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          >
            {timezoneOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={compact ? 'mt-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'mt-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'}>
        <div className="w-max min-w-full">
          <div
            className={
              compact
                ? 'grid grid-cols-[72px_repeat(17,28px)] gap-1.5'
                : 'grid grid-cols-[96px_repeat(17,36px)] gap-2'
            }
          >
            <div />
            {AVAILABILITY_HOURS.map((hour) => (
              <div key={hour} className="text-center text-[10px] font-semibold text-slate-500">
                {formatHourLabel(hour)}
              </div>
            ))}
            {AVAILABILITY_WEEKDAYS.map((weekday) => (
              <Fragment key={weekday}>
                <div
                  key={`${weekday}-label`}
                  className={compact ? 'flex items-center text-xs font-semibold text-white' : 'flex items-center text-sm font-semibold text-white'}
                >
                  {labels.weekdays[weekday]}
                </div>
                {AVAILABILITY_HOURS.map((hour) => {
                  const isActive = grid[weekday].includes(hour);
                  return (
                    <button
                      key={`${weekday}-${hour}`}
                      type="button"
                      onClick={() => toggleSlot(weekday, hour)}
                      className={[
                        compact
                          ? 'h-8 rounded-[8px] border text-[10px] font-semibold transition'
                          : 'h-11 rounded-[12px] border text-xs font-semibold transition',
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
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {slotCount === 0 ? <p className="mt-3 text-xs text-slate-500">{labels.empty}</p> : null}

      <div className={compact ? 'mt-4' : 'mt-5'}>
        <SubmitButton pendingLabel={labels.savePending} className={compact ? 'button-primary w-full rounded-[8px] py-2.5 text-sm' : 'button-primary w-full sm:w-auto'}>
          {labels.save}
        </SubmitButton>
      </div>
    </form>
  );
}
