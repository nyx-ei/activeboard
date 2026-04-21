import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { RealtimeRefresh } from '@/components/app/realtime-refresh';
import { DashboardPerformanceView } from '@/components/dashboard/dashboard-performance-view';
import { DashboardSessionsView } from '@/components/dashboard/dashboard-sessions-view';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
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

  if (searchParams.view === 'group' && searchParams.groupId) {
    redirect(`/${locale}/groups/${searchParams.groupId}`);
  }

  const view = searchParams.view === 'performance' ? 'performance' : 'sessions';
  const isPerformanceView = view === 'performance';
  const isSessionsView = view === 'sessions';

  const [sessionsData, performanceData, accessState] = await Promise.all([
    isSessionsView ? getDashboardSessionsData(user) : null,
    isPerformanceView ? getDashboardPerformanceData(user.id) : null,
    getUserAccessState(user.id),
  ]);

  const canJoinSessions = hasUserTierCapability(accessState, 'canJoinSessions');
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
            heatmap={performanceData?.profileAnalytics.heatmap ?? []}
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
            }}
          />
        ) : null}
      </section>
    </main>
  );
}
