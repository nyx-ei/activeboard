import { AlertIcon, SparkIcon, TargetIcon } from '@/components/ui/dashboard-icons';

type HeatmapDay = {
  date: string;
  count: number;
  intensity: 0 | 1 | 2 | 3 | 4;
};

type DashboardPerformanceViewProps = {
  answeredCount: number;
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

export function DashboardPerformanceView({
  answeredCount,
  successRate,
  errorRate,
  averageConfidence,
  heatmap,
  labels,
}: DashboardPerformanceViewProps) {
  const lastSevenDays = heatmap.slice(-7);
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
        <div className="flex items-center gap-2">
          <SparkIcon className="h-4 w-4" />
          <p className="text-sm font-bold text-white">{labels.sprintActivityTitle}</p>
        </div>
        <div className="mt-4 flex items-end gap-3">
          <p className="text-3xl font-extrabold leading-none text-white">{answeredCount}</p>
          <p className="text-sm font-medium text-slate-500">{labels.questionsAnswered}</p>
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-400">{labels.sessionsFinished}</p>
        <div className="mt-4 grid grid-cols-7 gap-1">
          {lastSevenDays.map((day) => (
            <div
              key={day.date}
              className={`h-[50px] rounded-[3px] border border-white/[0.04] ${getHeatmapCellClass(day.intensity)}`}
              title={`${day.date} - ${day.count}`}
            />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-600">
          {labels.weekdays.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <p className="mt-4 text-xs italic text-slate-500">{labels.heatmapAvailableAfterSessions}</p>
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
