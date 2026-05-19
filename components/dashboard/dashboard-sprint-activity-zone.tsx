'use client';

import { memo, useMemo } from 'react';
import { Share2 } from 'lucide-react';

type HeatmapDay = {
  date: string;
  count: number;
  intensity?: 0 | 1 | 2 | 3 | 4;
};

export type DashboardSprintActivityZoneProps = {
  answeredCount: number;
  completedSessionsCount: number;
  trueMastery: number | null;
  heatmap: HeatmapDay[];
  labels: {
    title: string;
    counter: string;
    sprint: string;
    week: string;
    questionsAnswered: string;
    sessionsCompleted: string;
    trueMastery: string;
    consistencyStreak: string;
    heatmapTitle: string;
    heatmapDescription: string;
    heatmapLow: string;
    heatmapMedium: string;
    heatmapHigh: string;
    days: string;
    noData: string;
    weekdays: string[];
    monthLabels: string[];
  };
};

const SPRINT_QUESTION_GOAL = 100;
const SPRINT_TOTAL_WEEKS = 4;
const HEATMAP_WEEK_COUNT = 28;

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfUtcWeek(date: Date) {
  const next = new Date(date);
  const weekday = next.getUTCDay();
  const mondayOffset = weekday === 0 ? 6 : weekday - 1;
  next.setUTCDate(next.getUTCDate() - mondayOffset);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function buildHeatmapWeeks(heatmap: HeatmapDay[]) {
  const heatmapByDate = new Map(heatmap.map((day) => [day.date, day]));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const chartEnd = addUtcDays(startOfUtcWeek(today), 6);
  const chartStart = addUtcDays(chartEnd, -(HEATMAP_WEEK_COUNT * 7 - 1));
  const days = Array.from({ length: HEATMAP_WEEK_COUNT * 7 }, (_, index) => {
    const date = addUtcDays(chartStart, index);
    const dateKey = toIsoDate(date);
    const source = heatmapByDate.get(dateKey);
    return {
      date: dateKey,
      count: source?.count ?? 0,
      intensity: source?.intensity ?? 0,
    };
  });
  const weeks: Array<
    Array<{ date: string; count: number; intensity: 0 | 1 | 2 | 3 | 4 }>
  > = [];

  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return weeks;
}

function buildHeatmapMonthMarkers(
  weeks: Array<
    Array<{ date: string; count: number; intensity: 0 | 1 | 2 | 3 | 4 }>
  >,
  monthLabels: string[],
) {
  let previousMonth = -1;

  return weeks.map((week, index) => {
    const firstDay = week[0];
    const monthIndex = firstDay ? new Date(firstDay.date).getUTCMonth() : -1;
    const shouldLabel = index === 0 || monthIndex !== previousMonth;
    previousMonth = monthIndex;

    return shouldLabel && monthIndex >= 0
      ? (monthLabels[monthIndex] ?? '')
      : '';
  });
}

function getHeatmapCellClass(intensity: HeatmapDay['intensity']) {
  if (!intensity) {
    return 'bg-[#13322d]';
  }

  if (intensity >= 4) {
    return 'bg-[#3FF0BB] shadow-[0_0_8px_rgba(32,217,163,0.4)]';
  }

  if (intensity >= 3) {
    return 'bg-[#20D9A3]';
  }

  if (intensity >= 2) {
    return 'bg-[#20D9A3]/55';
  }

  return 'bg-[#20D9A3]/30';
}

function getSprintState(answeredCount: number) {
  const sprintNumber = Math.floor(answeredCount / SPRINT_QUESTION_GOAL) + 1;
  const currentSprintAnswered = answeredCount % SPRINT_QUESTION_GOAL;
  const currentWeek = Math.min(
    SPRINT_TOTAL_WEEKS,
    Math.max(
      1,
      Math.ceil(
        (currentSprintAnswered ||
          (answeredCount > 0 ? SPRINT_QUESTION_GOAL : 1)) /
          (SPRINT_QUESTION_GOAL / SPRINT_TOTAL_WEEKS),
      ),
    ),
  );

  return {
    sprintNumber,
    currentWeek,
    totalWeeks: SPRINT_TOTAL_WEEKS,
  };
}

function formatCounter(
  template: string,
  values: { sprint: number; week: number; totalWeeks: number },
) {
  return template
    .replace('{sprint}', String(values.sprint))
    .replace('{week}', String(values.week))
    .replace('{totalWeeks}', String(values.totalWeeks));
}

export const DashboardSprintActivityZone = memo(
  function DashboardSprintActivityZone({
    answeredCount,
    completedSessionsCount,
    heatmap,
    labels,
  }: DashboardSprintActivityZoneProps) {
    const sprint = useMemo(
      () => getSprintState(answeredCount),
      [answeredCount],
    );
    const heatmapWeeks = useMemo(() => buildHeatmapWeeks(heatmap), [heatmap]);
    const heatmapMonthMarkers = useMemo(
      () => buildHeatmapMonthMarkers(heatmapWeeks, labels.monthLabels),
      [heatmapWeeks, labels.monthLabels],
    );
    const displayedWeekdays = labels.weekdays.slice(0, 7);
    const cards = [
      {
        key: 'answered',
        label: labels.questionsAnswered,
        value: answeredCount,
        accent: 'text-brand',
      },
      {
        key: 'sessions',
        label: labels.sessionsCompleted,
        value: completedSessionsCount,
        accent: 'text-brand',
      },
    ];

    return (
      <section className="v11-card px-5 py-6 sm:px-8 sm:py-8">
        <div className="mb-9 flex items-start justify-between gap-4">
          <div>
            <p className="v11-card-title">{labels.title}</p>
            <h1 className="sr-only">
              {formatCounter(labels.counter, {
                sprint: sprint.sprintNumber,
                week: sprint.currentWeek,
                totalWeeks: sprint.totalWeeks,
              })}
            </h1>
          </div>
          <button
            type="button"
            className="hidden h-[66px] w-[66px] items-center justify-center rounded-[18px] border border-white/[0.045] bg-white/[0.025] text-[#8fa7a2] transition hover:border-white/[0.09] hover:bg-white/[0.04] hover:text-[#e8f4f0] sm:inline-flex"
            aria-label={labels.title}
          >
            <Share2 className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-10 xl:grid-cols-[500px_minmax(0,1fr)] xl:items-end">
          <div className="flex max-w-[500px] items-end">
            {cards.map((card, index) => {
              return (
                <article
                  key={card.key}
                  className={`flex min-w-0 flex-1 flex-col gap-[22px] ${
                    index > 0
                      ? 'border-l border-white/[0.045] pl-8 sm:pl-10'
                      : 'pr-8 sm:pr-10'
                  }`}
                >
                  <p
                    className={`text-[58px] font-semibold leading-none tracking-[-0.045em] sm:text-[72px] lg:text-[82px] ${card.accent}`}
                  >
                    {card.value}
                  </p>
                  <p className="max-w-[120px] text-[18px] font-normal leading-[1.35] text-[#8fa7a2]">
                    {card.label}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="min-w-0 flex-1">
            <div className="overflow-x-auto pb-1 xl:overflow-visible">
              <div className="min-w-[752px] xl:min-w-0">
                <div className="ml-[34px] grid grid-cols-[repeat(28,18px)] gap-[8px] text-[16px] font-normal leading-5 text-[#8fa7a2]">
                  {heatmapMonthMarkers.map((label, index) => (
                    <span key={`${label}-${index}`} className="h-6">
                      {label}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-start gap-[10px]">
                  <div className="flex w-6 flex-col gap-[8px] text-[14px] leading-[18px] text-[#6f8984]">
                    {displayedWeekdays.map((weekday, index) => (
                      <span key={`${weekday}-${index}`} className="h-[18px]">
                        {weekday}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-flow-col grid-rows-7 gap-[8px]">
                    {heatmapWeeks.map((week, weekIndex) =>
                      week.map((day) => (
                        <div
                          key={`${weekIndex}-${day.date}`}
                          className={`h-[18px] w-[18px] rounded-[5px] ${getHeatmapCellClass(day.intensity)}`}
                          title={`${day.date} - ${day.count}`}
                        />
                      )),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  },
);
