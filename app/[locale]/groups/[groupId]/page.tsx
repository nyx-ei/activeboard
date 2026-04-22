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
  searchParams: { feedbackMessage?: string; feedbackTone?: string; live?: string };
}) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('Dashboard');
  const accessState = await getUserAccessState(user.id);
  const canBrowseLookupLayer = hasUserTierCapability(accessState, 'canBrowseLookupLayer');
  const canCreateSession = hasUserTierCapability(accessState, 'canCreateSession');

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
  const displayName = user.user_metadata.full_name ?? user.email ?? 'ActiveBoard';
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

  const currentGroupIds = new Set(memberships.map((membership) => membership.group_id));
  const shellGroups =
    memberships.length > 0
      ? await (async () => {
          const supabase = createSupabaseServerClient();
          const supabaseAdmin = createSupabaseAdminClient();
          const groupIds = [...new Set(memberships.map((membership) => membership.group_id))];
          const [{ data: groups }, { data: schedules }, { data: membershipsWithUsers }] = await Promise.all([
            supabase
              .schema('public')
              .from('groups')
              .select('id, name')
              .in('id', groupIds)
              .order('created_at', { ascending: false }),
            supabase
              .schema('public')
              .from('group_weekly_schedules')
              .select('group_id, start_time, end_time, question_goal')
              .in('group_id', groupIds),
            supabaseAdmin.schema('public').from('group_members').select('group_id, user_id').in('group_id', groupIds),
          ]);

          const memberIds = [...new Set((membershipsWithUsers ?? []).map((membership) => membership.user_id))];
          const { data: memberProfiles } =
            memberIds.length > 0
              ? await supabaseAdmin
                  .schema('public')
                  .from('users')
                  .select('id, display_name, email, avatar_url')
                  .in('id', memberIds)
              : { data: [] };

          const memberProfileById = new Map((memberProfiles ?? []).map((profile) => [profile.id, profile]));

          return (groups ?? []).map((group) => {
            const groupSchedules = (schedules ?? []).filter((schedule) => schedule.group_id === group.id);
            const firstSchedule = groupSchedules[0];
            const weeklyQuestions = groupSchedules.reduce((sum, schedule) => sum + (schedule.question_goal ?? 0), 0);
            const groupMemberships = (membershipsWithUsers ?? []).filter((membership) => membership.group_id === group.id);
            const membersPreview = (membershipsWithUsers ?? [])
              .filter((membership) => membership.group_id === group.id)
              .slice(0, 4)
              .map((membership) => {
                const profile = memberProfileById.get(membership.user_id);
                const displayLabel = profile?.display_name ?? profile?.email ?? 'AB';
                return {
                  id: membership.user_id,
                  initials: getInitials(displayLabel),
                  avatarUrl: profile?.avatar_url ?? null,
                };
              });

            return {
              id: group.id,
              name: group.name,
              language: locale.toUpperCase(),
              memberCount: groupMemberships.length,
              scheduleLabel: firstSchedule
                ? `${firstSchedule.start_time?.slice(0, 5) ?? '--:--'} - ${firstSchedule.end_time?.slice(0, 5) ?? '--:--'}`
                : '',
              weeklyQuestions,
              membersPreview,
            };
          });
        })()
      : [];
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
                timezone: '',
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
          shellGroups={shellGroups}
          currentUserInitials={getInitials(displayName)}
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
          groupInfoSummary={groupInfoSummary}
          sessions={data.sessions}
          canCreateSession={canCreateSession}
          liveGroups={liveGroups}
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
