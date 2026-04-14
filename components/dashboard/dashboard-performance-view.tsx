import { AlertIcon, SparkIcon, TargetIcon } from '@/components/ui/dashboard-icons';
import { Share2 } from 'lucide-react';

type HeatmapDay = {
  date: string;
  count: number;
  intensity: 0 | 1 | 2 | 3 | 4;
};

type DashboardPerformanceViewProps = {
  answeredCount: number;
  completedSessionsCount: number;
  successRate: number | null;
  errorRate: number | null;
  averageConfidence: 'low' | 'medium' | 'high' | null;
  heatmap: HeatmapDay[];
  labels: {
    sprintActivityTitle: string;
    questionsAnswered: string;
    sessionsFinished: string;
    heatmapAvailableAfterSessions: string;
    certaintyTitle: string;
    confidenceLow: string;
    confidenceMedium: string;
    confidenceHigh: string;
    confidenceAfterNextSession: string;
    errorTitle: string;
    errorAfterThreeSessions: string;
    noData: string;
    weekdays: string[];
    monthLabels: string[];
    none: string;
    less: string;
    more: string;
    averagePerWeek: string;
    completion: string;
    share: string;
  };
};

function getHeatmapCellClass(intensity: HeatmapDay['intensity']) {
  switch (intensity) {
    case 4:
      return 'bg-brand';
    case 3:
      return 'bg-emerald-400/80';
    case 2:
      return 'bg-emerald-400/55';
    case 1:
      return 'bg-emerald-400/25';
    default:
      return 'bg-[#1f2b3d]';
  }
}

function parseIsoDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

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

export function DashboardPerformanceView({
  answeredCount,
  completedSessionsCount,
  successRate,
  errorRate,
  averageConfidence,
  heatmap,
  labels,
}: DashboardPerformanceViewProps) {
  const heatmapByDate = new Map(heatmap.map((day) => [day.date, day]));
  const latestHeatmapDay = heatmap.at(-1)?.date;
  const latestDate = latestHeatmapDay ? parseIsoDate(latestHeatmapDay) : new Date();
  latestDate.setUTCHours(0, 0, 0, 0);
  const weekCount = 17;
  const chartEnd = addUtcDays(startOfUtcWeek(latestDate), 6);
  const chartStart = addUtcDays(chartEnd, -(weekCount * 7 - 1));
  const chartDays = Array.from({ length: weekCount * 7 }, (_, index) => {
    const date = addUtcDays(chartStart, index);
    const dateKey = toIsoDate(date);
    const source = heatmapByDate.get(dateKey);
    return {
      date: dateKey,
      count: source?.count ?? 0,
      intensity: source?.intensity ?? 0,
      isFuture: date.getTime() > latestDate.getTime(),
    };
  });
  const weeks: Array<Array<HeatmapDay & { isFuture: boolean }>> = [];
  for (let index = 0; index < chartDays.length; index += 7) {
    weeks.push(chartDays.slice(index, index + 7));
  }
  const monthMarkers = weeks.map((week, weekIndex) => {
    const firstOfMonth = week.find((day) => parseIsoDate(day.date).getUTCDate() === 1);
    if (!firstOfMonth && weekIndex !== 0) return '';
    const markerDate = firstOfMonth ? parseIsoDate(firstOfMonth.date) : week[0] ? parseIsoDate(week[0].date) : null;
    if (!markerDate) return '';
    return labels.monthLabels[markerDate.getUTCMonth()] ?? '';
  });
  const averagePerWeek = Math.round(answeredCount / Math.max(1, weekCount));
  const completion = answeredCount > 0 ? Math.round((completedSessionsCount / Math.max(1, completedSessionsCount)) * 100) : 0;
  const confidenceLabel =
    averageConfidence === 'low'
      ? labels.confidenceLow
      : averageConfidence === 'medium'
        ? labels.confidenceMedium
        : averageConfidence === 'high'
          ? labels.confidenceHigh
          : labels.noData;

  return (
    <>
      <section className="surface-mockup p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <SparkIcon className="h-4 w-4" />
            <p className="text-sm font-bold text-white">{labels.sprintActivityTitle}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-extrabold leading-none text-white">{answeredCount}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{labels.questionsAnswered}</p>
          </div>
        </div>

        <div className="mt-2 text-xs font-semibold text-slate-600">
          <span>-</span>
          <span className="mx-2">-</span>
          <span>FRANÇAIS</span>
          <span className="mx-2">·</span>
          <span>GMT+1</span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_250px]">
          <div className="min-w-0 overflow-x-auto pb-1">
            <div className="min-w-[360px]">
            <div className="ml-7 grid gap-[3px] text-[10px] font-semibold text-slate-600" style={{ gridTemplateColumns: `repeat(${weekCount}, 9px)` }}>
              {monthMarkers.map((month, index) => (
                <span key={`${month}-${index}`} className="whitespace-nowrap">
                  {month}
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <div className="grid grid-rows-7 gap-[3px] pt-[2px] text-[9px] font-semibold leading-[10px] text-slate-600">
                {labels.weekdays.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div className="flex gap-[3px]">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="grid grid-rows-7 gap-[3px]">
                    {Array.from({ length: 7 }).map((_, dayIndex) => {
                      const day = week[dayIndex];
                      return (
                        <div
                          key={`${weekIndex}-${dayIndex}`}
                          className={`h-[9px] w-[9px] rounded-[2px] ${day && !day.isFuture ? getHeatmapCellClass(day.intensity) : 'bg-transparent'}`}
                          title={day ? `${day.date} - ${day.count}` : undefined}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            </div>
          </div>

          <aside className="border-white/[0.06] md:border-l md:pl-4">
            <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <span>{labels.none}</span>
              <span className="h-2 w-2 rounded-[2px] bg-[#1f2b3d]" />
              <span>{labels.less}</span>
              <span className="h-2 w-2 rounded-[2px] bg-emerald-400/25" />
              <span className="h-2 w-2 rounded-[2px] bg-brand" />
              <span>{labels.more}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-2 text-sm">
              <span className="font-semibold text-slate-500">{labels.averagePerWeek}</span>
              <span className="font-extrabold text-white">{averagePerWeek}</span>
              <span className="font-semibold text-slate-500">{labels.completion}</span>
              <span className="font-extrabold text-white">{completion}%</span>
            </div>
          </aside>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-brand"
            aria-label={labels.share}
          >
            <Share2 className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
          </button>
        </div>
      </section>

      <section className="surface-mockup p-5">
        <div className="flex items-center gap-2">
          <TargetIcon className="h-4 w-4" />
          <p className="text-sm font-bold text-white">{labels.certaintyTitle}</p>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          {successRate !== null ? `${successRate}% - ${confidenceLabel}` : labels.confidenceAfterNextSession}
        </p>
      </section>

      <section className="surface-mockup p-5">
        <div className="flex items-center gap-2">
          <AlertIcon className="h-4 w-4" />
          <p className="text-sm font-bold text-white">{labels.errorTitle}</p>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          {errorRate !== null ? `${errorRate}%` : labels.errorAfterThreeSessions}
        </p>
      </section>
    </>
  );
}
