import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import type { DashboardGroupZoneProps } from '@/components/dashboard/dashboard-group-zone';
import { DashboardViewShell } from '@/components/dashboard/dashboard-view-shell';
import type { DashboardPerformanceViewProps } from '@/components/dashboard/dashboard-performance-view';
import type { DashboardSessionsViewProps } from '@/components/dashboard/dashboard-sessions-view';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import {
  canAccessAdminConsole,
  canAccessOpsDashboard,
} from '@/lib/admin/access';
import {
  getUserAccessState,
  hasUserTierCapability,
} from '@/lib/billing/gating';
import {
  getDashboardPerformanceSummaryData,
  getDashboardSessionsData,
} from '@/lib/demo/data';
import { getOnboardingCompletion } from '@/lib/onboarding/completion';
import { expirePastScheduledSessionsForUser } from '@/lib/session/expired-sessions';
import { ensureInitialTestSessions } from '@/lib/session/initial-test-sessions';
import { getPlanNextAccess } from '@/lib/session/plan-next-access';

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

  const isSessionJoinFeedback =
    searchParams.sessionJoinFeedback === '1' &&
    Boolean(searchParams.feedbackMessage);

  const accessState = await getUserAccessState(user.id);

  const onboarding = await getOnboardingCompletion(user.id, locale);
  if (onboarding.nextPath) {
    redirect(onboarding.nextPath);
  }

  await expirePastScheduledSessionsForUser(user.id);
  await ensureInitialTestSessions(user, accessState.policy, {
    skipExpiration: true,
  });

  const [sessionsData, performanceData, planNextAccess] = await Promise.all([
    getDashboardSessionsData(user),
    getDashboardPerformanceSummaryData(user.id),
    getPlanNextAccess(user.id, accessState.policy),
  ]);
  const canOpenAdminConsole = canAccessAdminConsole(user.email);
  const canOpenOpsDashboard = canAccessOpsDashboard(user.email);

  const canJoinSessions = hasUserTierCapability(accessState, 'canJoinSessions');
  const canCreateSession = hasUserTierCapability(
    accessState,
    'canCreateSession',
  );
  const canBrowseLookupLayer = hasUserTierCapability(
    accessState,
    'canBrowseLookupLayer',
  );
  const liveGroupIds = new Set(
    (sessionsData?.activeSessions ?? []).map((session) => session.group_id),
  );
  const dashboardGroups = (sessionsData?.groups ?? []).map((group) => ({
    id: group.id,
    name: group.name,
    memberCount: group.memberCount,
    maxMembers: group.maxMembers,
    membersPreview: group.membersPreview,
    hasLiveSession: liveGroupIds.has(group.id),
    activeSession: group.activeSession,
    nextSession: group.nextSession,
    recentSessions: group.recentSessions,
  }));

  const sessionsProps = {
    locale,
    sessions: sessionsData?.sessions ?? [],
    groups: dashboardGroups,
    canJoinSessions,
    canCreateSession,
    sessionPolicy: {
      defaultQuestionGoal: accessState.policy.defaultQuestionGoal,
      maxQuestionGoal: accessState.policy.maxQuestionGoal,
      perQuestionTimerDefaultSeconds:
        accessState.policy.perQuestionTimerDefaultSeconds,
      globalTimerDefaultSeconds:
        accessState.policy.globalTimerDefaultSeconds,
      maxTimerSeconds: accessState.policy.maxTimerSeconds,
      minimumGroupMembersToStart:
        accessState.policy.minimumGroupMembersToStart,
    },
    planNextAccess,
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
      scheduledAt: t('scheduledAt'),
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
      statusExpired: locale === 'fr' ? 'Expirée' : 'Expired',
      soloSessionProgressHint: t('soloSessionProgressHint'),
      groupAccessHint: t('groupAccessHint'),
      availabilityRefresh: t('availabilityRefresh'),
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
    },
  };
  const trueMasteryQuadrant = performanceData.progressQuadrants.find(
    (quadrant) => quadrant.key === 'trueMastery',
  );
  const falseConfidenceQuadrant = performanceData.progressQuadrants.find(
    (quadrant) => quadrant.key === 'falseConfidence',
  );
  const groupZoneProps = {
    locale,
    groups: dashboardGroups,
    initialGroupId: searchParams.groupId,
    createGroupHref: `/${locale}/create-group`,
    liveGroupsHref: `/${locale}/lookup`,
    canBrowseLookupLayer,
    calibrationStats: {
      trueMasteryPercent: trueMasteryQuadrant?.percentage ?? 0,
      falseConfidencePercent: falseConfidenceQuadrant?.percentage ?? 0,
    },
    labels: {
      title: t('zoneGroupTitle'),
      subtitle: t('zoneGroupSubtitle'),
      dropdownLabel: t('zoneGroupDropdownLabel'),
      groupsListTitle: t('zoneGroupGroupsListTitle'),
      manageMembers: t('zoneGroupManageMembers'),
      scheduleSession: t('zoneGroupScheduleSession'),
      groupNotifications: t('zoneGroupNotifications'),
      leaveGroup: t('zoneGroupLeaveGroup'),
      manageMembersTitle: t('zoneGroupManageMembersTitle'),
      manageMembersDescription: t('zoneGroupManageMembersDescription'),
      confirmedMembers: t('zoneGroupConfirmedMembers'),
      seatsAvailable: t('zoneGroupSeatsAvailable'),
      notificationsTitle: t('zoneGroupNotificationsTitle'),
      notificationsDescription: t('zoneGroupNotificationsDescription'),
      notificationsEmpty: t('zoneGroupNotificationsEmpty'),
      notificationsUnread: t('zoneGroupNotificationsUnread', {
        count: '{count}',
      }),
      notificationsLoading: t('zoneGroupNotificationsLoading'),
      leaveGroupTitle: t('zoneGroupLeaveGroupTitle'),
      leaveGroupDescription: t('zoneGroupLeaveGroupDescription', {
        group: '{group}',
      }),
      leaveGroupConfirm: t('zoneGroupLeaveGroupConfirm'),
      leaveGroupPending: t('zoneGroupLeaveGroupPending'),
      leaveGroupSuccess: t('zoneGroupLeaveGroupSuccess'),
      leaveGroupBlocked: t('zoneGroupLeaveGroupBlocked'),
      members: t('zoneGroupMembers'),
      live: t('zoneGroupLive'),
      noGroups: t('zoneGroupNoGroups'),
      createAnother: t('zoneGroupCreateAnother'),
      seats: t('zoneGroupSeats'),
      nextSession: t('zoneGroupNextSession'),
      scheduledFor: t('scheduledFor', { date: '{date}' }),
      noUpcomingSession: t('zoneGroupNoUpcomingSession'),
      openSession: t('openSession'),
      joinLiveSession: t('joinSession'),
      timerLabel: t('timerLabel', { seconds: '{seconds}' }),
      captain: t('captainLabel'),
      questionsUnit: t('questionsUnit'),
      completion: t('completion'),
      accuracy: t('accuracy'),
      trueMastery: t('zoneQuadrantTrueMastery'),
      falseConfidence: t('zoneQuadrantFalseConfidence'),
      noData: t('noData'),
      invite: t('inviteTeammateOpen'),
      inviteTitle: t('inviteTeammateModalTitle'),
      inviteDescription: t('inviteTeammateModalDescription'),
      inviteEmailPlaceholder: t('inviteTeammateEmailPlaceholder'),
      inviteSend: t('inviteTeammateSend'),
      inviteSending: t('inviteTeammateSending'),
      inviteSuccess: t('inviteTeammateSuccess'),
      invalidEmail: t('invalidEmail'),
      inviteExists: t('inviteExists'),
      alreadyMember: t('alreadyMember'),
      cannotInviteSelf: t('cannotInviteSelf'),
      emailUnavailable: t('emailUnavailable'),
      actionFailed: feedbackT('actionFailed'),
      startSession: t('zoneGroupStartSession'),
      editSession: t('editSession'),
      cancelSession: t('cancelSession'),
      cancelSessionSuccess: t('cancelSessionSuccess'),
      memberRequirementPrompt: t('memberRequirementPrompt', {
        count: '{count}',
      }),
      exploreLiveGroupsTitle: t('zoneGroupExploreLiveTitle'),
      exploreLiveGroupsDescription: t('zoneGroupExploreLiveDescription'),
      exploreLiveGroupsLockedTitle: t('zoneGroupExploreLiveLockedTitle'),
      exploreLiveGroupsLockedDescription: t(
        'zoneGroupExploreLiveLockedDescription',
      ),
      exploreLiveGroupsCta: t('zoneGroupExploreLiveCta'),
      exploreLiveGroupsUpgrade: t('zoneGroupExploreLiveUpgrade'),
    },
  } satisfies DashboardGroupZoneProps;

  return (
    <main className="flex flex-1 flex-col gap-5 bg-[#00100f]">
      <FeedbackBanner
        message={
          isSessionJoinFeedback ? undefined : searchParams.feedbackMessage
        }
        tone={isSessionJoinFeedback ? undefined : searchParams.feedbackTone}
        feedbackId={isSessionJoinFeedback ? undefined : searchParams.feedbackId}
      />

      <section className="mx-auto w-full max-w-[1440px] px-3 py-0 sm:px-2">
        <DashboardViewShell
          sessionsProps={sessionsProps}
          performanceProps={performanceProps}
          sprintActivityProps={sprintActivityProps}
          groupZoneProps={groupZoneProps}
          canOpenAdminConsole={canOpenAdminConsole}
          canOpenOpsDashboard={canOpenOpsDashboard}
        />
      </section>
    </main>
  );
}
