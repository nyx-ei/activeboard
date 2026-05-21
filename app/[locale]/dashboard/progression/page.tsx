import { getTranslations } from 'next-intl/server';

import { DashboardProgressionDetailsView } from '@/components/dashboard/dashboard-progression-details-view';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { getDashboardPerformanceData } from '@/lib/demo/data';

type DashboardProgressionPageProps = {
  params: { locale: string };
};

export default async function DashboardProgressionPage({
  params,
}: DashboardProgressionPageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('Dashboard');
  const performanceData = await getDashboardPerformanceData(user.id);

  return (
    <DashboardProgressionDetailsView
      backHref="/dashboard"
      quadrants={performanceData.progressQuadrants}
      progressQuadrantQuestions={performanceData.progressQuadrantQuestions}
      blueprintGrid={performanceData.profileAnalytics.blueprintGrid}
      weeklyTrend={performanceData.profileAnalytics.weeklyTrend}
      errorTypeBreakdown={performanceData.profileAnalytics.errorTypeBreakdown}
      labels={{
        back: t('secondaryBackToDashboard'),
        title: t('progressionDetailsTitle'),
        description: t('progressionDetailsDescription'),
        windowSprint: t('progressionWindowSprint'),
        windowMonth: t('progressionWindowMonth'),
        windowAll: t('progressionWindowAll'),
        noData: t('noData'),
        answers: t('zoneProgressStateAnswers'),
        questions: t('questionsUnit'),
        matrixTitle: t('progressionMatrixTitle'),
        matrixDescription: t('progressionMatrixDescription'),
        yAxisLow: t('progressionYAxisLow'),
        yAxisHigh: t('progressionYAxisHigh'),
        xAxisIncorrect: t('progressionXAxisIncorrect'),
        xAxisCorrect: t('progressionXAxisCorrect'),
        legendTitle: t('progressionLegendTitle'),
        subjectBreakdown: t('progressionSubjectBreakdown'),
        subject: t('progressionSubject'),
        distribution: t('progressionDistribution'),
        accuracy: t('accuracy'),
        volume: t('progressionVolume'),
        recentShifts: t('progressionRecentShifts'),
        focusNext: t('progressionFocusNext'),
        focusMeta: t('progressionFocusMeta'),
        trueMastery: t('zoneQuadrantTrueMastery'),
        trueMasteryDescription: t('zoneQuadrantTrueMasteryDescription'),
        fragileKnowledge: t('zoneQuadrantFragileKnowledge'),
        fragileKnowledgeDescription: t(
          'zoneQuadrantFragileKnowledgeDescription',
        ),
        consciousGap: t('zoneQuadrantConsciousGap'),
        consciousGapDescription: t('zoneQuadrantConsciousGapDescription'),
        falseConfidence: t('zoneQuadrantFalseConfidence'),
        falseConfidenceDescription: t(
          'zoneQuadrantFalseConfidenceDescription',
        ),
      }}
    />
  );
}
