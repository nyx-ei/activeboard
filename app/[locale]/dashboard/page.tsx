import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { RealtimeRefresh } from '@/components/app/realtime-refresh';
import { DashboardPerformanceView } from '@/components/dashboard/dashboard-performance-view';
import { DashboardSessionsView } from '@/components/dashboard/dashboard-sessions-view';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { getUserBillingSnapshot, TRIAL_QUESTION_LIMIT } from '@/lib/billing/user-tier';
import { getUserAccessState, hasUserTierCapability } from '@/lib/billing/gating';
import { getDashboardPerformanceData, getDashboardSessionsData } from '@/lib/demo/data';

import {
  cancelDashboardSessionAction,
  joinSessionByCodeAction,
} from './actions';

type DashboardPageProps = {
  params: { locale: string };
  searchParams: {
    feedbackMessage?: string;
    feedbackTone?: string;
    view?: string;
    groupId?: string;
  };
};

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('Dashboard');
  const feedbackT = await getTranslations('Feedback');
  const sessionSummaryT = await getTranslations('SessionSummary');

  if (searchParams.view === 'group' && searchParams.groupId) {
    redirect(`/${locale}/groups/${searchParams.groupId}`);
  }

  const view = searchParams.view === 'performance' ? 'performance' : 'sessions';
  const isPerformanceView = view === 'performance';
  const isSessionsView = view === 'sessions';

  const [sessionsData, performanceData, accessState, billingSnapshot] = await Promise.all([
    isSessionsView ? getDashboardSessionsData(user) : null,
    isPerformanceView ? getDashboardPerformanceData(user.id) : null,
    getUserAccessState(user.id),
    getUserBillingSnapshot(user.id),
  ]);

  const canJoinSessions = hasUserTierCapability(accessState, 'canJoinSessions');
  const trialProgress = {
    current: Math.min(billingSnapshot?.questions_answered ?? 0, TRIAL_QUESTION_LIMIT),
    total: TRIAL_QUESTION_LIMIT,
    remaining: Math.max(TRIAL_QUESTION_LIMIT - (billingSnapshot?.questions_answered ?? 0), 0),
    showWarning: (billingSnapshot?.questions_answered ?? 0) >= 85 && (billingSnapshot?.questions_answered ?? 0) < TRIAL_QUESTION_LIMIT,
    isComplete: (billingSnapshot?.questions_answered ?? 0) >= TRIAL_QUESTION_LIMIT,
  };
  const activeGroupId =
    sessionsData?.groups.find((group) => group.is_founder)?.id ?? sessionsData?.groups[0]?.id ?? null;

  return (
    <main className="flex flex-1 flex-col gap-5">
      {activeGroupId ? (
        <RealtimeRefresh
          channelName={`dashboard:${activeGroupId}`}
          tables={[
            { table: 'group_members', filter: `group_id=eq.${activeGroupId}` },
            { table: 'group_weekly_schedules', filter: `group_id=eq.${activeGroupId}` },
            { table: 'sessions', filter: `group_id=eq.${activeGroupId}` },
          ]}
          throttleMs={700}
        />
      ) : null}

      <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />

      <section className="mx-auto w-full max-w-[620px] space-y-4">
        {isSessionsView ? (
          <DashboardSessionsView
            locale={locale}
            sessions={sessionsData?.sessions ?? []}
            trialProgress={trialProgress}
            weeklyCompletedQuestions={sessionsData?.groupDashboard.weeklyCompletedQuestions ?? 0}
            weeklyTargetQuestions={sessionsData?.groupDashboard.weeklyTargetQuestions ?? 0}
            weeklyProgressPercentage={sessionsData?.groupDashboard.weeklyProgressPercentage ?? 0}
            canJoinSessions={canJoinSessions}
            cancelSessionAction={cancelDashboardSessionAction}
            joinSessionAction={joinSessionByCodeAction}
            labels={{
              weeklyProgressTitle: t('weeklyProgressTitle'),
              prequalification: t('prequalificationBadge'),
              classGoal: t('classGoal'),
              sessions: t('sessions'),
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
              questionCounter: '{completed} / {total}',
              reliableGroupsGoal: t('reliableGroupsGoal'),
              minimumMembersWarning: t('minimumMembersWarning'),
              soloSessionProgressHint: t('soloSessionProgressHint'),
              groupAccessHint: t('groupAccessHint'),
              trialProgressTitle: t('trialProgressTitle'),
              trialProgressSummary: t('trialProgressSummary'),
              trialProgressDescription: t('trialProgressDescription'),
              trialProgressWarning: t('trialProgressWarning'),
              trialProgressComplete: t('trialProgressComplete'),
            }}
          />
        ) : null}

        {isPerformanceView ? (
          <DashboardPerformanceView
            answeredCount={performanceData?.metrics.answeredCount ?? 0}
            completedSessionsCount={performanceData?.metrics.completedSessionsCount ?? 0}
            successRate={performanceData?.metrics.successRate ?? null}
            errorRate={performanceData?.metrics.errorRate ?? null}
            averageConfidence={performanceData?.metrics.averageConfidence ?? null}
            trialProgress={performanceData?.profileAnalytics.trialProgress ?? trialProgress}
            heatmap={performanceData?.profileAnalytics.heatmap ?? []}
            physicianActivityAccuracy={performanceData?.profileAnalytics.physicianActivityAccuracy ?? []}
            dimensionOfCareAccuracy={performanceData?.profileAnalytics.dimensionOfCareAccuracy ?? []}
            blueprintGrid={performanceData?.profileAnalytics.blueprintGrid ?? []}
            confidenceCalibration={performanceData?.profileAnalytics.confidenceCalibration ?? []}
            errorTypeBreakdown={performanceData?.profileAnalytics.errorTypeBreakdown ?? []}
            weeklyTrend={performanceData?.profileAnalytics.weeklyTrend ?? []}
            labels={{
              sprintActivityTitle: t('sprintActivityTitle'),
              questionsAnswered: t('questionsAnswered'),
              sessionsFinished: t('sessionsFinished', { count: performanceData?.metrics.completedSessionsCount ?? 0 }),
              heatmapAvailableAfterSessions: t('heatmapAvailableAfterSessions'),
              certaintyTitle: t('certaintyTitle'),
              confidenceLow: t('confidenceLow'),
              confidenceMedium: t('confidenceMedium'),
              confidenceHigh: t('confidenceHigh'),
              confidenceAfterNextSession: t('confidenceAfterNextSession'),
              errorTitle: t('errorTitle'),
              errorAfterThreeSessions: t('errorAfterThreeSessions'),
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
              averagePerWeek: t('averagePerWeek'),
              completion: t('completion'),
              share: t('shareSession'),
              trialProgressTitle: t('trialProgressTitle'),
              trialProgressSummary: t('trialProgressSummary'),
              trialProgressDescription: t('trialProgressDescription'),
              trialProgressWarning: t('trialProgressWarning'),
              trialProgressComplete: t('trialProgressComplete'),
              trendTitle: t('trendTitle'),
              trendDescription: t('trendDescription'),
              trendAccuracyValue: t('trendAccuracyValue', { accuracy: '{accuracy}', count: '{count}' }),
              trendEmpty: t('trendEmpty'),
              physicianActivityTitle: t('physicianActivityTitle'),
              dimensionOfCareTitle: t('dimensionOfCareTitle'),
              accuracyValue: t('accuracyValue', { accuracy: '{accuracy}', count: '{count}' }),
              confidenceCalibrationTitle: t('confidenceCalibrationTitle'),
              errorTypesTitle: t('errorTypesTitle'),
              errorTypesEmpty: t('errorTypesEmpty'),
              errorTypeCount: t('errorTypeCount', { count: '{count}' }),
              blueprintGridTitle: t('blueprintGridTitle'),
              blueprintGridDescription: t('blueprintGridDescription'),
              physicianActivityLabels: {
                history_taking: sessionSummaryT('physicianActivity.history_taking'),
                physical_exam: sessionSummaryT('physicianActivity.physical_exam'),
                investigation: sessionSummaryT('physicianActivity.investigation'),
                management: sessionSummaryT('physicianActivity.management'),
                communication: sessionSummaryT('physicianActivity.communication'),
                ethics: sessionSummaryT('physicianActivity.ethics'),
              },
              dimensionOfCareLabels: {
                diagnosis: sessionSummaryT('dimensionOfCare.diagnosis'),
                acute_care: sessionSummaryT('dimensionOfCare.acute_care'),
                chronic_care: sessionSummaryT('dimensionOfCare.chronic_care'),
                prevention: sessionSummaryT('dimensionOfCare.prevention'),
                follow_up: sessionSummaryT('dimensionOfCare.follow_up'),
                professionalism: sessionSummaryT('dimensionOfCare.professionalism'),
              },
              errorTypeLabels: {
                knowledge_gap: sessionSummaryT('errorType.knowledge_gap'),
                misread_question: sessionSummaryT('errorType.misread_question'),
                premature_closure: sessionSummaryT('errorType.premature_closure'),
                confidence_mismatch: sessionSummaryT('errorType.confidence_mismatch'),
                time_pressure: sessionSummaryT('errorType.time_pressure'),
                careless_mistake: sessionSummaryT('errorType.careless_mistake'),
              },
            }}
          />
        ) : null}
      </section>
    </main>
  );
}
