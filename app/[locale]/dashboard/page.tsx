import { getTranslations } from 'next-intl/server';
import { ArrowLeftRight, Shield, Trash2 } from 'lucide-react';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { RealtimeRefresh } from '@/components/app/realtime-refresh';
import { LogoutButton } from '@/components/auth/logout-button';
import { DashboardPerformanceView } from '@/components/dashboard/dashboard-performance-view';
import { DashboardSessionsView } from '@/components/dashboard/dashboard-sessions-view';
import { LiveGroupsModal } from '@/components/dashboard/live-groups-modal';
import { SettingsWeeklyScheduleForm } from '@/components/dashboard/settings-weekly-schedule-form';
import { PendingGroupDraftSync } from '@/components/onboarding/pending-group-draft-sync';
import { CalendarIcon, UsersIcon } from '@/components/ui/dashboard-icons';
import { SubmitButton } from '@/components/ui/submit-button';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { getUserAccessState, hasUserTierCapability } from '@/lib/billing/gating';
import { getDashboardData } from '@/lib/demo/data';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { GroupMeetingLinkForm, GroupNameForm, InviteMemberForm } from '../groups/[groupId]/group-settings-forms';
import {
  addDashboardExistingMemberAction,
  addDashboardWeeklyScheduleAction,
  cancelDashboardSessionAction,
  createDashboardSessionAction,
  deleteDashboardWeeklyScheduleAction,
  inviteDashboardGroupMemberAction,
  joinGroupAction,
  joinSessionByCodeAction,
  transferDashboardCaptainAction,
  updateDashboardGroupMeetingLinkAction,
  updateDashboardGroupNameAction,
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

function getHeatmapCellClass(intensity: 0 | 1 | 2 | 3 | 4) {
  switch (intensity) {
    case 4:
      return 'bg-brand';
    case 3:
      return 'bg-emerald-400/80';
    case 2:
      return 'bg-emerald-400/55';
    case 1:
      return 'bg-emerald-400/25';
    default:
      return 'bg-white/[0.07]';
  }
}

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

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('Dashboard');
  const feedbackT = await getTranslations('Feedback');
  const sessionT = await getTranslations('Session');
  const view =
    searchParams.view === 'performance' || searchParams.view === 'group' || searchParams.view === 'settings'
      ? searchParams.view
      : 'sessions';
  const isGroupView = view === 'group';
  const isPerformanceView = view === 'performance';
  const isSettingsView = view === 'settings';
  const isSessionsView = view === 'sessions';
  const requestedGroupId = typeof searchParams.groupId === 'string' ? searchParams.groupId : null;
  const [data, accessState, currentProfile] = await Promise.all([
    getDashboardData(
      user,
      isSessionsView || isGroupView || isSettingsView,
      isPerformanceView,
      isGroupView || isSettingsView,
      false,
      requestedGroupId,
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
  const activeGroupSessions = activeGroupId ? data.sessions.filter((session) => session.group_id === activeGroupId) : data.sessions;
  const isPrimaryGroupFounder = Boolean(primaryGroup?.is_founder);
  const captainSession = primaryGroup
    ? data.sessions.find((session) => session.group_id === primaryGroup.id && session.status === 'active') ??
      data.sessions.find((session) => session.group_id === primaryGroup.id && session.status === 'scheduled') ??
      null
    : null;
  const currentCaptainId = captainSession?.leader_id ?? null;
  const canTransferCaptain = Boolean(captainSession && currentCaptainId === user.id);
  const captainTransferCandidates = data.groupDashboard.memberPerformance.filter((member) => member.userId !== currentCaptainId);
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
  const liveGroups =
    isGroupView || isSettingsView
      ? await (async () => {
          const currentGroupIds = new Set(data.groups.map((group) => group.id));
          const { data: candidateGroups } = await createSupabaseServerClient()
            .schema('public')
            .from('groups')
            .select('id, name, invite_code, max_members, created_at')
            .order('created_at', { ascending: false })
            .limit(20);
          const availableGroups = (candidateGroups ?? []).filter((group) => !currentGroupIds.has(group.id));
          const availableGroupIds = availableGroups.map((group) => group.id);
          if (availableGroupIds.length === 0) return [];

          const [{ data: memberships }, { data: schedules }] = await Promise.all([
            createSupabaseServerClient()
              .schema('public')
              .from('group_members')
              .select('group_id, user_id')
              .in('group_id', availableGroupIds),
            createSupabaseServerClient()
              .schema('public')
              .from('group_weekly_schedules')
              .select('group_id, question_goal')
              .in('group_id', availableGroupIds),
          ]);
          const usersMap = await (async () => {
            const ids = [...new Set((memberships ?? []).map((membership) => membership.user_id))];
            if (ids.length === 0) return new Map<string, { id: string; display_name: string | null; email: string }>();
            const { data: users } = await createSupabaseServerClient()
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
            sessions={activeGroupSessions}
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

        {false && isPerformanceView ? (
          <>
            <section className="surface-mockup p-5">
              <div className="flex items-center gap-2">
                <span className="text-brand">↯</span>
                <p className="text-sm font-bold text-white">{t('heatmapTitle')}</p>
              </div>
              <p className="mt-4 text-3xl font-extrabold text-white">{data.metrics.answeredCount}</p>
              <p className="mt-1 text-sm text-slate-400">{t('questionsAnswered')}</p>
              <div className="mt-4 grid grid-cols-12 gap-1">
                {data.profileAnalytics.heatmap.slice(-84).map((day) => (
                  <div
                    key={day.date}
                    className={`h-7 rounded-[2px] border border-white/5 ${getHeatmapCellClass(day.intensity)}`}
                    title={`${day.date} - ${day.count}`}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">{t('heatmapReplacesSprint')}</p>
            </section>

            <section className="surface-mockup p-5">
              <div className="flex items-center gap-2">
                <span className="text-brand">◎</span>
                <p className="text-sm font-bold text-white">{t('certaintyTitle')}</p>
              </div>
              <p className="mt-3 text-sm text-slate-400">
                {data.metrics.successRate !== null
                  ? `${data.metrics.successRate}% - ${
                      data.metrics.averageConfidence === 'low'
                        ? t('confidenceLow')
                        : data.metrics.averageConfidence === 'medium'
                          ? t('confidenceMedium')
                          : data.metrics.averageConfidence === 'high'
                            ? t('confidenceHigh')
                            : t('noData')
                    }`
                  : t('confidenceAfterNextSession')}
              </p>
            </section>

            <section className="surface-mockup p-5">
              <div className="flex items-center gap-2">
                <span className="text-brand">△</span>
                <p className="text-sm font-bold text-white">{t('errorTitle')}</p>
              </div>
              <p className="mt-3 text-sm text-slate-400">
                {data.metrics.errorRate !== null ? `${data.metrics.errorRate}%` : t('errorAfterThreeSessions')}
              </p>
            </section>

            <section className="grid gap-3 md:grid-cols-2">
              <article className="surface-mockup p-5">
                <p className="text-sm font-bold text-white">{t('confidenceCalibrationTitle')}</p>
                <div className="mt-4 space-y-3">
                  {data.profileAnalytics.confidenceCalibration.map((item) => (
                    <div key={item.confidence}>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>
                          {item.confidence === 'low'
                            ? t('confidenceLow')
                            : item.confidence === 'medium'
                              ? t('confidenceMedium')
                              : t('confidenceHigh')}
                        </span>
                        <span>{item.total > 0 ? t('accuracyValue', { accuracy: item.accuracy, count: item.total }) : t('noData')}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${item.accuracy}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
              <article className="surface-mockup p-5">
                <p className="text-sm font-bold text-white">{t('errorTypesTitle')}</p>
                <div className="mt-4 space-y-2">
                  {data.profileAnalytics.errorTypeBreakdown.length > 0 ? (
                    data.profileAnalytics.errorTypeBreakdown.slice(0, 4).map((item) => (
                      <div key={item.errorType} className="flex items-center justify-between rounded-[10px] bg-white/[0.04] px-3 py-2 text-sm">
                        <span className="text-white">{sessionT(`errorType.${item.errorType}` as never)}</span>
                        <span className="text-slate-400">{item.count}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">{t('errorTypesEmpty')}</p>
                  )}
                </div>
              </article>
            </section>
          </>
        ) : null}

        {isGroupView ? (
          <>
            <LiveGroupsModal
              locale={locale}
              groups={liveGroups}
              canJoinLiveGroups={canBrowseLookupLayer}
              joinGroupAction={joinGroupAction}
              labels={{
                open: t('joinLiveGroups'),
                title: t('liveGroupsTitle'),
                close: t('close'),
                join: t('joinGroup'),
                joinPending: t('joinGroupPending'),
                upgradeRequired: t('unlimitedPlanRequired'),
                upgrade: t('upgrade'),
                compatibleDays: t('compatibleDays'),
                remainingPlaces: t('remainingPlaces'),
                oneRemainingPlace: t('oneRemainingPlace'),
                minutesAgo: t('minutesAgo'),
              }}
            />
            <section className="surface-mockup p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{data.groupDashboard.group?.name ?? t('unknownGroup')}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {primaryGroup ? `${locale.toUpperCase()} · ${primaryGroup.memberCount}/${primaryGroup.max_members ?? 5}` : t('noData')}
                  </p>
                </div>
                <span className="h-2 w-2 rounded-full bg-brand" />
              </div>
            </section>

            <section className="surface-mockup p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{t('examSession')}</p>
              <p className="mt-1 text-sm font-semibold text-slate-300">{examSessionLabel}</p>
            </section>

            <section className="surface-mockup p-5">
              <div className="flex items-center gap-2">
                <CalendarIcon />
                <p className="text-sm font-bold text-white">{t('scheduleAndGoalTitle')}</p>
              </div>
              <div className="mt-4 space-y-2">
                {data.groupDashboard.schedules.length > 0 ? (
                  data.groupDashboard.schedules.map((schedule) => (
                  <div key={schedule.id} className="grid grid-cols-[88px_1fr] items-center gap-2 text-sm min-[420px]:grid-cols-[88px_1fr_auto] min-[420px]:gap-3">
                    <span className="rounded-full bg-brand/12 px-3 py-1 text-xs font-semibold text-brand">
                      {weekdayLabels[schedule.weekday]}
                    </span>
                    <span className="font-semibold text-slate-300">
                      {schedule.start_time.slice(0, 5)} – {schedule.end_time.slice(0, 5)}
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
                      <div className="ml-[34px] mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.10]">
                        <div className="h-full rounded-full bg-slate-500" style={{ width: `${member.completionRate}%` }} />
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

        {isSettingsView ? (
          <>
            {primaryGroup ? (
              <>
                <section className="surface-mockup p-5">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-amber-400" aria-hidden="true" />
                    <h1 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">{t('groupManagementTitle')}</h1>
                  </div>

                  <div className="mt-5 space-y-5">
                    {isPrimaryGroupFounder ? (
                      <GroupNameForm
                        action={updateDashboardGroupNameAction}
                        locale={locale}
                        groupId={primaryGroup.id}
                        initialName={primaryGroup.name}
                        label={t('groupName')}
                        placeholder={t('groupNamePlaceholder')}
                        pendingLabel={t('saveNamePending')}
                        submitLabel={t('saveShort')}
                      />
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-slate-400">{t('groupName')}</p>
                        <p className="mt-2 rounded-[7px] bg-white/[0.06] px-3 py-2 text-sm font-semibold text-white">{primaryGroup.name}</p>
                        <p className="mt-2 text-xs text-slate-500">{t('founderOnlySettingsHint')}</p>
                      </div>
                    )}

                    {isPrimaryGroupFounder ? (
                      <GroupMeetingLinkForm
                        action={updateDashboardGroupMeetingLinkAction}
                        locale={locale}
                        groupId={primaryGroup.id}
                        initialMeetingLink={primaryGroup.meeting_link ?? ''}
                        label={t('meetingLinkRequired')}
                        placeholder={t('meetingLinkRequiredPlaceholder')}
                        warning={t('meetingLinkRequiredWarning')}
                        pendingLabel={t('saveNamePending')}
                        submitLabel={t('saveShort')}
                      />
                    ) : primaryGroup.meeting_link ? (
                      <div className="border-t border-white/[0.06] pt-4">
                        <p className="text-sm font-semibold text-slate-400">{t('meetingLinkRequired')}</p>
                        <a href={primaryGroup.meeting_link} target="_blank" rel="noreferrer" className="mt-2 block truncate rounded-[7px] bg-white/[0.06] px-3 py-2 text-sm font-semibold text-brand">
                          {primaryGroup.meeting_link}
                        </a>
                      </div>
                    ) : null}

                    {isPrimaryGroupFounder ? (
                      <InviteMemberForm
                        action={inviteDashboardGroupMemberAction}
                        locale={locale}
                        groupId={primaryGroup.id}
                        label={t('inviteMember')}
                        emailLabel={t('email')}
                        emailPlaceholder={t('emailPlaceholder')}
                        pendingLabel={t('sendInvitePending')}
                        submitLabel={t('sendInviteShort')}
                        compact
                      />
                    ) : null}
                  </div>
                </section>

                <section className="surface-mockup p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <CalendarIcon />
                      <h2 className="text-sm font-bold text-slate-300">{t('weeklyScheduleTitle')}</h2>
                    </div>
                  </div>

                  {isPrimaryGroupFounder ? (
                    <SettingsWeeklyScheduleForm
                      action={addDashboardWeeklyScheduleAction}
                      locale={locale}
                      groupId={primaryGroup.id}
                      labels={{
                        addDay: t('addDay'),
                        saveSchedule: t('saveSchedule'),
                        saveSchedulePending: t('saveSchedulePending'),
                        questionGoal: t('questionGoalValue', { count: 50 }),
                        removeDay: t('removeDay'),
                        weekdays: weekdayLabels,
                      }}
                    />
                  ) : null}

                  <div className="mt-4 space-y-2">
                    {data.groupDashboard.schedules.length > 0 ? (
                      data.groupDashboard.schedules.map((schedule) => (
                        <div key={schedule.id} className="flex flex-wrap items-center gap-2 rounded-[10px] bg-white/[0.035] px-3 py-2 sm:gap-3">
                          <span className="rounded-full bg-brand/12 px-3 py-1 text-xs font-semibold text-brand">{weekdayLabels[schedule.weekday]}</span>
                          <span className="text-sm font-medium text-slate-300">
                            {schedule.start_time.slice(0, 5)} → {schedule.end_time.slice(0, 5)}
                          </span>
                          <span className="text-xs font-semibold text-slate-500 sm:ml-auto">{t('questionGoalValue', { count: schedule.question_goal })}</span>
                          {isPrimaryGroupFounder ? (
                            <form action={deleteDashboardWeeklyScheduleAction}>
                              <input type="hidden" name="locale" value={locale} />
                              <input type="hidden" name="groupId" value={primaryGroup.id} />
                              <input type="hidden" name="scheduleId" value={schedule.id} />
                              <SubmitButton pendingLabel="" className="button-ghost px-1.5 py-1.5 text-slate-500 hover:text-white">
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </SubmitButton>
                            </form>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">{t('weeklyScheduleEmpty')}</p>
                    )}
                  </div>
                </section>

                <section className="surface-mockup p-5">
                  <h2 className="text-sm font-bold text-slate-300">{t('membersTitle')} ({data.groupDashboard.memberPerformance.length})</h2>
                  {data.groupDashboard.memberPerformance.length < 2 ? (
                    <p className="mt-3 text-xs font-semibold text-amber-400">{t('minimumMembersWarning')}</p>
                  ) : null}
                  <div className="mt-4 space-y-3">
                    {data.groupDashboard.memberPerformance.map((member) => (
                      <div key={member.userId} className="flex items-center gap-3 rounded-[12px] bg-white/[0.04] px-3 py-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/20 text-xs font-bold text-brand">
                          {member.initials}
                        </div>
                        <p className="truncate text-sm font-bold text-white">{member.name}</p>
                        {member.userId === currentCaptainId ? (
                          <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-amber-400">{t('captainLabel')}</span>
                        ) : member.is_founder ? (
                          <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-amber-400">{t('founder')}</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>

                {canTransferCaptain ? (
                  <section className="surface-mockup border-amber-400/20 p-5">
                    <div className="flex items-center gap-2 text-amber-400">
                      <ArrowLeftRight className="h-5 w-5" aria-hidden="true" />
                      <h2 className="text-sm font-bold">{t('transferCaptainTitle')}</h2>
                    </div>
                    <p className="mt-4 text-sm text-slate-500">{t('transferCaptainDescription')}</p>
                    {captainTransferCandidates.length > 0 ? (
                      <form action={transferDashboardCaptainAction} className="mt-4 flex items-center gap-2">
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="sessionId" value={captainSession?.id ?? ''} />
                        <select name="targetUserId" className="field h-10 rounded-[7px] px-3 py-2 text-sm">
                          {captainTransferCandidates.map((member) => (
                            <option key={member.userId} value={member.userId}>
                              {member.name}
                            </option>
                          ))}
                        </select>
                        <SubmitButton pendingLabel={t('transferCaptainPending')} className="button-secondary h-10 rounded-[7px] px-3 py-2 text-xs text-amber-300">
                          {t('transferCaptainAction')}
                        </SubmitButton>
                      </form>
                    ) : (
                      <p className="mt-4 text-sm italic text-slate-500">{t('transferCaptainEmpty')}</p>
                    )}
                  </section>
                ) : null}

                <div className="flex justify-center py-4">
                  <LogoutButton
                    showIcon
                    className="min-h-0 border-none bg-transparent px-3 py-1 text-sm font-bold text-[#ff4d5e] shadow-none hover:bg-transparent hover:text-[#ff7a86]"
                  />
                </div>
              </>
            ) : (
              <section className="surface-mockup p-5 text-center">
                <h1 className="text-sm font-extrabold uppercase tracking-[0.16em] text-white">{t('groupManagementTitle')}</h1>
                <p className="mt-3 text-sm text-slate-400">{t('groupViewEmpty')}</p>
              </section>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
