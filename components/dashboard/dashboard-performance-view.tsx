type HeatmapDay = {
  date: string;
  count: number;
  intensity: 0 | 1 | 2 | 3 | 4;
};

type ConfidenceCalibrationItem = {
  confidence: 'low' | 'medium' | 'high';
  total: number;
  accuracy: number;
};

type SessionConfidenceBreakdownItem = {
  sessionId: string;
  sessionName: string;
  scheduledAt: string;
  low: number;
  medium: number;
  high: number;
};

type DashboardPerformanceViewProps = {
  answeredCount: number;
  completedSessionsCount: number;
  successRate: number | null;
  averageConfidence: 'low' | 'medium' | 'high' | null;
  heatmap: HeatmapDay[];
  confidenceCalibration: ConfidenceCalibrationItem[];
  sessionConfidenceBreakdown: SessionConfidenceBreakdownItem[];
  labels: {
    sprintActivityTitle: string;
    questionsAnswered: string;
    heatmapAvailableAfterSessions: string;
    certaintyTitle: string;
    confidenceLow: string;
    confidenceMedium: string;
    confidenceHigh: string;
    confidenceAfterNextSession: string;
    noData: string;
    weekdays: string[];
    monthLabels: string[];
    none: string;
    less: string;
    more: string;
    sessionsFinished: string;
    averagePerWeek: string;
    completion: string;
    confidenceCalibrationTitle: string;
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
  heatmap,
  confidenceCalibration,
  sessionConfidenceBreakdown,
  labels,
}: DashboardPerformanceViewProps) {
  const heatmapByDate = new Map(heatmap.map((day) => [day.date, day]));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const weekCount = 28;
  const chartEnd = addUtcDays(startOfUtcWeek(today), 6);
  const chartStart = addUtcDays(chartEnd, -(weekCount * 7 - 1));
  const chartDays = Array.from({ length: weekCount * 7 }, (_, index) => {
    const date = addUtcDays(chartStart, index);
    const dateKey = toIsoDate(date);
    const source = heatmapByDate.get(dateKey);
    return {
      date: dateKey,
      count: source?.count ?? 0,
      intensity: source?.intensity ?? 0,
    };
  });
  const weeks: HeatmapDay[][] = [];
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
  return (
    <>
      <section className="surface-mockup p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-300">{labels.sprintActivityTitle}</p>
            <p className="mt-2 text-2xl font-extrabold text-white">
              {answeredCount}
              <span className="ml-2 text-sm font-bold text-slate-500">{labels.questionsAnswered}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[42px] font-extrabold leading-none text-brand">{completedSessionsCount}</p>
            <p className="mt-2 text-sm font-semibold text-slate-500">{labels.sessionsFinished}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0 pb-1">
            <div className="grid grid-cols-[18px_minmax(0,1fr)] gap-2">
              <div />
              <div
                className="grid gap-[2px] overflow-visible text-[8px] font-semibold text-slate-600 sm:gap-[3px] sm:text-[9px] md:text-[10px]"
                style={{ gridTemplateColumns: `repeat(${weekCount}, minmax(0, 1fr))` }}
              >
                {monthMarkers.map((month, index) => (
                  <span key={`${month}-${index}`} className="whitespace-nowrap leading-none">
                    {month}
                  </span>
                ))}
              </div>

              <div className="grid grid-rows-7 gap-[2px] pt-[2px] text-[8px] font-semibold leading-none text-slate-600 sm:gap-[3px] sm:text-[9px]">
                {labels.weekdays.map((label) => (
                  <span key={label} className="flex items-center">
                    {label}
                  </span>
                ))}
              </div>
              <div className="flex min-w-0 gap-[2px] sm:gap-[3px]">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="grid min-w-0 flex-1 grid-rows-7 gap-[2px] sm:gap-[3px]">
                    {Array.from({ length: 7 }).map((_, dayIndex) => {
                      const day = week[dayIndex];
                      return (
                        <div
                          key={`${weekIndex}-${dayIndex}`}
                          className={`aspect-square w-full rounded-[2px] ${day ? getHeatmapCellClass(day.intensity) : 'bg-[#1f2b3d]'}`}
                          title={day ? `${day.date} - ${day.count}` : undefined}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="border-white/[0.06] md:border-l md:pl-4">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
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
              <span className="font-extrabold text-white">{successRate !== null ? `${successRate}%` : labels.noData}</span>
            </div>
          </aside>
        </div>
      </section>

      <section className="surface-mockup p-5">
        <p className="text-sm font-bold text-white">{labels.certaintyTitle}</p>
        {sessionConfidenceBreakdown.length > 0 ? (
          <div className="mt-4 space-y-3">
            {sessionConfidenceBreakdown.map((item) => (
              <div key={item.sessionId} className="rounded-[10px] border border-white/[0.05] bg-white/[0.03] px-4 py-3">
                <p className="text-sm font-bold text-white">{item.sessionName}</p>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-[8px] bg-white/[0.03] px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">L</p>
                    <p className="mt-1 text-base font-extrabold text-white">{item.low}</p>
                  </div>
                  <div className="rounded-[8px] bg-white/[0.03] px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">M</p>
                    <p className="mt-1 text-base font-extrabold text-white">{item.medium}</p>
                  </div>
                  <div className="rounded-[8px] bg-white/[0.03] px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">H</p>
                    <p className="mt-1 text-base font-extrabold text-white">{item.high}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : confidenceCalibration.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {confidenceCalibration.map((item) => (
              <div key={item.confidence} className="rounded-[10px] bg-white/[0.035] px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  {item.confidence === 'low' ? labels.confidenceLow : item.confidence === 'medium' ? labels.confidenceMedium : labels.confidenceHigh}
                </p>
                <p className="mt-2 text-lg font-extrabold text-white">{item.total > 0 ? `${item.accuracy}%` : labels.noData}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{item.total} answers</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}
