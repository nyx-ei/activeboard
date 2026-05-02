import { getTranslations } from 'next-intl/server';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { GroupPageView } from '@/components/groups/group-page-view';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import {
  getUserAccessState,
  hasUserTierCapability,
} from '@/lib/billing/gating';
import { getGroupCoreData } from '@/lib/demo/data';

import {
  addDashboardExistingMemberAction,
  addDashboardWeeklyScheduleAction,
  cancelDashboardSessionAction,
  createGroupSessionAction,
  deleteDashboardWeeklyScheduleAction,
  joinGroupAction,
  updateDashboardGroupDetailsAction,
  updateDashboardWeeklySchedulesAction,
} from '../../dashboard/actions';

function getInitials(value: string) {
  return (
    value
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'AB'
  );
}

export default async function GroupRoutePage({
  params,
  searchParams,
}: {
  params: { locale: string; groupId: string };
  searchParams: {
    feedbackMessage?: string;
    feedbackTone?: string;
    feedbackId?: string;
    live?: string;
  };
}) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const [t, accessState, data] = await Promise.all([
    getTranslations('Dashboard'),
    getUserAccessState(user.id),
    getGroupCoreData(params.groupId, user),
  ]);
  const canBrowseLookupLayer = hasUserTierCapability(
    accessState,
    'canBrowseLookupLayer',
  );
  const canCreateSession = hasUserTierCapability(
    accessState,
    'canCreateSession',
  );

  if (!data) {
    return null;
  }

  const primaryGroup = data.group;
  const currentCaptainId = data.currentCaptainId;

  const examSession =
    typeof user.user_metadata.exam_session === 'string'
      ? user.user_metadata.exam_session
      : '';
  const displayName =
    user.user_metadata.full_name ?? user.email ?? 'ActiveBoard';
  const examSessionLabel =
    examSession === 'april_may_2026'
      ? t('examAprilMay2026')
      : examSession === 'august_september_2026'
        ? t('examAugustSeptember2026')
        : examSession === 'october_2026'
          ? t('examOctober2026')
          : examSession === 'planning_ahead'
            ? t('examPlanningAhead')
            : t('examSessionUndefined');
  const groupInfoSummary = primaryGroup
    ? [primaryGroup.invite_code, examSessionLabel].join(' | ')
    : t('noData');

  const weekdayLabels = {
    monday: t('weekdayMonday'),
    tuesday: t('weekdayTuesday'),
    wednesday: t('weekdayWednesday'),
    thursday: t('weekdayThursday'),
    friday: t('weekdayFriday'),
    saturday: t('weekdaySaturday'),
    sunday: t('weekdaySunday'),
  };
  return (
    <main className="flex flex-1 flex-col gap-5">
      <FeedbackBanner
        message={searchParams.feedbackMessage}
        tone={searchParams.feedbackTone}
        feedbackId={searchParams.feedbackId}
      />

      <section className="mx-auto w-full max-w-[620px] space-y-4">
        <GroupPageView
          locale={locale}
          shellGroups={[]}
          currentUserInitials={getInitials(displayName)}
          canBrowseLookupLayer={canBrowseLookupLayer}
          initialLiveOpen={searchParams.live === '1'}
          primaryGroup={primaryGroup}
          isPrimaryGroupFounder={Boolean(data.membership.is_founder)}
          currentCaptainId={currentCaptainId}
          schedules={data.weeklySchedules}
          initialWeeklyProgress={null}
          memberPerformance={[]}
          weekdayLabels={weekdayLabels}
          groupInfoSummary={groupInfoSummary}
          sessions={data.sessions}
          canCreateSession={canCreateSession}
          labels={{
            myGroups: t('myGroups'),
            activeGroup: t('activeGroup'),
            selectGroupHint: t('selectGroupHint'),
            noSchedule: t('noSchedule'),
            newSession: t('newSession'),
            createSession: t('createSession'),
            createSessionPending: t('createSessionPending'),
            sessionName: t('sessionName'),
            sessionNamePlaceholder: t('sessionNamePlaceholder'),
            questionCount: t('questionCount'),
            timerMode: t('timerMode'),
            perQuestionMode: t('perQuestionMode'),
            globalMode: t('globalMode'),
            timerSeconds: t('timerSeconds'),
            totalTimerSeconds: t('totalTimerSeconds'),
            modalHint: t('modalHint'),
            joinLiveGroups: t('joinLiveGroups'),
            liveGroupsTitle: t('liveGroupsTitle'),
            close: t('close'),
            liveGroupJoin: t('liveGroupJoin'),
            joinGroupPending: t('joinGroupPending'),
            unlimitedPlanRequired: t('unlimitedPlanRequired'),
            unlimitedPlanRequiredDescription: t(
              'unlimitedPlanRequiredDescription',
            ),
            upgrade: t('upgrade'),
            liveGroupsEmpty: t('liveGroupsEmpty'),
            liveGroupRemainingPlaces: t('liveGroupRemainingPlaces', {
              count: '{count}',
            }),
            oneRemainingPlace: t('oneRemainingPlace'),
            liveGroupSecondsAgo: t('liveGroupSecondsAgo', { count: '{count}' }),
            liveGroupMinutesAgo: t('liveGroupMinutesAgo', { count: '{count}' }),
            liveGroupHoursAgo: t('liveGroupHoursAgo', { count: '{count}' }),
            liveGroupDaysAgo: t('liveGroupDaysAgo', { count: '{count}' }),
            liveGroupWeeksAgo: t('liveGroupWeeksAgo', { count: '{count}' }),
            liveGroupMonthsAgo: t('liveGroupMonthsAgo', { count: '{count}' }),
            liveGroupYearsAgo: t('liveGroupYearsAgo', { count: '{count}' }),
            averageWeeklyShort: t('averageWeeklyShort'),
            unknownGroup: t('unknownGroup'),
            meetingLinkRequiredWarning: t('meetingLinkRequiredWarning'),
            editGroup: t('editGroup'),
            editGroupTitle: t('editGroupTitle'),
            cancel: t('cancel'),
            groupName: t('groupName'),
            groupNamePlaceholder: t('groupNamePlaceholder'),
            meetingToolLink: t('meetingToolLink'),
            meetingLinkRequiredPlaceholder: t('meetingLinkRequiredPlaceholder'),
            meetingToolHelper: t('meetingToolHelper'),
            saveNamePending: t('saveNamePending'),
            save: t('save'),
            scheduleAndGoalTitle: t('scheduleAndGoalTitle'),
            scheduleAndGoalDescription: t('scheduleAndGoalDescription'),
            saveSchedulePending: t('saveSchedulePending'),
            questionGoalValue: t('questionGoalValue', { count: '{count}' }),
            removeDay: t('removeDay'),
            groupScheduleEmpty: t('groupScheduleEmpty'),
            weeklyTotal: t('weeklyTotal'),
            membersTitle: t('membersTitle'),
            addExistingMember: t('addExistingMember'),
            email: t('email'),
            existingMemberEmailPlaceholder: t('existingMemberEmailPlaceholder'),
            addMemberPending: t('addMemberPending'),
            addMember: t('addMember'),
            sessionsTitle: t('sessions'),
            noSessionCta: t('noSessionCta'),
            share: t('shareSession'),
            delete: t('deleteSession'),
            copied: t('copied'),
            statusScheduled: t('statusScheduled'),
            statusActive: t('statusActive'),
            statusCompleted: t('statusCompleted'),
            statusIncomplete: t('statusIncomplete'),
            statusCancelled: t('statusCancelled'),
            memberAverageWeekly: t('memberAverageWeekly', { value: '{value}' }),
            memberCompletion: t('memberCompletion', { value: '{value}' }),
            memberTotal: t('memberTotal', { value: '{value}' }),
            captainLabel: t('captainLabel'),
            memberStatusSetup: t('memberStatusSetup'),
            memberStatusActive: t('memberStatusActive'),
            groupViewEmpty: t('groupViewEmpty'),
            groupAccessHint: t('groupAccessHint'),
          }}
          actions={{
            createSessionAction: createGroupSessionAction,
            cancelSessionAction: cancelDashboardSessionAction,
            updateGroupDetailsAction: updateDashboardGroupDetailsAction,
            addWeeklyScheduleAction: addDashboardWeeklyScheduleAction,
            updateWeeklySchedulesAction: updateDashboardWeeklySchedulesAction,
            deleteWeeklyScheduleAction: deleteDashboardWeeklyScheduleAction,
            addExistingMemberAction: addDashboardExistingMemberAction,
            joinGroupAction,
          }}
        />
      </section>
    </main>
  );
}
