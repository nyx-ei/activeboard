'use client';

import { Fragment, useMemo, useState } from 'react';

import { SubmitButton } from '@/components/ui/submit-button';
import {
  AVAILABILITY_HOURS,
  AVAILABILITY_WEEKDAYS,
  DEFAULT_AVAILABILITY_GRID,
  type AvailabilityGrid,
  type AvailabilityWeekday,
} from '@/lib/schedule/availability';

type UserScheduleFormProps = {
  action: (formData: FormData) => void;
  locale: string;
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

const FALLBACK_TIMEZONES = ['UTC', 'Africa/Lagos', 'America/Toronto', 'America/Montreal', 'Europe/Paris'];

function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function UserScheduleForm({
  action,
  locale,
  labels,
  initialTimezone,
  initialGrid,
}: UserScheduleFormProps) {
  const [timezone, setTimezone] = useState(initialTimezone || 'UTC');
  const [grid, setGrid] = useState<AvailabilityGrid>(initialGrid ?? DEFAULT_AVAILABILITY_GRID);

  const timezoneOptions = useMemo(() => {
    if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
      try {
        return Intl.supportedValuesOf('timeZone');
      } catch {
        return FALLBACK_TIMEZONES;
      }
    }

    return FALLBACK_TIMEZONES;
  }, []);

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
    <form action={action} className="surface p-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="availabilityGrid" value={JSON.stringify(grid)} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-white">{labels.title}</h2>
          <p className="mt-1 text-sm text-slate-400">{labels.description}</p>
        </div>
        <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">
          {labels.slotsCount.replace('{count}', String(slotCount))}
        </span>
      </div>

      <div className="mt-5">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">{labels.timezone}</span>
          <select name="timezone" className="field" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            {timezoneOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[120px_repeat(17,minmax(44px,1fr))] gap-2">
            <div />
            {AVAILABILITY_HOURS.map((hour) => (
              <div key={hour} className="text-center text-xs font-semibold text-slate-500">
                {formatHourLabel(hour)}
              </div>
            ))}
            {AVAILABILITY_WEEKDAYS.map((weekday) => (
              <Fragment key={weekday}>
                <div key={`${weekday}-label`} className="flex items-center text-sm font-semibold text-white">
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
                        'h-11 rounded-[12px] border text-xs font-semibold transition',
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

      {slotCount === 0 ? <p className="mt-4 text-sm text-slate-500">{labels.empty}</p> : null}

      <div className="mt-5">
        <SubmitButton pendingLabel={labels.savePending} className="button-primary w-full sm:w-auto">
          {labels.save}
        </SubmitButton>
      </div>
    </form>
  );
}
