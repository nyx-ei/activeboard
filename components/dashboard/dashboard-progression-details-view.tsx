import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Sprout,
  X,
} from 'lucide-react';

import { Link } from '@/i18n/navigation';

type ProgressQuadrantKey =
  | 'trueMastery'
  | 'fragileKnowledge'
  | 'consciousGap'
  | 'falseConfidence';

type ProgressQuadrantItem = {
  key: ProgressQuadrantKey;
  percentage: number;
  count: number;
  trend: number | null;
};

type ProgressQuadrantQuestionItem = {
  id: string;
  quadrant: ProgressQuadrantKey;
  label: string;
  selectedOption: string | null;
  confidence: 'low' | 'medium' | 'high' | null;
  isCorrect: boolean;
  answeredAt: string | null;
};

type BlueprintGridCell = {
  physicianActivity: string;
  dimensionOfCare: string;
  total: number;
  correct: number;
  accuracy: number | null;
};

type TrendPoint = {
  label: string;
  total: number;
  accuracy: number | null;
};

type ErrorTypeBreakdownItem = {
  errorType: string;
  count: number;
};

export type DashboardProgressionDetailsViewProps = {
  backHref: string;
  quadrants: ProgressQuadrantItem[];
  progressQuadrantQuestions: ProgressQuadrantQuestionItem[];
  blueprintGrid: BlueprintGridCell[];
  weeklyTrend: TrendPoint[];
  errorTypeBreakdown: ErrorTypeBreakdownItem[];
  labels: {
    back: string;
    title: string;
    description: string;
    windowSprint: string;
    windowMonth: string;
    windowAll: string;
    noData: string;
    answers: string;
    questions: string;
    matrixTitle: string;
    matrixDescription: string;
    yAxisLow: string;
    yAxisHigh: string;
    xAxisIncorrect: string;
    xAxisCorrect: string;
    legendTitle: string;
    subjectBreakdown: string;
    subject: string;
    distribution: string;
    accuracy: string;
    volume: string;
    recentShifts: string;
    focusNext: string;
    focusMeta: string;
    trueMastery: string;
    trueMasteryDescription: string;
    fragileKnowledge: string;
    fragileKnowledgeDescription: string;
    consciousGap: string;
    consciousGapDescription: string;
    falseConfidence: string;
    falseConfidenceDescription: string;
  };
};

const QUADRANT_ORDER: ProgressQuadrantKey[] = [
  'trueMastery',
  'fragileKnowledge',
  'consciousGap',
  'falseConfidence',
];

const QUADRANT_TONES: Record<
  ProgressQuadrantKey,
  {
    dot: string;
    iconBg: string;
    iconText: string;
    cell: string;
    bar: string;
  }
> = {
  trueMastery: {
    dot: 'bg-[#26B872]',
    iconBg: 'bg-[#20D9A3]/10 border-[#20D9A3]/25',
    iconText: 'text-[#9FF0CE]',
    cell: 'bg-[#102f28]',
    bar: 'bg-[#26B872]',
  },
  fragileKnowledge: {
    dot: 'bg-[#6FCF6F]',
    iconBg: 'bg-[#6FCF6F]/10 border-[#6FCF6F]/25',
    iconText: 'text-[#b8f4b0]',
    cell: 'bg-[#182f25]',
    bar: 'bg-[#6FCF6F]',
  },
  consciousGap: {
    dot: 'bg-[#F7941D]',
    iconBg: 'bg-[#F7941D]/10 border-[#F7941D]/25',
    iconText: 'text-[#f9c57b]',
    cell: 'bg-[#332818]',
    bar: 'bg-[#F7941D]',
  },
  falseConfidence: {
    dot: 'bg-[#F26B6B]',
    iconBg: 'bg-[#F26B6B]/10 border-[#F26B6B]/25',
    iconText: 'text-[#F0A0A0]',
    cell: 'bg-[#331f21]',
    bar: 'bg-[#F26B6B]',
  },
};

const QUADRANT_ICONS = {
  trueMastery: Check,
  fragileKnowledge: Sprout,
  consciousGap: AlertTriangle,
  falseConfidence: X,
};

function getQuadrantCopy(
  key: ProgressQuadrantKey,
  labels: DashboardProgressionDetailsViewProps['labels'],
) {
  switch (key) {
    case 'trueMastery':
      return {
        title: labels.trueMastery,
        description: labels.trueMasteryDescription,
      };
    case 'fragileKnowledge':
      return {
        title: labels.fragileKnowledge,
        description: labels.fragileKnowledgeDescription,
      };
    case 'consciousGap':
      return {
        title: labels.consciousGap,
        description: labels.consciousGapDescription,
      };
    case 'falseConfidence':
      return {
        title: labels.falseConfidence,
        description: labels.falseConfidenceDescription,
      };
  }
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function formatSignedPercent(value: number | null) {
  if (value === null || value === 0) {
    return '0%';
  }

  return `${value > 0 ? '+' : ''}${value}%`;
}

function getQuestionSize(index: number) {
  return [36, 30, 26, 22, 18][index % 5] ?? 20;
}

function buildSubjectRows(blueprintGrid: BlueprintGridCell[]) {
  const grouped = new Map<
    string,
    { total: number; correct: number; cells: BlueprintGridCell[] }
  >();

  for (const cell of blueprintGrid) {
    const key = formatLabel(cell.physicianActivity || cell.dimensionOfCare);
    const current = grouped.get(key) ?? { total: 0, correct: 0, cells: [] };
    current.total += cell.total;
    current.correct += cell.correct;
    current.cells.push(cell);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .map(([name, row]) => ({
      name,
      total: row.total,
      accuracy:
        row.total > 0 ? Math.round((row.correct / row.total) * 100) : null,
      quadrants: row.cells.slice(0, 4),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
}

function buildFocusItems(
  questions: ProgressQuadrantQuestionItem[],
  blueprintGrid: BlueprintGridCell[],
) {
  const questionItems = questions
    .filter(
      (question) =>
        question.quadrant === 'falseConfidence' ||
        question.quadrant === 'consciousGap',
    )
    .slice(0, 3)
    .map((question) => ({
      id: question.id,
      topic: question.label,
      meta: question.selectedOption ?? '',
    }));

  if (questionItems.length >= 3) {
    return questionItems;
  }

  const existingIds = new Set(questionItems.map((item) => item.id));
  const blueprintItems = blueprintGrid
    .filter((cell) => cell.total > 0)
    .sort((a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101))
    .map((cell) => ({
      id: `${cell.physicianActivity}-${cell.dimensionOfCare}`,
      topic: formatLabel(cell.physicianActivity),
      meta: formatLabel(cell.dimensionOfCare),
    }))
    .filter((item) => !existingIds.has(item.id));

  return [...questionItems, ...blueprintItems].slice(0, 3);
}

function buildRecentShifts(
  weeklyTrend: TrendPoint[],
  errorTypeBreakdown: ErrorTypeBreakdownItem[],
  labels: DashboardProgressionDetailsViewProps['labels'],
) {
  const shifts: Array<{
    id: string;
    direction: 'good' | 'bad';
    title: string;
    detail: string;
  }> = [];

  for (let index = 1; index < weeklyTrend.length; index += 1) {
    const previous = weeklyTrend[index - 1];
    const current = weeklyTrend[index];
    if (previous?.accuracy === null || current?.accuracy === null) {
      continue;
    }

    const delta = (current?.accuracy ?? 0) - (previous?.accuracy ?? 0);
    if (delta === 0 || !current) {
      continue;
    }

    shifts.push({
      id: current.label,
      direction: delta > 0 ? 'good' : 'bad',
      title: current.label,
      detail: formatSignedPercent(delta),
    });
  }

  for (const item of errorTypeBreakdown.slice(0, 3)) {
    shifts.push({
      id: item.errorType,
      direction: 'bad',
      title: formatLabel(item.errorType),
      detail: `${item.count} ${labels.questions}`,
    });
  }

  return shifts.slice(0, 4);
}

function MetricPill({ children }: { children: string }) {
  return (
    <span className="inline-flex h-7 items-center rounded-full border border-white/[0.06] bg-white/[0.025] px-3 text-[12px] font-medium text-[#8fa7a2]">
      {children}
    </span>
  );
}

export function DashboardProgressionDetailsView({
  backHref,
  quadrants,
  progressQuadrantQuestions,
  blueprintGrid,
  weeklyTrend,
  errorTypeBreakdown,
  labels,
}: DashboardProgressionDetailsViewProps) {
  const quadrantsByKey = new Map(quadrants.map((item) => [item.key, item]));
  const questionsByQuadrant = new Map(
    QUADRANT_ORDER.map((key) => [
      key,
      progressQuadrantQuestions.filter((question) => question.quadrant === key),
    ]),
  );
  const subjectRows = buildSubjectRows(blueprintGrid);
  const focusItems = buildFocusItems(progressQuadrantQuestions, blueprintGrid);
  const recentShifts = buildRecentShifts(
    weeklyTrend,
    errorTypeBreakdown,
    labels,
  );
  const totalAnswers = quadrants.reduce((sum, item) => sum + item.count, 0);

  return (
    <main className="flex flex-1 flex-col bg-[#00100f]">
      <section className="mx-auto w-full max-w-[1440px] px-3 pb-10 pt-0 sm:px-2">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={backHref}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-white/[0.06] bg-white/[0.025] px-3 text-[13px] font-medium text-[#d7e3df] transition hover:border-[#20D9A3]/35 hover:bg-[#20D9A3]/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {labels.back}
          </Link>
          <div className="flex gap-1 rounded-[11px] border border-white/[0.06] bg-white/[0.025] p-1">
            {[labels.windowSprint, labels.windowMonth, labels.windowAll].map(
              (windowLabel, index) => (
                <span
                  key={windowLabel}
                  className={`rounded-[8px] px-3 py-2 text-[12px] font-medium ${
                    index === 0
                      ? 'bg-[#20D9A3]/10 text-[#9FF0CE]'
                      : 'text-[#8fa7a2]'
                  }`}
                >
                  {windowLabel}
                </span>
              ),
            )}
          </div>
        </div>

        <header className="mb-[18px] flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="m-0 text-[30px] font-medium leading-[1.15] tracking-[-0.028em] text-[#e8f4f0]">
              {labels.title}
            </h1>
            <p className="mt-2 max-w-[640px] text-[14px] leading-[1.55] text-[#8fa7a2]">
              {labels.description}
            </p>
          </div>
          <MetricPill>
            {totalAnswers > 0
              ? `${totalAnswers} ${labels.answers}`
              : labels.noData}
          </MetricPill>
        </header>

        <section className="grid gap-3 lg:grid-cols-4">
          {QUADRANT_ORDER.map((key) => {
            const item = quadrantsByKey.get(key) ?? {
              key,
              percentage: 0,
              count: 0,
              trend: null,
            };
            const copy = getQuadrantCopy(key, labels);
            const tone = QUADRANT_TONES[key];
            const Icon = QUADRANT_ICONS[key];

            return (
              <article
                key={key}
                className="flex flex-col gap-3 rounded-[14px] border border-white/[0.045] bg-white/[0.02] px-[18px] py-4"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full border ${tone.iconBg} ${tone.iconText}`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-[13.5px] font-medium text-[#e8f4f0]">
                      {copy.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-[#5c7773]">
                      {copy.description}
                    </span>
                  </span>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <span>
                    <span className="inline-flex items-baseline text-[36px] font-medium leading-none tracking-[-0.035em] text-[#e8f4f0]">
                      {item.percentage}
                      <span className="ml-0.5 text-[16px] font-normal text-[#8fa7a2]">
                        %
                      </span>
                    </span>
                    <span className="mt-1.5 block text-[12px] text-[#8fa7a2]">
                      {item.count} {labels.answers}
                    </span>
                  </span>
                </div>
                <div className="border-t border-white/[0.045] pt-2 text-[12px] text-[#8fa7a2]">
                  {formatSignedPercent(item.trend)}
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-[18px] rounded-[16px] border border-white/[0.045] bg-[#0b2522] p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[18px] font-medium tracking-[-0.02em] text-[#e8f4f0]">
                {labels.matrixTitle}
              </h2>
              <p className="mt-1 text-[13px] text-[#8fa7a2]">
                {labels.matrixDescription}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-[11.5px] text-[#8fa7a2]">
              {QUADRANT_ORDER.map((key) => (
                <span key={key} className="inline-flex items-center gap-1.5">
                  <i
                    className={`h-[9px] w-[9px] rounded-[2px] ${QUADRANT_TONES[key].dot}`}
                  />
                  {getQuadrantCopy(key, labels).title}
                </span>
              ))}
            </div>
          </div>

          <div className="grid min-h-[380px] grid-cols-[28px_1fr] grid-rows-[1fr_28px] gap-2.5">
            <div className="flex rotate-180 flex-col items-center justify-between py-[18px] text-[11.5px] uppercase tracking-[0.04em] text-[#8fa7a2] [writing-mode:vertical-rl]">
              <span>{labels.yAxisHigh}</span>
              <span>{labels.yAxisLow}</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {QUADRANT_ORDER.map((key) => {
                const item = quadrantsByKey.get(key) ?? {
                  key,
                  percentage: 0,
                  count: 0,
                  trend: null,
                };
                const copy = getQuadrantCopy(key, labels);
                const tone = QUADRANT_TONES[key];
                const questions = questionsByQuadrant.get(key) ?? [];

                return (
                  <article
                    key={key}
                    className={`flex min-h-[170px] flex-col gap-3 rounded-[14px] border border-white/[0.045] p-4 ${tone.cell}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block text-[13px] font-medium text-[#e8f4f0]">
                          {copy.title}
                        </span>
                        <span className="mt-1 block text-[11px] text-[#8fa7a2]">
                          {copy.description}
                        </span>
                      </span>
                      <span className="text-[28px] font-medium leading-none tracking-[-0.03em] text-[#e8f4f0]">
                        {item.percentage}
                        <span className="text-[14px] font-normal opacity-70">
                          %
                        </span>
                      </span>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-1.5">
                      {questions.length > 0 ? (
                        questions.slice(0, 9).map((question, index) => {
                          const size = getQuestionSize(index);

                          return (
                            <span
                              key={question.id}
                              title={question.label}
                              className={`inline-flex shrink-0 items-center justify-center rounded-full border text-[10px] font-medium tracking-[0.02em] ${tone.iconBg} ${tone.iconText}`}
                              style={{ width: size, height: size }}
                            >
                              {index + 1}
                            </span>
                          );
                        })
                      ) : (
                        <MetricPill>{labels.noData}</MetricPill>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="col-start-2 row-start-2 flex items-center justify-between px-[18px] text-[11.5px] uppercase tracking-[0.04em] text-[#8fa7a2]">
              <span>{labels.xAxisIncorrect}</span>
              <span>{labels.xAxisCorrect}</span>
            </div>
          </div>
        </section>

        <div className="mt-[18px] grid gap-[18px] xl:grid-cols-[1.4fr_1fr]">
          <section className="rounded-[16px] border border-white/[0.045] bg-[#0b2522] p-4 sm:p-5">
            <h2 className="text-[18px] font-medium tracking-[-0.02em] text-[#e8f4f0]">
              {labels.subjectBreakdown}
            </h2>
            <div className="mt-4 grid grid-cols-[1.1fr_2fr_80px_90px] gap-x-4 text-[11px] uppercase tracking-[0.04em] text-[#8fa7a2] max-md:hidden">
              <span className="border-b border-white/[0.045] pb-2">
                {labels.subject}
              </span>
              <span className="border-b border-white/[0.045] pb-2">
                {labels.distribution}
              </span>
              <span className="border-b border-white/[0.045] pb-2 text-right">
                {labels.accuracy}
              </span>
              <span className="border-b border-white/[0.045] pb-2 text-right">
                {labels.volume}
              </span>
            </div>
            <div className="mt-1">
              {subjectRows.length > 0 ? (
                subjectRows.map((row) => (
                  <div
                    key={row.name}
                    className="grid gap-3 border-b border-white/[0.045] py-3 last:border-b-0 md:grid-cols-[1.1fr_2fr_80px_90px] md:gap-x-4"
                  >
                    <span className="text-[13.5px] font-medium text-[#e8f4f0]">
                      {row.name}
                    </span>
                    <span className="flex h-2 w-full overflow-hidden rounded-full bg-white/[0.04] md:self-center">
                      {QUADRANT_ORDER.map((key, index) => {
                        const width =
                          row.quadrants[index] && row.total > 0
                            ? Math.max(
                                8,
                                Math.round(
                                  ((row.quadrants[index]?.total ?? 0) /
                                    row.total) *
                                    100,
                                ),
                              )
                            : 0;

                        return (
                          <span
                            key={key}
                            className={QUADRANT_TONES[key].bar}
                            style={{ width: `${width}%` }}
                          />
                        );
                      })}
                    </span>
                    <span className="text-right text-[13.5px] text-[#e8f4f0]">
                      {row.accuracy === null
                        ? labels.noData
                        : `${row.accuracy}%`}
                    </span>
                    <span className="text-right text-[13.5px] text-[#8fa7a2]">
                      {row.total}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-5">
                  <MetricPill>{labels.noData}</MetricPill>
                </div>
              )}
            </div>
          </section>

          <div className="grid gap-[18px]">
            <section className="rounded-[16px] border border-white/[0.045] bg-[#0b2522] p-4 sm:p-5">
              <h2 className="text-[18px] font-medium tracking-[-0.02em] text-[#e8f4f0]">
                {labels.recentShifts}
              </h2>
              <div className="mt-3 flex flex-col">
                {recentShifts.length > 0 ? (
                  recentShifts.map((shift) => {
                    const isGood = shift.direction === 'good';
                    const Icon = isGood ? ArrowUp : ArrowDown;

                    return (
                      <div
                        key={shift.id}
                        className="flex items-center gap-3 border-t border-white/[0.045] py-3 first:border-t-0"
                      >
                        <span
                          className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border ${
                            isGood
                              ? 'border-[#20D9A3]/30 bg-[#20D9A3]/10 text-[#7FE5BD]'
                              : 'border-[#F26B6B]/30 bg-[#F26B6B]/10 text-[#F0A0A0]'
                          }`}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-medium text-[#e8f4f0]">
                            {shift.title}
                          </span>
                          <span className="mt-0.5 block text-[12px] text-[#8fa7a2]">
                            {shift.detail}
                          </span>
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <MetricPill>{labels.noData}</MetricPill>
                )}
              </div>
            </section>

            <section className="rounded-[16px] border border-white/[0.045] bg-[#0b2522] p-4 sm:p-5">
              <h2 className="text-[18px] font-medium tracking-[-0.02em] text-[#e8f4f0]">
                {labels.focusNext}
              </h2>
              <div className="mt-3 flex flex-col gap-2">
                {focusItems.length > 0 ? (
                  focusItems.map((item, index) => (
                    <article
                      key={item.id}
                      className="flex items-center gap-3 rounded-[12px] border border-white/[0.045] bg-white/[0.02] px-4 py-3"
                    >
                      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-[#20D9A3]/30 bg-[#20D9A3]/10 text-[13px] font-medium text-[#9FF0CE]">
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium text-[#e8f4f0]">
                          {item.topic}
                        </span>
                        <span className="mt-1 block truncate text-[12px] text-[#8fa7a2]">
                          {labels.focusMeta}
                          {item.meta ? `: ${item.meta}` : ''}
                        </span>
                      </span>
                    </article>
                  ))
                ) : (
                  <MetricPill>{labels.noData}</MetricPill>
                )}
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
