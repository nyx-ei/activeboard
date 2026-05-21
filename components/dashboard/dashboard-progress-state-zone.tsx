'use client';

import { memo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Sprout,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';

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
  detailsHref: string;
  labels: {
    title: string;
    subtitle: string;
    viewDetails: string;
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
  trueMastery: 'bg-[#26B872]',
  fragileKnowledge: 'bg-[#6FCF6F]',
  consciousGap: 'bg-[#F7941D]',
  falseConfidence: 'bg-[#F26B6B]',
};

const QUADRANT_ICONS = {
  trueMastery: Check,
  fragileKnowledge: Sprout,
  consciousGap: AlertTriangle,
  falseConfidence: X,
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

function TrendGlyph({
  trend,
  fallbackDirection,
}: {
  trend: number | null;
  fallbackDirection: 'up' | 'down';
}) {
  const isPositive =
    trend === null ? fallbackDirection === 'up' : trend >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;

  return (
    <Icon
      className={`h-3.5 w-3.5 ${
        isPositive ? 'text-[#7FE5BD]' : 'text-[#F0A0A0]'
      }`}
      aria-hidden="true"
    />
  );
}

export const DashboardProgressStateZone = memo(
  function DashboardProgressStateZone({
    quadrants,
    detailsHref,
    labels,
  }: DashboardProgressStateZoneProps) {
    const quadrantsByKey = new Map(quadrants.map((item) => [item.key, item]));
    const totalAnswers = quadrants.reduce((sum, item) => sum + item.count, 0);

    return (
      <section className="v11-card">
        <div className="v11-card-head">
          <div>
            <p className="v11-card-title">{labels.title}</p>
            <p className="v11-card-sub mt-1">{labels.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            {totalAnswers > 0 ? (
              <p className="text-[12px] font-medium text-[#8fa7a2]">
                {totalAnswers} {labels.answers}
              </p>
            ) : (
              <span className="inline-flex h-8 items-center rounded-full border border-white/[0.06] bg-white/[0.025] px-3 text-[12px] font-medium text-[#8fa7a2]">
                {labels.noData}
              </span>
            )}
            <a
              href={detailsHref}
              className="inline-flex items-center gap-1 text-[15px] font-medium text-[#20D9A3] transition hover:text-[#9FF0CE]"
            >
              {labels.viewDetails}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="grid gap-[14px] sm:grid-cols-2 xl:grid-cols-4">
          {QUADRANT_ORDER.map((key) => {
            const item = quadrantsByKey.get(key) ?? {
              key,
              percentage: 0,
              count: 0,
              trend: null,
            };
            const quadrantLabel = getQuadrantLabel(key, labels);
            const Icon = QUADRANT_ICONS[key];
            const fallbackDirection: 'up' | 'down' =
              key === 'trueMastery' ? 'up' : 'down';

            return (
              <article
                key={key}
                className="v11-mini-card flex items-center gap-[14px] p-4"
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#062b22] ${QUADRANT_TONES[key]}`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h2 className="text-[14px] font-medium text-[#e8f4f0]">
                      {quadrantLabel.title}
                    </h2>
                    <p className="inline-flex items-center gap-1 text-[14px] font-medium text-[#e8f4f0]">
                      {item.percentage}%
                      <TrendGlyph
                        trend={item.trend}
                        fallbackDirection={fallbackDirection}
                      />
                    </p>
                  </div>
                  <p className="mt-1 truncate text-[11.5px] font-normal text-[#5c7773]">
                    {quadrantLabel.description}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  },
);
