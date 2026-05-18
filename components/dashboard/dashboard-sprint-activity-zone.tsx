'use client';

import { memo, useMemo } from 'react';
import { Activity, BarChart3, CheckCircle2, Flame } from 'lucide-react';

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

function getHeatmapCellClass(intensity: HeatmapDay['intensity']) {
  if (!intensity) {
    return 'bg-[#12312b]';
  }

  if (intensity >= 4) {
    return 'bg-brand shadow-[0_0_10px_rgba(32,217,163,0.32)]';
  }

  if (intensity >= 3) {
    return 'bg-emerald-400/65';
  }

  return 'bg-emerald-400/30';
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
    const cards = [
      {
        key: 'answered',
        label: labels.questionsAnswered,
        value: answeredCount,
        accent: 'text-brand',
        icon: Activity,
      },
      {
        key: 'sessions',
        label: labels.sessionsCompleted,
        value: completedSessionsCount,
        accent: 'text-white',
        icon: CheckCircle2,
      },
      {
        key: 'mastery',
        label: labels.trueMastery,
        value: trueMastery === null ? labels.noData : `${trueMastery}%`,
        accent: 'text-emerald-200',
        icon: BarChart3,
      },
      {
        key: 'streak',
        label: labels.consistencyStreak,
        value: `${consistencyStreak} ${labels.days}`,
        accent: 'text-amber-200',
        icon: Flame,
      },
    ];

    return (
      <section className="surface-mockup p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-300">
              {labels.title}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {formatCounter(labels.counter, {
                sprint: sprint.sprintNumber,
                week: sprint.currentWeek,
                totalWeeks: sprint.totalWeeks,
              })}
            </h1>
          </div>
          <div className="border-brand/30 bg-brand/10 inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold text-emerald-200">
            {labels.sprint} {sprint.sprintNumber} {' - '} {labels.week}{' '}
            {sprint.currentWeek} / {sprint.totalWeeks}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.key}
                className="rounded-[12px] border border-white/[0.06] bg-white/[0.03] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-500">
                    {card.label}
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/[0.06] bg-white/[0.035] text-slate-400">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <p
                  className={`mt-4 text-3xl font-semibold tracking-tight ${card.accent}`}
                >
                  {card.value}
                </p>
              </article>
            );
          })}
        </div>

        <div className="mt-5 rounded-[14px] border border-white/[0.06] bg-white/[0.025] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">
                {labels.heatmapTitle}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {labels.heatmapDescription}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-emerald-400/30" />
                {labels.heatmapLow}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-emerald-400/65" />
                {labels.heatmapMedium}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-brand" />
                {labels.heatmapHigh}
              </span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto pb-1">
            <div className="grid w-full min-w-[560px] grid-flow-col grid-rows-7 gap-[4px]">
              {heatmapWeeks.map((week, weekIndex) =>
                week.map((day) => (
                  <div
                    key={`${weekIndex}-${day.date}`}
                    className={`h-3 min-h-3 w-full rounded-[3px] ${getHeatmapCellClass(day.intensity)}`}
                    title={`${day.date} - ${day.count}`}
                  />
                )),
              )}
            </div>
          </div>
        </div>
      </section>
    );
  },
);
