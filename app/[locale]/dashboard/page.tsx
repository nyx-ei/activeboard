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
  createDashboardSessionAction,
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

  const [sessionsData, performanceData, accessState, billingSnapshot] = await Promise.all([
    isSessionsView ? getDashboardSessionsData(user) : null,
    isPerformanceView ? getDashboardPerformanceData(user.id) : null,
    getUserAccessState(user.id),
    getUserBillingSnapshot(user.id),
  ]);

  const canJoinSessions = hasUserTierCapability(accessState, 'canJoinSessions');
  const canCreateSession = hasUserTierCapability(accessState, 'canCreateSession');
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
            groups={(sessionsData?.groups ?? []).map((group) => ({
              id: group.id,
              name: group.name,
              memberCount: group.memberCount,
            }))}
            trialProgress={trialProgress}
            canJoinSessions={canJoinSessions}
            canCreateSession={canCreateSession}
            cancelSessionAction={cancelDashboardSessionAction}
            joinSessionAction={joinSessionByCodeAction}
            createSessionAction={createDashboardSessionAction}
            labels={{
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
              trialProgressSummary: t('trialProgressSummary', { current: '{current}', total: '{total}' }),
              trialProgressDescription: t('trialProgressDescription', { remaining: '{remaining}' }),
              trialProgressWarning: t('trialProgressWarning', { remaining: '{remaining}' }),
              trialProgressComplete: t('trialProgressComplete'),
            }}
          />
        ) : null}

        {isPerformanceView ? (
          <DashboardPerformanceView
            answeredCount={performanceData?.metrics.answeredCount ?? 0}
            successRate={performanceData?.metrics.successRate ?? null}
            averageConfidence={performanceData?.metrics.averageConfidence ?? null}
            heatmap={performanceData?.profileAnalytics.heatmap ?? []}
            confidenceCalibration={performanceData?.profileAnalytics.confidenceCalibration ?? []}
            labels={{
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
              averagePerWeek: t('averagePerWeek'),
              confidenceCalibrationTitle: t('confidenceCalibrationTitle'),
            }}
          />
        ) : null}
      </section>
    </main>
  );
}
