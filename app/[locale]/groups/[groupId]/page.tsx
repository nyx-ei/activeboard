import { getTranslations } from 'next-intl/server';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { RealtimeRefresh } from '@/components/app/realtime-refresh';
import { GroupPageView } from '@/components/groups/group-page-view';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { getUserAccessState, hasUserTierCapability } from '@/lib/billing/gating';
import { getGroupData } from '@/lib/demo/data';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import {
  addDashboardExistingMemberAction,
  addDashboardWeeklyScheduleAction,
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
  searchParams: { feedbackMessage?: string; feedbackTone?: string; live?: string };
}) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('Dashboard');
  const accessState = await getUserAccessState(user.id);
  const canBrowseLookupLayer = hasUserTierCapability(accessState, 'canBrowseLookupLayer');

  const [data, currentProfile, memberships] = await Promise.all([
    getGroupData(params.groupId, user),
    createSupabaseServerClient()
      .schema('public')
      .from('users')
      .select('exam_session')
      .eq('id', user.id)
      .maybeSingle()
      .then((result) => result.data),
    createSupabaseServerClient()
      .schema('public')
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
      .then((result) => result.data ?? []),
  ]);

  if (!data) {
    return null;
  }

  const primaryGroup = data.group;
  const currentCaptainId = data.currentCaptainId;

  const examSession =
    currentProfile?.exam_session ?? (typeof user.user_metadata.exam_session === 'string' ? user.user_metadata.exam_session : '');
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
    ? [primaryGroup.invite_code, examSessionLabel, locale === 'fr' ? 'Français' : 'English', 'GMT+1'].join(' · ')
    : t('noData');

  const displayGroupInfoSummary = primaryGroup
    ? [primaryGroup.invite_code, examSessionLabel, locale === 'fr' ? 'Français' : 'English', 'GMT+1'].join(' · ')
    : t('noData');
  void groupInfoSummary;

  const weekdayLabels = {
    monday: t('weekdayMonday'),
    tuesday: t('weekdayTuesday'),
    wednesday: t('weekdayWednesday'),
    thursday: t('weekdayThursday'),
    friday: t('weekdayFriday'),
    saturday: t('weekdaySaturday'),
    sunday: t('weekdaySunday'),
  };
  void displayGroupInfoSummary;
  const sanitizedGroupInfoSummary = primaryGroup
    ? [primaryGroup.invite_code, examSessionLabel, locale === 'fr' ? 'Francais' : 'English', 'GMT+1'].join(' | ')
    : t('noData');

  const currentGroupIds = new Set(memberships.map((membership) => membership.group_id));
  const liveGroups =
    canBrowseLookupLayer && primaryGroup
      ? await (async () => {
          const supabaseAdmin = createSupabaseAdminClient();
          const { data: candidateGroups } = await supabaseAdmin
            .schema('public')
            .from('groups')
            .select('id, name, invite_code, max_members, created_at')
            .order('created_at', { ascending: false })
            .limit(20);
          const availableGroups = (candidateGroups ?? []).filter((group) => !currentGroupIds.has(group.id));
          const availableGroupIds = availableGroups.map((group) => group.id);
          if (availableGroupIds.length === 0) return [];

          const [{ data: memberships }, { data: schedules }] = await Promise.all([
            supabaseAdmin
              .schema('public')
              .from('group_members')
              .select('group_id, user_id')
              .in('group_id', availableGroupIds),
            supabaseAdmin
              .schema('public')
              .from('group_weekly_schedules')
              .select('group_id, question_goal')
              .in('group_id', availableGroupIds),
          ]);

          const ids = [...new Set((memberships ?? []).map((membership) => membership.user_id))];
          const { data: users } =
            ids.length > 0
              ? await supabaseAdmin.schema('public').from('users').select('id, display_name, email').in('id', ids)
              : { data: [] };
          const usersMap = new Map((users ?? []).map((profile) => [profile.id, profile]));

          const membersByGroup = new Map<string, Array<{ user_id: string }>>();
          for (const membership of memberships ?? []) {
            const current = membersByGroup.get(membership.group_id) ?? [];
            current.push({ user_id: membership.user_id });
            membersByGroup.set(membership.group_id, current);
          }

          const weeklyByGroup = new Map<string, number>();
          for (const schedule of schedules ?? []) {
            weeklyByGroup.set(schedule.group_id, (weeklyByGroup.get(schedule.group_id) ?? 0) + schedule.question_goal);
          }

          return availableGroups
            .map((group) => {
              const members = membersByGroup.get(group.id) ?? [];
              return {
                id: group.id,
                name: group.name,
                inviteCode: group.invite_code,
                memberCount: members.length,
                maxMembers: group.max_members,
                language: locale.toUpperCase(),
                timezone: locale === 'fr' ? 'GMT+1' : 'GMT-5',
                weeklyQuestions: weeklyByGroup.get(group.id) ?? 0,
                minutesAgo: Math.max(1, Math.round((Date.now() - new Date(group.created_at).getTime()) / 60000)),
                compatible: true,
                members: members.slice(0, 5).map((member) => {
                  const profile = usersMap.get(member.user_id);
                  const label = profile?.display_name ?? profile?.email ?? 'AB';
                  return { id: member.user_id, initials: getInitials(label) };
                }),
              };
            })
            .filter((group) => group.memberCount < group.maxMembers);
        })()
      : [];

  return (
    <main className="flex flex-1 flex-col gap-5">
      {primaryGroup ? (
        <RealtimeRefresh
          channelName={`dashboard:${primaryGroup.id}`}
          tables={[
            { table: 'group_members', filter: `group_id=eq.${primaryGroup.id}` },
            { table: 'group_weekly_schedules', filter: `group_id=eq.${primaryGroup.id}` },
            { table: 'sessions', filter: `group_id=eq.${primaryGroup.id}` },
          ]}
          throttleMs={700}
        />
      ) : null}

      <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />

      <section className="mx-auto w-full max-w-[620px] space-y-4">
        <GroupPageView
          locale={locale}
          canBrowseLookupLayer={canBrowseLookupLayer}
          initialLiveOpen={searchParams.live === '1'}
          primaryGroup={primaryGroup}
          isPrimaryGroupFounder={Boolean(data.membership.is_founder)}
          currentCaptainId={currentCaptainId}
          schedules={data.weeklySchedules}
          weeklyCompletedQuestions={data.weeklyCompletedQuestions}
          weeklyTargetQuestions={data.weeklyTargetQuestions}
          memberPerformance={data.memberPerformance}
          weekdayLabels={weekdayLabels}
          groupInfoSummary={sanitizedGroupInfoSummary}
          liveGroups={liveGroups}
          labels={{
            joinLiveGroups: t('joinLiveGroups'),
            liveGroupsTitle: t('liveGroupsTitle'),
            close: t('close'),
            liveGroupJoin: t('liveGroupJoin'),
            joinGroupPending: t('joinGroupPending'),
            unlimitedPlanRequired: t('unlimitedPlanRequired'),
            unlimitedPlanRequiredDescription: t('unlimitedPlanRequiredDescription'),
            upgrade: t('upgrade'),
            liveGroupsEmpty: t('liveGroupsEmpty'),
            liveGroupRemainingPlaces: t('liveGroupRemainingPlaces', { count: '{count}' }),
            oneRemainingPlace: t('oneRemainingPlace'),
            liveGroupSecondsAgo: t('liveGroupSecondsAgo', { count: '{count}' }),
            liveGroupMinutesAgo: t('liveGroupMinutesAgo', { count: '{count}' }),
            liveGroupHoursAgo: t('liveGroupHoursAgo', { count: '{count}' }),
            liveGroupDaysAgo: t('liveGroupDaysAgo', { count: '{count}' }),
            liveGroupWeeksAgo: t('liveGroupWeeksAgo', { count: '{count}' }),
            liveGroupMonthsAgo: t('liveGroupMonthsAgo', { count: '{count}' }),
            liveGroupYearsAgo: t('liveGroupYearsAgo', { count: '{count}' }),
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
            memberAverageWeekly: t('memberAverageWeekly', { value: '{value}' }),
            memberCompletion: t('memberCompletion', { value: '{value}' }),
            memberTotal: t('memberTotal', { value: '{value}' }),
            captainLabel: t('captainLabel'),
            memberStatusActive: t('memberStatusActive'),
            groupViewEmpty: t('groupViewEmpty'),
          }}
          actions={{
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
