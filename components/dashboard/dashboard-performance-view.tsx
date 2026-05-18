import { memo, useMemo } from 'react';

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

type BlueprintGridCell = {
  physicianActivity: string;
  dimensionOfCare: string;
  total: number;
  correct: number;
  accuracy: number | null;
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

type ProgressQuadrantKey =
  | 'trueMastery'
  | 'fragileKnowledge'
  | 'consciousGap'
  | 'falseConfidence';

type ProgressQuadrantQuestionItem = {
  id: string;
  quadrant: ProgressQuadrantKey;
  label: string;
  selectedOption: string | null;
  confidence: 'low' | 'medium' | 'high' | null;
  isCorrect: boolean;
  answeredAt: string | null;
};

export type DashboardPerformanceViewProps = {
  answeredCount: number;
  completedSessionsCount: number;
  successRate: number | null;
  averageConfidence: 'low' | 'medium' | 'high' | null;
  heatmap: HeatmapDay[];
  blueprintGrid: BlueprintGridCell[];
  errorTypeBreakdown: ErrorTypeBreakdownItem[];
  weeklyTrend: TrendPoint[];
  confidenceCalibration: ConfidenceCalibrationItem[];
  sessionConfidenceBreakdown: SessionConfidenceBreakdownItem[];
  progressQuadrantQuestions: ProgressQuadrantQuestionItem[];
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
    sessionsFinishedOne: string;
    sessionsFinishedOther: string;
    averagePerWeek: string;
    completion: string;
    confidenceCalibrationTitle: string;
    detailsTitle: string;
    quadrantQuestionListsTitle: string;
    blueprintHeatmapTitle: string;
    errorTypeFrequenciesTitle: string;
    trendDetailsTitle: string;
    recentQuestionsEmpty: string;
    selectedOption: string;
    correct: string;
    incorrect: string;
    trueMastery: string;
    fragileKnowledge: string;
    consciousGap: string;
    falseConfidence: string;
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

function formatCountLabel(template: string, count: number) {
  return template.replace(/\d+/, String(count));
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function getQuadrantTitle(
  key: ProgressQuadrantKey,
  labels: DashboardPerformanceViewProps['labels'],
) {
  switch (key) {
    case 'trueMastery':
      return labels.trueMastery;
    case 'fragileKnowledge':
      return labels.fragileKnowledge;
    case 'consciousGap':
      return labels.consciousGap;
    case 'falseConfidence':
      return labels.falseConfidence;
  }
}

function getBlueprintCellClass(accuracy: number | null) {
  if (accuracy === null) {
    return 'bg-[#14221f] text-slate-600';
  }

  if (accuracy >= 75) {
    return 'bg-brand/25 text-emerald-100';
  }

  if (accuracy >= 50) {
    return 'bg-amber-300/20 text-amber-100';
  }

  return 'bg-rose-400/15 text-rose-100';
}

export const DashboardPerformanceView = memo(function DashboardPerformanceView({
  answeredCount,
  completedSessionsCount,
  successRate,
  heatmap,
  blueprintGrid,
  errorTypeBreakdown,
  weeklyTrend,
  confidenceCalibration,
  sessionConfidenceBreakdown,
  progressQuadrantQuestions,
  labels,
}: DashboardPerformanceViewProps) {
  const weekCount = 28;
  const { weeks, monthMarkers } = useMemo(() => {
    const heatmapByDate = new Map(heatmap.map((day) => [day.date, day]));
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
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
    const nextWeeks: HeatmapDay[][] = [];
    for (let index = 0; index < chartDays.length; index += 7) {
      nextWeeks.push(chartDays.slice(index, index + 7));
    }
    const nextMonthMarkers = nextWeeks.map((week, weekIndex) => {
      const firstOfMonth = week.find(
        (day) => parseIsoDate(day.date).getUTCDate() === 1,
      );
      if (!firstOfMonth && weekIndex !== 0) return '';
      const markerDate = firstOfMonth
        ? parseIsoDate(firstOfMonth.date)
        : week[0]
          ? parseIsoDate(week[0].date)
          : null;
      if (!markerDate) return '';
      return labels.monthLabels[markerDate.getUTCMonth()] ?? '';
    });

    return {
      weeks: nextWeeks,
      monthMarkers: nextMonthMarkers,
    };
  }, [heatmap, labels.monthLabels]);
  const averagePerWeek = Math.round(answeredCount / Math.max(1, weekCount));
  const sessionsFinishedLabel = formatCountLabel(
    completedSessionsCount === 1
      ? labels.sessionsFinishedOne
      : labels.sessionsFinishedOther,
    completedSessionsCount,
  );
  const quadrantOrder: ProgressQuadrantKey[] = [
    'trueMastery',
    'fragileKnowledge',
    'consciousGap',
    'falseConfidence',
  ];
  const questionsByQuadrant = new Map(
    quadrantOrder.map((key) => [
      key,
      progressQuadrantQuestions.filter((item) => item.quadrant === key),
    ]),
  );
  const maxErrorCount = Math.max(
    1,
    ...errorTypeBreakdown.map((item) => item.count),
  );
  return (
    <div className="space-y-5">
      <section className="surface-mockup p-5">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">
          {labels.detailsTitle}
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          {labels.quadrantQuestionListsTitle}
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {quadrantOrder.map((quadrant) => {
            const questions = questionsByQuadrant.get(quadrant) ?? [];

            return (
              <div
                key={quadrant}
                className="rounded-[12px] border border-white/[0.06] bg-white/[0.025] p-4"
              >
                <p className="text-sm font-extrabold text-white">
                  {getQuadrantTitle(quadrant, labels)}
                </p>
                {questions.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {questions.map((question) => (
                      <div
                        key={question.id}
                        className="flex items-center justify-between gap-3 rounded-[8px] bg-white/[0.035] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">
                            {question.label}
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-slate-500">
                            {labels.selectedOption}:{' '}
                            {question.selectedOption ?? labels.noData}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-extrabold ${
                            question.isCorrect
                              ? 'bg-brand/15 text-brand'
                              : 'bg-rose-400/15 text-rose-200'
                          }`}
                        >
                          {question.isCorrect
                            ? labels.correct
                            : labels.incorrect}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm font-semibold text-slate-500">
                    {labels.recentQuestionsEmpty}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="surface-mockup p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-300">
              {labels.sprintActivityTitle}
            </p>
            <p className="mt-2 text-2xl font-extrabold text-white">
              {answeredCount}
              <span className="ml-2 text-sm font-bold text-slate-500">
                {labels.questionsAnswered}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[42px] font-extrabold leading-none text-brand">
              {completedSessionsCount}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              {sessionsFinishedLabel}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0 pb-1">
            <div className="grid grid-cols-[18px_minmax(0,1fr)] gap-2">
              <div />
              <div
                className="grid gap-[2px] overflow-visible text-[8px] font-semibold text-slate-600 sm:gap-[3px] sm:text-[9px] md:text-[10px]"
                style={{
                  gridTemplateColumns: `repeat(${weekCount}, minmax(0, 1fr))`,
                }}
              >
                {monthMarkers.map((month, index) => (
                  <span
                    key={`${month}-${index}`}
                    className="whitespace-nowrap leading-none"
                  >
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
                  <div
                    key={weekIndex}
                    className="grid min-w-0 flex-1 grid-rows-7 gap-[2px] sm:gap-[3px]"
                  >
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
              <span className="font-semibold text-slate-500">
                {labels.averagePerWeek}
              </span>
              <span className="font-extrabold text-white">
                {averagePerWeek}
              </span>
              <span className="font-semibold text-slate-500">
                {labels.completion}
              </span>
              <span className="font-extrabold text-white">
                {successRate !== null ? `${successRate}%` : labels.noData}
              </span>
            </div>
          </aside>
        </div>
      </section>

      <section className="surface-mockup p-5">
        <p className="text-sm font-bold text-white">
          {labels.blueprintHeatmapTitle}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {blueprintGrid.length > 0 ? (
            blueprintGrid.map((cell) => (
              <div
                key={`${cell.physicianActivity}-${cell.dimensionOfCare}`}
                className={`rounded-[10px] px-3 py-3 ${getBlueprintCellClass(cell.accuracy)}`}
              >
                <p className="text-xs font-extrabold uppercase tracking-[0.1em]">
                  {formatLabel(cell.physicianActivity)}
                </p>
                <p className="mt-1 text-xs font-semibold opacity-80">
                  {formatLabel(cell.dimensionOfCare)}
                </p>
                <p className="mt-2 text-lg font-black">
                  {cell.accuracy === null ? labels.noData : `${cell.accuracy}%`}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm font-semibold text-slate-500">
              {labels.noData}
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface-mockup p-5">
          <p className="text-sm font-bold text-white">
            {labels.errorTypeFrequenciesTitle}
          </p>
          <div className="mt-4 space-y-3">
            {errorTypeBreakdown.length > 0 ? (
              errorTypeBreakdown.map((item) => (
                <div key={item.errorType}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-300">
                      {formatLabel(item.errorType)}
                    </span>
                    <span className="font-extrabold text-white">
                      {item.count}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{
                        width: `${Math.max(4, Math.round((item.count / maxErrorCount) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm font-semibold text-slate-500">
                {labels.noData}
              </p>
            )}
          </div>
        </section>

        <section className="surface-mockup p-5">
          <p className="text-sm font-bold text-white">
            {labels.trendDetailsTitle}
          </p>
          <div className="mt-4 space-y-3">
            {weeklyTrend.length > 0 ? (
              weeklyTrend.map((point) => (
                <div
                  key={point.label}
                  className="flex items-center justify-between gap-3 rounded-[10px] bg-white/[0.03] px-3 py-2"
                >
                  <span className="text-sm font-semibold text-slate-300">
                    {point.label}
                  </span>
                  <span className="text-sm font-extrabold text-white">
                    {point.accuracy === null
                      ? labels.noData
                      : `${point.accuracy}%`}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm font-semibold text-slate-500">
                {labels.noData}
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="surface-mockup p-5">
        <p className="text-sm font-bold text-white">{labels.certaintyTitle}</p>
        {sessionConfidenceBreakdown.length > 0 ? (
          <div className="mt-4 space-y-3">
            {sessionConfidenceBreakdown.map((item) => (
              <div
                key={item.sessionId}
                className="rounded-[10px] border border-white/[0.05] bg-white/[0.03] px-4 py-3"
              >
                <p className="text-sm font-bold text-white">
                  {item.sessionName}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-[8px] bg-white/[0.03] px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      L
                    </p>
                    <p className="mt-1 text-base font-extrabold text-white">
                      {item.low}
                    </p>
                  </div>
                  <div className="rounded-[8px] bg-white/[0.03] px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      M
                    </p>
                    <p className="mt-1 text-base font-extrabold text-white">
                      {item.medium}
                    </p>
                  </div>
                  <div className="rounded-[8px] bg-white/[0.03] px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      H
                    </p>
                    <p className="mt-1 text-base font-extrabold text-white">
                      {item.high}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : confidenceCalibration.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {confidenceCalibration.map((item) => (
              <div
                key={item.confidence}
                className="rounded-[10px] bg-white/[0.035] px-3 py-3"
              >
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  {item.confidence === 'low'
                    ? labels.confidenceLow
                    : item.confidence === 'medium'
                      ? labels.confidenceMedium
                      : labels.confidenceHigh}
                </p>
                <p className="mt-2 text-lg font-extrabold text-white">
                  {item.total > 0 ? `${item.accuracy}%` : labels.noData}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {item.total} answers
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
});
