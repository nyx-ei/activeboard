'use client';

import { memo, useMemo } from 'react';

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

function getConsistencyStreak(heatmap: HeatmapDay[]) {
  const activeDates = new Set(
    heatmap.filter((day) => day.count > 0).map((day) => day.date),
  );

  if (activeDates.size === 0) {
    return 0;
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let cursor = today;

  if (!activeDates.has(toIsoDate(cursor))) {
    cursor = addUtcDays(cursor, -1);
  }

  let streak = 0;
  while (activeDates.has(toIsoDate(cursor))) {
    streak += 1;
    cursor = addUtcDays(cursor, -1);
  }

  return streak;
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
    trueMastery,
    heatmap,
    labels,
  }: DashboardSprintActivityZoneProps) {
    const sprint = useMemo(
      () => getSprintState(answeredCount),
      [answeredCount],
    );
    const consistencyStreak = useMemo(
      () => getConsistencyStreak(heatmap),
      [heatmap],
    );
    const heatmapWeeks = useMemo(() => buildHeatmapWeeks(heatmap), [heatmap]);
    const heatmapMonthMarkers = useMemo(
      () => buildHeatmapMonthMarkers(heatmapWeeks, labels.monthLabels),
      [heatmapWeeks, labels.monthLabels],
    );
    const displayedWeekdays = [
      labels.weekdays[0],
      labels.weekdays[2],
      labels.weekdays[4],
    ];
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
        accent: 'text-white',
      },
      {
        key: 'mastery',
        label: labels.trueMastery,
        value: trueMastery === null ? labels.noData : `${trueMastery}%`,
        accent: 'text-emerald-200',
      },
      {
        key: 'streak',
        label: labels.consistencyStreak,
        value: `${consistencyStreak} ${labels.days}`,
        accent: 'text-amber-200',
      },
    ];

    return (
      <section className="v11-card">
        <div className="v11-card-head">
          <div>
            <p className="v11-card-title">{labels.title}</p>
            <h1 className="mt-1 text-[13px] font-normal text-[#8fa7a2]">
              {formatCounter(labels.counter, {
                sprint: sprint.sprintNumber,
                week: sprint.currentWeek,
                totalWeeks: sprint.totalWeeks,
              })}
            </h1>
          </div>
          <div className="v11-chip v11-chip-mint">
            {labels.sprint} {sprint.sprintNumber} {' - '} {labels.week}{' '}
            {sprint.currentWeek} / {sprint.totalWeeks}
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="grid shrink-0 gap-4 sm:grid-cols-2 lg:flex lg:items-stretch lg:gap-0">
            {cards.map((card, index) => {
              return (
                <article
                  key={card.key}
                  className={`flex min-w-0 flex-col gap-[14px] px-0 lg:min-w-[132px] lg:px-5 xl:min-w-[150px] ${
                    index > 0 ? 'lg:border-l lg:border-white/[0.045]' : ''
                  }`}
                >
                  <p
                    className={`text-[42px] font-medium leading-none tracking-[-0.04em] lg:text-[48px] xl:text-[60px] ${card.accent}`}
                  >
                    {card.value}
                  </p>
                  <p className="text-[14px] font-normal leading-[1.35] text-[#8fa7a2]">
                    {card.label}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-[240px]">
                <p className="text-[13px] font-medium text-[#8fa7a2]">
                  {labels.heatmapTitle}
                </p>
                <p className="mt-2 text-[12px] leading-5 text-[#5c7773]">
                  {labels.heatmapDescription}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[12px] font-medium text-[#8fa7a2]">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-[#20D9A3]/30" />
                  {labels.heatmapLow}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-[#20D9A3]/60" />
                  {labels.heatmapMedium}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-[#20D9A3]" />
                  {labels.heatmapHigh}
                </span>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto pb-1">
              <div className="min-w-[616px]">
                <div className="ml-[22px] grid grid-cols-[repeat(28,12px)] gap-[4px] text-[12px] font-normal text-[#8fa7a2]">
                  {heatmapMonthMarkers.map((label, index) => (
                    <span key={`${label}-${index}`} className="h-4">
                      {label}
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex items-start gap-[6px]">
                  <div className="flex w-4 flex-col gap-[4px] pt-[16px] text-[10px] leading-3 text-[#5c7773]">
                    <span className="h-3">{displayedWeekdays[0]}</span>
                    <span className="h-3" />
                    <span className="h-3">{displayedWeekdays[1]}</span>
                    <span className="h-3" />
                    <span className="h-3">{displayedWeekdays[2]}</span>
                    <span className="h-3" />
                    <span className="h-3" />
                  </div>
                  <div className="grid grid-flow-col grid-rows-7 gap-[4px]">
                    {heatmapWeeks.map((week, weekIndex) =>
                      week.map((day) => (
                        <div
                          key={`${weekIndex}-${day.date}`}
                          className={`h-3 w-3 rounded-[3px] ${getHeatmapCellClass(day.intensity)}`}
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
