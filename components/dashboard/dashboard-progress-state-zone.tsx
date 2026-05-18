'use client';

import { memo } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

export type ProgressQuadrantKey =
  | 'trueMastery'
  | 'fragileKnowledge'
  | 'consciousGap'
  | 'falseConfidence';

export type ProgressQuadrantItem = {
  key: ProgressQuadrantKey;
  percentage: number;
  count: number;
  trend: number | null;
};

export type DashboardProgressStateZoneProps = {
  quadrants: ProgressQuadrantItem[];
  labels: {
    title: string;
    subtitle: string;
    noData: string;
    answers: string;
    trendUp: string;
    trendDown: string;
    trendFlat: string;
    trendUnavailable: string;
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

const QUADRANT_TONES: Record<ProgressQuadrantKey, string> = {
  trueMastery: 'border-emerald-400/20 bg-emerald-400/[0.08]',
  fragileKnowledge: 'border-sky-400/20 bg-sky-400/[0.07]',
  consciousGap: 'border-amber-300/20 bg-amber-300/[0.08]',
  falseConfidence: 'border-rose-400/20 bg-rose-400/[0.08]',
};

const QUADRANT_ACCENTS: Record<ProgressQuadrantKey, string> = {
  trueMastery: 'bg-brand',
  fragileKnowledge: 'bg-sky-300',
  consciousGap: 'bg-amber-300',
  falseConfidence: 'bg-rose-300',
};

function getQuadrantLabel(
  key: ProgressQuadrantKey,
  labels: DashboardProgressStateZoneProps['labels'],
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

function TrendIndicator({
  trend,
  labels,
}: {
  trend: number | null;
  labels: DashboardProgressStateZoneProps['labels'];
}) {
  if (trend === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        {labels.trendUnavailable}
      </span>
    );
  }

  if (trend === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        {labels.trendFlat}
      </span>
    );
  }

  const isPositive = trend > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const labelTemplate = isPositive ? labels.trendUp : labels.trendDown;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        isPositive ? 'text-emerald-300' : 'text-rose-300'
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {labelTemplate.replace('{value}', String(Math.abs(trend)))}
    </span>
  );
}

export const DashboardProgressStateZone = memo(
  function DashboardProgressStateZone({
    quadrants,
    labels,
  }: DashboardProgressStateZoneProps) {
    const quadrantsByKey = new Map(quadrants.map((item) => [item.key, item]));
    const totalAnswers = quadrants.reduce((sum, item) => sum + item.count, 0);

    return (
      <section className="surface-mockup p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">
              {labels.title}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {labels.subtitle}
            </p>
          </div>
          <p className="text-xs font-semibold text-slate-500">
            {totalAnswers > 0
              ? `${totalAnswers} ${labels.answers}`
              : labels.noData}
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {QUADRANT_ORDER.map((key) => {
            const item = quadrantsByKey.get(key) ?? {
              key,
              percentage: 0,
              count: 0,
              trend: null,
            };
            const quadrantLabel = getQuadrantLabel(key, labels);

            return (
              <article
                key={key}
                className={`rounded-[14px] border p-4 ${QUADRANT_TONES[key]}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${QUADRANT_ACCENTS[key]}`}
                        aria-hidden="true"
                      />
                      <h2 className="text-sm font-extrabold text-white">
                        {quadrantLabel.title}
                      </h2>
                    </div>
                    <p className="mt-2 text-xs font-medium leading-5 text-slate-500">
                      {quadrantLabel.description}
                    </p>
                  </div>
                  <p className="shrink-0 text-3xl font-black leading-none text-white">
                    {item.percentage}%
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-500">
                    {item.count} {labels.answers}
                  </span>
                  <TrendIndicator trend={item.trend} labels={labels} />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  },
);
