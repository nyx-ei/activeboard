type HeatmapDay = {
  date: string;
  count: number;
  intensity: 0 | 1 | 2 | 3 | 4;
};

type TrialProgress = {
  current: number;
  total: number;
  remaining: number;
  showWarning: boolean;
  isComplete: boolean;
};

type CategoryAccuracyItem = {
  category: string;
  total: number;
  accuracy: number;
};

type BlueprintGridCell = {
  physicianActivity: string;
  dimensionOfCare: string;
  total: number;
  accuracy: number | null;
};

type ConfidenceCalibrationItem = {
  confidence: 'low' | 'medium' | 'high';
  total: number;
  accuracy: number;
};

type ErrorTypeBreakdownItem = {
  errorType: string;
  count: number;
};

type TrendPoint = {
  label: string;
  total: number;
  accuracy: number | null;
};

type DashboardPerformanceViewProps = {
  answeredCount: number;
  completedSessionsCount: number;
  successRate: number | null;
  errorRate: number | null;
  averageConfidence: 'low' | 'medium' | 'high' | null;
  trialProgress: TrialProgress;
  heatmap: HeatmapDay[];
  physicianActivityAccuracy: CategoryAccuracyItem[];
  dimensionOfCareAccuracy: CategoryAccuracyItem[];
  blueprintGrid: BlueprintGridCell[];
  confidenceCalibration: ConfidenceCalibrationItem[];
  errorTypeBreakdown: ErrorTypeBreakdownItem[];
  weeklyTrend: TrendPoint[];
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
    trialProgressTitle: string;
    trialProgressSummary: string;
    trialProgressDescription: string;
    trialProgressWarning: string;
    trialProgressComplete: string;
    trendTitle: string;
    trendDescription: string;
    trendAccuracyValue: string;
    trendEmpty: string;
    physicianActivityTitle: string;
    dimensionOfCareTitle: string;
    accuracyValue: string;
    confidenceCalibrationTitle: string;
    errorTypesTitle: string;
    errorTypesEmpty: string;
    errorTypeCount: string;
    blueprintGridTitle: string;
    blueprintGridDescription: string;
    physicianActivityLabels: Record<string, string>;
    dimensionOfCareLabels: Record<string, string>;
    errorTypeLabels: Record<string, string>;
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

function getBlueprintCellTone(accuracy: number | null) {
  if (accuracy === null) return 'bg-[#172133] text-slate-600';
  if (accuracy >= 80) return 'bg-emerald-500/20 text-emerald-200';
  if (accuracy >= 60) return 'bg-emerald-400/12 text-emerald-100';
  if (accuracy >= 40) return 'bg-amber-400/16 text-amber-100';
  return 'bg-red-400/16 text-red-100';
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

function formatTrendLabel(value: string) {
  const date = parseIsoDate(value);
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function AccuracyList({
  items,
  title,
  labels,
  empty,
}: {
  items: CategoryAccuracyItem[];
  title: string;
  labels: Record<string, string>;
  empty: string;
}) {
  const visibleItems = items.filter((item) => item.total > 0);

  return (
    <section className="surface-mockup p-5">
      <p className="text-sm font-bold text-white">{title}</p>
      <div className="mt-4 space-y-3">
        {visibleItems.length > 0 ? (
          visibleItems.map((item) => (
            <div key={item.category} className="rounded-[10px] bg-white/[0.035] px-3 py-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-slate-300">{labels[item.category] ?? item.category}</p>
                <span className="text-sm font-extrabold text-white">{item.accuracy}%</span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">{empty}</p>
        )}
      </div>
    </section>
  );
}

export function DashboardPerformanceView({
  answeredCount,
  completedSessionsCount,
  successRate,
  averageConfidence,
  trialProgress,
  heatmap,
  physicianActivityAccuracy,
  dimensionOfCareAccuracy,
  blueprintGrid,
  confidenceCalibration,
  errorTypeBreakdown,
  weeklyTrend,
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
  const completion = answeredCount > 0 ? Math.round((completedSessionsCount / Math.max(1, completedSessionsCount)) * 100) : 0;
  const confidenceLabel =
    averageConfidence === 'low'
      ? labels.confidenceLow
      : averageConfidence === 'medium'
        ? labels.confidenceMedium
        : averageConfidence === 'high'
          ? labels.confidenceHigh
          : labels.noData;
  const progressPercentage = Math.min(100, Math.round((trialProgress.current / Math.max(1, trialProgress.total)) * 100));
  const blueprintRows = physicianActivityAccuracy
    .map((item) => item.category)
    .filter((category) => blueprintGrid.some((cell) => cell.physicianActivity === category && cell.total > 0));

  return (
    <>
      <section className="surface-mockup p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-white">{labels.trialProgressTitle}</p>
            <p className="mt-2 text-sm font-semibold text-slate-300">
              {labels.trialProgressSummary
                .replace('{current}', String(trialProgress.current))
                .replace('{total}', String(trialProgress.total))}
            </p>
          </div>
          <p className="text-lg font-extrabold text-white">{progressPercentage}%</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
          <div className="h-full rounded-full bg-brand" style={{ width: `${progressPercentage}%` }} />
        </div>
        <p className={`mt-3 text-sm ${trialProgress.isComplete ? 'font-bold text-amber-300' : trialProgress.showWarning ? 'font-bold text-amber-300' : 'text-slate-500'}`}>
          {trialProgress.isComplete
            ? labels.trialProgressComplete
            : trialProgress.showWarning
              ? labels.trialProgressWarning.replace('{remaining}', String(trialProgress.remaining))
              : labels.trialProgressDescription.replace('{remaining}', String(trialProgress.remaining))}
        </p>
      </section>

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
            <p className="text-2xl font-extrabold text-brand">{completedSessionsCount}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{labels.sessionsFinished}</p>
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
              <span className="font-extrabold text-white">{completion}%</span>
            </div>
          </aside>
        </div>
      </section>

      <section className="surface-mockup p-5">
        <p className="text-sm font-bold text-white">{labels.certaintyTitle}</p>
        <p className="mt-2 text-sm text-slate-500">
          {successRate !== null ? `${successRate}% - ${confidenceLabel}` : labels.confidenceAfterNextSession}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {confidenceCalibration.map((item) => (
            <div key={item.confidence} className="rounded-[10px] bg-white/[0.035] px-3 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                {item.confidence === 'low' ? labels.confidenceLow : item.confidence === 'medium' ? labels.confidenceMedium : labels.confidenceHigh}
              </p>
              <p className="mt-2 text-lg font-extrabold text-white">{item.total > 0 ? `${item.accuracy}%` : labels.noData}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <AccuracyList
          items={physicianActivityAccuracy}
          title={labels.physicianActivityTitle}
          labels={labels.physicianActivityLabels}
          empty={labels.noData}
        />
        <AccuracyList
          items={dimensionOfCareAccuracy}
          title={labels.dimensionOfCareTitle}
          labels={labels.dimensionOfCareLabels}
          empty={labels.noData}
        />
      </section>

      <section className="surface-mockup p-5">
        <p className="text-sm font-bold text-white">{labels.blueprintGridTitle}</p>
        <p className="mt-2 text-sm text-slate-500">{labels.blueprintGridDescription}</p>
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[680px]">
            <div className="grid grid-cols-[180px_repeat(6,minmax(0,1fr))] gap-2 text-[11px] font-bold text-slate-500">
              <div />
              {dimensionOfCareAccuracy.map((item) => (
                <div key={item.category} className="px-2 text-center">
                  {labels.dimensionOfCareLabels[item.category] ?? item.category}
                </div>
              ))}
            </div>
            <div className="mt-2 space-y-2">
              {blueprintRows.length > 0 ? (
                blueprintRows.map((rowKey) => (
                  <div key={rowKey} className="grid grid-cols-[180px_repeat(6,minmax(0,1fr))] gap-2">
                    <div className="flex items-center px-2 text-xs font-semibold text-slate-300">
                      {labels.physicianActivityLabels[rowKey] ?? rowKey}
                    </div>
                    {dimensionOfCareAccuracy.map((column) => {
                      const cell = blueprintGrid.find(
                        (item) => item.physicianActivity === rowKey && item.dimensionOfCare === column.category,
                      );
                      return (
                        <div
                          key={`${rowKey}-${column.category}`}
                          className={`rounded-[8px] px-2 py-3 text-center text-xs font-extrabold ${getBlueprintCellTone(cell?.accuracy ?? null)}`}
                        >
                          {cell?.accuracy ?? labels.noData}
                        </div>
                      );
                    })}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">{labels.noData}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <section className="surface-mockup p-5">
          <p className="text-sm font-bold text-white">{labels.errorTypesTitle}</p>
          <div className="mt-4 space-y-3">
            {errorTypeBreakdown.length > 0 ? (
              errorTypeBreakdown.map((item) => (
                <div key={item.errorType} className="rounded-[10px] bg-white/[0.035] px-3 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-slate-300">{labels.errorTypeLabels[item.errorType] ?? item.errorType}</p>
                    <span className="text-sm font-extrabold text-white">
                      {labels.errorTypeCount.replace('{count}', String(item.count))}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">{labels.errorTypesEmpty}</p>
            )}
          </div>
        </section>

        <section className="surface-mockup p-5">
          <p className="text-sm font-bold text-white">{labels.trendTitle}</p>
          <p className="mt-2 text-sm text-slate-500">{labels.trendDescription}</p>
          <div className="mt-4 space-y-3">
            {weeklyTrend.length > 0 ? (
              weeklyTrend.map((point) => (
                <div key={point.label} className="rounded-[10px] bg-white/[0.035] px-3 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-slate-300">{formatTrendLabel(point.label)}</p>
                    <span className="text-sm font-extrabold text-white">
                      {point.accuracy !== null
                        ? labels.trendAccuracyValue.replace('{accuracy}', String(point.accuracy)).replace('{count}', String(point.total))
                        : labels.trendEmpty}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">{labels.trendEmpty}</p>
            )}
          </div>
        </section>
      </section>
    </>
  );
}
