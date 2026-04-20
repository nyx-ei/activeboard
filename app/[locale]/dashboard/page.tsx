import { getTranslations } from 'next-intl/server';
import { AlertTriangle } from 'lucide-react';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { RealtimeRefresh } from '@/components/app/realtime-refresh';
import { DashboardPerformanceView } from '@/components/dashboard/dashboard-performance-view';
import { DashboardSessionsView } from '@/components/dashboard/dashboard-sessions-view';
import { GroupEditModal } from '@/components/dashboard/group-edit-modal';
import { GroupScheduleModal } from '@/components/dashboard/group-schedule-modal';
import { InviteMemberForm } from '@/components/dashboard/group-settings-forms';
import { LiveGroupsModal } from '@/components/dashboard/live-groups-modal';
import { PendingGroupDraftSync } from '@/components/onboarding/pending-group-draft-sync';
import { CalendarIcon, UsersIcon } from '@/components/ui/dashboard-icons';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { getUserAccessState, hasUserTierCapability } from '@/lib/billing/gating';
import { getDashboardData } from '@/lib/demo/data';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import {
  addDashboardExistingMemberAction,
  addDashboardWeeklyScheduleAction,
  cancelDashboardSessionAction,
  createDashboardSessionAction,
  deleteDashboardWeeklyScheduleAction,
  joinGroupAction,
  joinSessionByCodeAction,
  updateDashboardGroupDetailsAction,
  updateDashboardWeeklySchedulesAction,
} from './actions';

type DashboardPageProps = {
  params: { locale: string };
  searchParams: {
    feedbackMessage?: string;
    feedbackTone?: string;
    view?: string;
    groupId?: string;
    live?: string;
  };
};

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

function formatMeridiemTime(value: string) {
  const [rawHour, minute = '00'] = value.slice(0, 5).split(':');
  const hour = Number(rawHour);
  const suffix = hour >= 12 ? 'pm' : 'am';
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(twelveHour).padStart(2, '0')}:${minute} ${suffix}`;
}

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('Dashboard');
  const feedbackT = await getTranslations('Feedback');
  const view = searchParams.view === 'performance' || searchParams.view === 'group' ? searchParams.view : 'sessions';
  const isGroupView = view === 'group';
  const isPerformanceView = view === 'performance';
  const isSessionsView = view === 'sessions';
  const requestedGroupId = typeof searchParams.groupId === 'string' ? searchParams.groupId : null;
  const [data, accessState, currentProfile] = await Promise.all([
    getDashboardData(
      user,
      isSessionsView || isGroupView,
      isPerformanceView,
      isGroupView,
      false,
      requestedGroupId,
      isSessionsView || isPerformanceView,
    ),
    getUserAccessState(user.id),
    isGroupView
      ? createSupabaseServerClient()
          .schema('public')
          .from('users')
          .select('exam_session')
          .eq('id', user.id)
          .maybeSingle()
          .then((result) => result.data)
      : Promise.resolve(null),
  ]);
  const canJoinSessions = hasUserTierCapability(accessState, 'canJoinSessions');
  const canBrowseLookupLayer = hasUserTierCapability(accessState, 'canBrowseLookupLayer');
  const primaryGroup = data.groupDashboard.group ?? data.groups.find((group) => group.is_founder) ?? data.groups[0] ?? null;
  const activeGroupId = primaryGroup?.id ?? null;
  const dashboardSessions = data.sessions;
  const isPrimaryGroupFounder = Boolean(primaryGroup?.is_founder);
  const captainSession = primaryGroup
    ? data.sessions.find((session) => session.group_id === primaryGroup.id && session.status === 'active') ??
      data.sessions.find((session) => session.group_id === primaryGroup.id && session.status === 'scheduled') ??
      null
    : null;
  const currentCaptainId = captainSession?.leader_id ?? null;
  const weekdayLabels = {
    monday: t('weekdayMonday'),
    tuesday: t('weekdayTuesday'),
    wednesday: t('weekdayWednesday'),
    thursday: t('weekdayThursday'),
    friday: t('weekdayFriday'),
    saturday: t('weekdaySaturday'),
    sunday: t('weekdaySunday'),
  };
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
  const groupExamSummary = primaryGroup
    ? [examSessionLabel, locale === 'fr' ? 'Français' : 'English', 'GMT+1'].join(' · ')
    : t('noData');
  const groupInfoSummary = primaryGroup
    ? [primaryGroup.invite_code, examSessionLabel, locale === 'fr' ? 'Français' : 'English', 'GMT+1'].join(' · ')
    : t('noData');
  const liveGroups =
    isGroupView
      ? await (async () => {
          const supabaseAdmin = createSupabaseAdminClient();
          const currentGroupIds = new Set(data.groups.map((group) => group.id));
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
          const usersMap = await (async () => {
            const ids = [...new Set((memberships ?? []).map((membership) => membership.user_id))];
            if (ids.length === 0) return new Map<string, { id: string; display_name: string | null; email: string }>();
            const { data: users } = await supabaseAdmin
              .schema('public')
              .from('users')
              .select('id, display_name, email')
              .in('id', ids);
            return new Map((users ?? []).map((profile) => [profile.id, profile]));
          })();
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
      <PendingGroupDraftSync
        locale={locale}
        successMessage={feedbackT('groupCreated')}
        errorMessage={feedbackT('actionFailed')}
        missingFieldsMessage={feedbackT('missingFields')}
        billingRequiredMessage={feedbackT('upgradeRequiredToCreateGroup')}
      />
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
        {view === 'sessions' ? (
          <DashboardSessionsView
            locale={locale}
            primaryGroupId={activeGroupId}
            sessions={dashboardSessions}
            weeklyCompletedQuestions={data.groupDashboard.weeklyCompletedQuestions}
            weeklyTargetQuestions={data.groupDashboard.weeklyTargetQuestions}
            weeklyProgressPercentage={data.groupDashboard.weeklyProgressPercentage}
            canCreateSession={hasUserTierCapability(accessState, 'canCreateSession')}
            canJoinSessions={canJoinSessions}
            memberCount={primaryGroup?.memberCount ?? 0}
            createSessionAction={createDashboardSessionAction}
            cancelSessionAction={cancelDashboardSessionAction}
            joinSessionAction={joinSessionByCodeAction}
            labels={{
              newSession: t('newSession'),
              weeklyProgressTitle: t('weeklyProgressTitle'),
              prequalification: t('prequalificationBadge'),
              classGoal: t('classGoal'),
              sessions: t('sessions'),
              noSessionCta: t('noSessionCta'),
              sessionCodePlaceholder: t('sessionCodePlaceholder'),
              go: t('go'),
              goPending: t('goPending'),
              upgradeRequiredToJoinSession: feedbackT('upgradeRequiredToJoinSession'),
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
              close: t('close'),
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
            answeredCount={data.metrics.answeredCount}
            completedSessionsCount={data.metrics.completedSessionsCount}
            successRate={data.metrics.successRate}
            errorRate={data.metrics.errorRate}
            averageConfidence={data.metrics.averageConfidence}
            heatmap={data.profileAnalytics.heatmap}
            labels={{
              sprintActivityTitle: t('sprintActivityTitle'),
              questionsAnswered: t('questionsAnswered'),
              sessionsFinished: t('sessionsFinished', { count: data.metrics.completedSessionsCount }),
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

        {isGroupView ? (
          <>
            {canBrowseLookupLayer ? (
              <LiveGroupsModal
                locale={locale}
                groups={liveGroups}
                canJoinLiveGroups={canBrowseLookupLayer}
                initialOpen={searchParams.live === '1'}
                joinGroupAction={joinGroupAction}
                labels={{
                  open: t('joinLiveGroups'),
                  title: t('liveGroupsTitle'),
                  close: t('close'),
                  join: t('liveGroupJoin'),
                  joinPending: t('joinGroupPending'),
                  upgradeRequired: t('unlimitedPlanRequired'),
                  upgradeDescription: t('unlimitedPlanRequiredDescription'),
                  upgrade: t('upgrade'),
                  empty: t('liveGroupsEmpty'),
                  remainingPlaces: t('liveGroupRemainingPlaces', { count: '{count}' }),
                  oneRemainingPlace: t('oneRemainingPlace'),
                  secondsAgo: t('liveGroupSecondsAgo', { count: '{count}' }),
                  minutesAgo: t('liveGroupMinutesAgo', { count: '{count}' }),
                  hoursAgo: t('liveGroupHoursAgo', { count: '{count}' }),
                  daysAgo: t('liveGroupDaysAgo', { count: '{count}' }),
                  weeksAgo: t('liveGroupWeeksAgo', { count: '{count}' }),
                  monthsAgo: t('liveGroupMonthsAgo', { count: '{count}' }),
                  yearsAgo: t('liveGroupYearsAgo', { count: '{count}' }),
                }}
              />
            ) : null}
            <section className="surface-mockup p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{data.groupDashboard.group?.name ?? t('unknownGroup')}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {groupInfoSummary}
                  </p>
                  {!primaryGroup?.meeting_link ? (
                    <p className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('meetingLinkRequiredWarning')}
                    </p>
                  ) : null}
                  <p className="hidden">
                    {primaryGroup ? `${primaryGroup.invite_code} · ${groupExamSummary}` : groupExamSummary}
                  </p>
                  <p className="hidden">
                    {primaryGroup ? `${locale.toUpperCase()} · ${primaryGroup.memberCount}/${primaryGroup.max_members ?? 5}` : t('noData')}
                  </p>
                </div>
                {isPrimaryGroupFounder && primaryGroup ? (
                  <GroupEditModal
                    action={updateDashboardGroupDetailsAction}
                    locale={locale}
                    groupId={primaryGroup.id}
                    initialName={primaryGroup.name}
                    initialMeetingLink={primaryGroup.meeting_link ?? ''}
                    labels={{
                      open: t('editGroup'),
                      title: t('editGroupTitle'),
                      close: t('close'),
                      cancel: t('cancel'),
                      groupName: t('groupName'),
                      groupNamePlaceholder: t('groupNamePlaceholder'),
                      meetingLink: t('meetingToolLink'),
                      meetingLinkPlaceholder: t('meetingLinkRequiredPlaceholder'),
                      meetingLinkWarning: t('meetingLinkRequiredWarning'),
                      helper: t('meetingToolHelper'),
                      savePending: t('saveNamePending'),
                      save: t('save'),
                    }}
                  />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-brand" />
                )}
              </div>
            </section>

            <section className="hidden">
              <p className="hidden text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{t('examSession')}</p>
              <p className="mt-1 text-sm font-semibold text-slate-300">{examSessionLabel}</p>
            </section>

            <section className="surface-mockup p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon />
                  <p className="text-sm font-bold text-white">{t('scheduleAndGoalTitle')}</p>
                </div>
                {isPrimaryGroupFounder && primaryGroup ? (
                  <div className="flex items-center gap-1">
                    <GroupScheduleModal
                      addAction={addDashboardWeeklyScheduleAction}
                      updateAction={updateDashboardWeeklySchedulesAction}
                      deleteAction={deleteDashboardWeeklyScheduleAction}
                      locale={locale}
                      groupId={primaryGroup.id}
                      schedules={data.groupDashboard.schedules}
                      weekdayLabels={weekdayLabels}
                      labels={{
                        open: locale === 'fr' ? 'Modifier les horaires' : 'Edit schedules',
                        title: t('scheduleAndGoalTitle'),
                        description: t('scheduleAndGoalDescription'),
                        close: t('close'),
                        cancel: t('cancel'),
                        addDay: locale === 'fr' ? 'Ajouter' : 'Add',
                        saveSchedule: t('save'),
                        saveSchedulePending: t('saveSchedulePending'),
                        questionGoal: t('questionGoalValue', { count: 50 }),
                        removeDay: t('removeDay'),
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <div className="mt-4 space-y-2">
                {data.groupDashboard.schedules.length > 0 ? (
                  data.groupDashboard.schedules.map((schedule) => (
                  <div key={schedule.id} className="grid grid-cols-[88px_1fr] items-center gap-2 text-sm min-[420px]:grid-cols-[88px_1fr_auto] min-[420px]:gap-3">
                    <span className="rounded-full bg-brand/12 px-3 py-1 text-xs font-semibold text-brand">
                      {weekdayLabels[schedule.weekday]}
                    </span>
                    <span className="font-semibold text-slate-300">
                      {formatMeridiemTime(schedule.start_time)} – {formatMeridiemTime(schedule.end_time)}
                    </span>
                    <span className="col-span-2 rounded-[7px] bg-white/[0.05] px-3 py-1 text-xs font-extrabold text-white min-[420px]:col-span-1">
                      {t('questionGoalValue', { count: schedule.question_goal })}
                    </span>
                  </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">{t('groupScheduleEmpty')}</p>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4 text-sm">
                <span className="font-semibold text-slate-500">{t('weeklyTotal')}</span>
                <span className="font-extrabold text-white">
                  {data.groupDashboard.weeklyCompletedQuestions} / {data.groupDashboard.weeklyTargetQuestions || 100} Q
                </span>
              </div>
            </section>

            <section className="surface-mockup p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <UsersIcon />
                  <p className="text-sm font-bold text-white">{t('membersTitle')}</p>
                </div>
              </div>
              {isPrimaryGroupFounder && primaryGroup ? (
                <div className="mt-4 rounded-[10px] bg-white/[0.025] p-3">
                  <InviteMemberForm
                    action={addDashboardExistingMemberAction}
                    locale={locale}
                    groupId={primaryGroup.id}
                    label={t('addExistingMember')}
                    emailLabel={t('email')}
                    emailPlaceholder={t('existingMemberEmailPlaceholder')}
                    pendingLabel={t('addMemberPending')}
                    submitLabel={t('addMember')}
                    compact
                  />
                </div>
              ) : null}
              <div className="mt-4 space-y-3">
                {data.groupDashboard.memberPerformance.length > 0 ? (
                  data.groupDashboard.memberPerformance.map((member) => (
                    <div key={member.userId} className="rounded-[12px] bg-white/[0.04] px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />
                        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/20 text-xs font-bold text-brand">
                          {member.initials}
                          {member.userId === currentCaptainId ? (
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[8px] font-extrabold uppercase leading-none text-[#3b2600]">
                              c
                            </span>
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{member.name}</p>
                          <p className="text-xs text-slate-400">
                            <span>{t('memberAverageWeekly', { value: member.averageWeeklyQuestions })}</span>
                            <span className="px-2">·</span>
                            <span>{t('memberCompletion', { value: member.completionRate })}</span>
                            <span className="px-2">·</span>
                            <span>{t('memberTotal', { value: member.totalAnswers })}</span>
                          </p>
                          <p className="hidden">
                            <span>{t('memberPresence', { value: member.presenceRate })}</span>
                            <span className="px-2">·</span>
                            <span>{t('memberCompletion', { value: member.completionRate })}</span>
                          </p>
                          <p className="hidden">
                            {t('memberPresence', { value: member.presenceRate })} · {t('memberCompletion', { value: member.completionRate })}
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[10px] font-bold text-brand">
                        {member.userId === currentCaptainId ? t('captainLabel') : t('memberStatusActive')}
                      </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">{t('groupViewEmpty')}</p>
                )}
              </div>
            </section>

          </>
        ) : null}


      </section>
    </main>
  );
}
