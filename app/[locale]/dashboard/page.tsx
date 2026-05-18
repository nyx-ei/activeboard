import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { DashboardViewShell } from '@/components/dashboard/dashboard-view-shell';
import type { DashboardPerformanceViewProps } from '@/components/dashboard/dashboard-performance-view';
import type { DashboardProgressStateZoneProps } from '@/components/dashboard/dashboard-progress-state-zone';
import type { DashboardSessionsViewProps } from '@/components/dashboard/dashboard-sessions-view';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import {
  getTrialProgressSnapshot,
  getUserBillingSnapshot,
} from '@/lib/billing/user-tier';
import {
  getUserAccessState,
  hasUserTierCapability,
} from '@/lib/billing/gating';
import {
  getDashboardPerformanceData,
  getDashboardSessionsData,
} from '@/lib/demo/data';

import {
  cancelDashboardSessionAction,
  createDashboardSessionAction,
  joinSessionByCodeAction,
} from './actions';

type DashboardPageProps = {
  params: { locale: string };
  searchParams: {
    feedbackMessage?: string;
    feedbackTone?: string;
    feedbackId?: string;
    view?: string;
    groupId?: string;
    sessionJoinFeedback?: string;
  };
};

export default async function DashboardPage({
  params,
  searchParams,
}: DashboardPageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('Dashboard');
  const feedbackT = await getTranslations('Feedback');

  if (searchParams.view === 'group' && searchParams.groupId) {
    redirect(`/${locale}/groups/${searchParams.groupId}`);
  }

  const view = searchParams.view === 'performance' ? 'performance' : 'sessions';
  const isSessionsView = view === 'sessions';
  const isSessionJoinFeedback =
    isSessionsView &&
    searchParams.sessionJoinFeedback === '1' &&
    Boolean(searchParams.feedbackMessage);

  const [sessionsData, performanceData, accessState, billingSnapshot] =
    await Promise.all([
      isSessionsView ? getDashboardSessionsData(user) : Promise.resolve(null),
      getDashboardPerformanceData(user.id),
      getUserAccessState(user.id),
      getUserBillingSnapshot(user.id),
    ]);

  const canJoinSessions = hasUserTierCapability(accessState, 'canJoinSessions');
  const canCreateSession = hasUserTierCapability(
    accessState,
    'canCreateSession',
  );
  const trialProgress = getTrialProgressSnapshot(
    billingSnapshot?.questions_answered ?? 0,
  );

  const sessionsProps = {
    locale,
    sessions: sessionsData?.sessions ?? [],
    groups: (sessionsData?.groups ?? []).map((group) => ({
      id: group.id,
      name: group.name,
      memberCount: group.memberCount,
    })),
    trialProgress,
    canJoinSessions,
    canCreateSession,
    cancelSessionAction: cancelDashboardSessionAction,
    joinSessionAction: joinSessionByCodeAction,
    createSessionAction: createDashboardSessionAction,
    sessionJoinFeedback:
      isSessionJoinFeedback &&
      searchParams.feedbackMessage &&
      searchParams.feedbackTone
        ? {
            tone: searchParams.feedbackTone === 'success' ? 'success' : 'error',
            message: searchParams.feedbackMessage,
          }
        : null,
    labels: {
      sessions: t('sessions'),
      newSession: t('newSession'),
      createSession: t('createSession'),
      createSessionPending: t('createSessionPending'),
      groupName: t('groupName'),
      sessionName: t('sessionName'),
      sessionNamePlaceholder: t('sessionNamePlaceholder'),
      questionCount: t('questionCount'),
      timerMode: t('timerMode'),
      perQuestionMode: t('perQuestionMode'),
      globalMode: t('globalMode'),
      timerSeconds: t('timerSeconds'),
      totalTimerSeconds: t('totalTimerSeconds'),
      modalHint: t('modalHint'),
      close: t('close'),
      noSessionCta: t('noSessionCta'),
      sessionCodePlaceholder: t('sessionCodePlaceholder'),
      go: t('go'),
      goPending: t('goPending'),
      upgradeRequiredToJoinSession: feedbackT('upgradeRequiredToJoinSession'),
      share: t('shareSession'),
      delete: t('deleteSession'),
      copied: t('copied'),
      statusScheduled: t('statusScheduled'),
      statusActive: t('statusActive'),
      statusCompleted: t('statusCompleted'),
      statusIncomplete: t('statusIncomplete'),
      statusCancelled: t('statusCancelled'),
      soloSessionProgressHint: t('soloSessionProgressHint'),
      groupAccessHint: t('groupAccessHint'),
      trialProgressTitle: t('trialProgressTitle'),
      trialProgressSummary: t('trialProgressSummary', {
        current: '{current}',
        total: '{total}',
      }),
      trialProgressDescription: t('trialProgressDescription', {
        remaining: '{remaining}',
      }),
      trialProgressWarning: t('trialProgressWarning', {
        remaining: '{remaining}',
      }),
      trialProgressComplete: t('trialProgressComplete'),
    },
  } satisfies DashboardSessionsViewProps;

  const performanceProps = {
    answeredCount: performanceData?.metrics.answeredCount ?? 0,
    completedSessionsCount:
      performanceData?.metrics.completedSessionsCount ?? 0,
    successRate: performanceData?.metrics.successRate ?? null,
    averageConfidence: performanceData?.metrics.averageConfidence ?? null,
    heatmap: performanceData?.profileAnalytics.heatmap ?? [],
    blueprintGrid: performanceData?.profileAnalytics.blueprintGrid ?? [],
    errorTypeBreakdown:
      performanceData?.profileAnalytics.errorTypeBreakdown ?? [],
    weeklyTrend: performanceData?.profileAnalytics.weeklyTrend ?? [],
    confidenceCalibration:
      performanceData?.profileAnalytics.confidenceCalibration ?? [],
    sessionConfidenceBreakdown:
      performanceData?.sessionConfidenceBreakdown ?? [],
    progressQuadrantQuestions: performanceData?.progressQuadrantQuestions ?? [],
    labels: {
      sprintActivityTitle: t('sprintActivityTitle'),
      questionsAnswered: t('questionsAnswered'),
      heatmapAvailableAfterSessions: t('heatmapAvailableAfterSessions'),
      certaintyTitle: t('certaintyTitle'),
      confidenceLow: t('confidenceLow'),
      confidenceMedium: t('confidenceMedium'),
      confidenceHigh: t('confidenceHigh'),
      confidenceAfterNextSession: t('confidenceAfterNextSession'),
      noData: t('noData'),
      weekdays: [
        t('weekdayShortMonday'),
        t('weekdayShortTuesday'),
        t('weekdayShortWednesday'),
        t('weekdayShortThursday'),
        t('weekdayShortFriday'),
        t('weekdayShortSaturday'),
        t('weekdayShortSunday'),
      ],
      monthLabels: [
        t('monthJanuary'),
        t('monthFebruary'),
        t('monthMarch'),
        t('monthApril'),
        t('monthMay'),
        t('monthJune'),
        t('monthJuly'),
        t('monthAugust'),
        t('monthSeptember'),
        t('monthOctober'),
        t('monthNovember'),
        t('monthDecember'),
      ],
      none: t('heatmapNone'),
      less: t('heatmapLess'),
      more: t('heatmapMore'),
      sessionsFinishedOne: t('sessionsFinished', { count: 1 }),
      sessionsFinishedOther: t('sessionsFinished', { count: 2 }),
      averagePerWeek: t('averagePerWeek'),
      completion: t('completion'),
      confidenceCalibrationTitle: t('confidenceCalibrationTitle'),
      detailsTitle: t('zoneDetailsTitle'),
      quadrantQuestionListsTitle: t('zoneQuadrantQuestionListsTitle'),
      blueprintHeatmapTitle: t('zoneBlueprintHeatmapTitle'),
      errorTypeFrequenciesTitle: t('zoneErrorTypeFrequenciesTitle'),
      trendDetailsTitle: t('zoneTrendDetailsTitle'),
      recentQuestionsEmpty: t('zoneRecentQuestionsEmpty'),
      selectedOption: t('zoneSelectedOption'),
      correct: t('zoneCorrect'),
      incorrect: t('zoneIncorrect'),
      trueMastery: t('zoneQuadrantTrueMastery'),
      fragileKnowledge: t('zoneQuadrantFragileKnowledge'),
      consciousGap: t('zoneQuadrantConsciousGap'),
      falseConfidence: t('zoneQuadrantFalseConfidence'),
    },
  } satisfies DashboardPerformanceViewProps;
  const sprintActivityProps = {
    answeredCount: performanceData.metrics.answeredCount,
    completedSessionsCount: performanceData.metrics.completedSessionsCount,
    trueMastery: performanceData.metrics.successRate,
    heatmap: performanceData.profileAnalytics.heatmap,
    labels: {
      title: t('zoneSprintActivityTitle'),
      counter: t('zoneSprintCounter', {
        sprint: '{sprint}',
        week: '{week}',
        totalWeeks: '{totalWeeks}',
      }),
      sprint: t('zoneSprintLabel'),
      week: t('zoneSprintWeekLabel'),
      questionsAnswered: t('zoneKpiQuestionsAnswered'),
      sessionsCompleted: t('zoneKpiSessionsCompleted'),
      trueMastery: t('zoneKpiTrueMastery'),
      consistencyStreak: t('zoneKpiConsistencyStreak'),
      heatmapTitle: t('zoneHeatmapTitle'),
      heatmapDescription: t('zoneHeatmapDescription'),
      heatmapLow: t('zoneHeatmapLow'),
      heatmapMedium: t('zoneHeatmapMedium'),
      heatmapHigh: t('zoneHeatmapHigh'),
      days: t('zoneKpiDays'),
      noData: t('noData'),
    },
  };
  const progressStateProps = {
    quadrants: performanceData.progressQuadrants,
    detailsHref: `/${locale}/dashboard?view=performance`,
    labels: {
      title: t('zoneProgressStateTitle'),
      subtitle: t('zoneProgressStateSubtitle'),
      viewDetails: t('zoneViewDetails'),
      noData: t('noData'),
      answers: t('zoneProgressStateAnswers'),
      trendUp: t('zoneProgressStateTrendUp', { value: '{value}' }),
      trendDown: t('zoneProgressStateTrendDown', { value: '{value}' }),
      trendFlat: t('zoneProgressStateTrendFlat'),
      trendUnavailable: t('zoneProgressStateTrendUnavailable'),
      trueMastery: t('zoneQuadrantTrueMastery'),
      trueMasteryDescription: t('zoneQuadrantTrueMasteryDescription'),
      fragileKnowledge: t('zoneQuadrantFragileKnowledge'),
      fragileKnowledgeDescription: t('zoneQuadrantFragileKnowledgeDescription'),
      consciousGap: t('zoneQuadrantConsciousGap'),
      consciousGapDescription: t('zoneQuadrantConsciousGapDescription'),
      falseConfidence: t('zoneQuadrantFalseConfidence'),
      falseConfidenceDescription: t('zoneQuadrantFalseConfidenceDescription'),
    },
  } satisfies DashboardProgressStateZoneProps;
  return (
    <main className="flex flex-1 flex-col gap-5">
      <FeedbackBanner
        message={
          isSessionJoinFeedback ? undefined : searchParams.feedbackMessage
        }
        tone={isSessionJoinFeedback ? undefined : searchParams.feedbackTone}
        feedbackId={isSessionJoinFeedback ? undefined : searchParams.feedbackId}
      />

      <section className="mx-auto w-full max-w-[1100px] space-y-4">
        <DashboardViewShell
          initialView={view}
          sessionsProps={sessionsProps}
          performanceProps={performanceProps}
          sprintActivityProps={sprintActivityProps}
          progressStateProps={progressStateProps}
          initialLoadedViews={{
            sessions: isSessionsView,
            performance: !isSessionsView,
          }}
        />
      </section>
    </main>
  );
}
