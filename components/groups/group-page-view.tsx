'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import { CreateSessionModal } from '@/components/sessions/create-session-modal';
import { SessionCard, type SessionListItem } from '@/components/sessions/session-card';
import { GroupEditModal } from '@/components/dashboard/group-edit-modal';
import { GroupScheduleModal } from '@/components/dashboard/group-schedule-modal';
import { InviteMemberForm } from '@/components/dashboard/group-settings-forms';
import { LiveGroupsModal } from '@/components/dashboard/live-groups-modal';
import { CalendarIcon, UsersIcon } from '@/components/ui/dashboard-icons';
import type { AppLocale } from '@/i18n/routing';

type Schedule = {
  id: string;
  weekday: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  start_time: string;
  end_time: string;
  question_goal: number;
};

type MemberPerformance = {
  userId: string;
  name: string;
  email: string;
  initials: string;
  presenceRate: number;
  completionRate: number;
  averageWeeklyQuestions: number;
  totalAnswers: number;
};

type LiveGroup = {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
  maxMembers: number;
  language: string;
  timezone: string;
  weeklyQuestions: number;
  minutesAgo: number;
  compatible: boolean;
  members: Array<{ id: string; initials: string }>;
};

type GroupPageViewProps = {
  locale: AppLocale;
  canBrowseLookupLayer: boolean;
  initialLiveOpen: boolean;
  primaryGroup: {
    id: string;
    name: string;
    invite_code: string;
    meeting_link: string | null;
    memberCount: number;
  } | null;
  isPrimaryGroupFounder: boolean;
  currentCaptainId: string | null;
  schedules: Schedule[];
  weeklyCompletedQuestions: number;
  weeklyTargetQuestions: number;
  memberPerformance: MemberPerformance[];
  weekdayLabels: Record<string, string>;
  groupInfoSummary: string;
  sessions: SessionListItem[];
  canCreateSession: boolean;
  liveGroups: LiveGroup[];
  labels: {
    newSession: string;
    createSession: string;
    createSessionPending: string;
    sessionName: string;
    sessionNamePlaceholder: string;
    questionCount: string;
    timerMode: string;
    perQuestionMode: string;
    globalMode: string;
    timerSeconds: string;
    totalTimerSeconds: string;
    modalHint: string;
    joinLiveGroups: string;
    liveGroupsTitle: string;
    close: string;
    liveGroupJoin: string;
    joinGroupPending: string;
    unlimitedPlanRequired: string;
    unlimitedPlanRequiredDescription: string;
    upgrade: string;
    liveGroupsEmpty: string;
    liveGroupRemainingPlaces: string;
    oneRemainingPlace: string;
    liveGroupSecondsAgo: string;
    liveGroupMinutesAgo: string;
    liveGroupHoursAgo: string;
    liveGroupDaysAgo: string;
    liveGroupWeeksAgo: string;
    liveGroupMonthsAgo: string;
    liveGroupYearsAgo: string;
    averageWeeklyShort: string;
    unknownGroup: string;
    meetingLinkRequiredWarning: string;
    editGroup: string;
    editGroupTitle: string;
    cancel: string;
    groupName: string;
    groupNamePlaceholder: string;
    meetingToolLink: string;
    meetingLinkRequiredPlaceholder: string;
    meetingToolHelper: string;
    saveNamePending: string;
    save: string;
    scheduleAndGoalTitle: string;
    scheduleAndGoalDescription: string;
    saveSchedulePending: string;
    questionGoalValue: string;
    removeDay: string;
    groupScheduleEmpty: string;
    weeklyTotal: string;
    membersTitle: string;
    addExistingMember: string;
    email: string;
    existingMemberEmailPlaceholder: string;
    addMemberPending: string;
    addMember: string;
    sessionsTitle: string;
    noSessionCta: string;
    share: string;
    delete: string;
    copied: string;
    statusScheduled: string;
    statusActive: string;
    statusCompleted: string;
    statusIncomplete: string;
    statusCancelled: string;
    memberAverageWeekly: string;
    memberCompletion: string;
    memberTotal: string;
    captainLabel: string;
    memberStatusActive: string;
    groupViewEmpty: string;
    groupAccessHint: string;
  };
  actions: {
    createSessionAction: (formData: FormData) => void | Promise<void>;
    cancelSessionAction: (formData: FormData) => void | Promise<void>;
    updateGroupDetailsAction: (formData: FormData) => void | Promise<void>;
    addWeeklyScheduleAction: (formData: FormData) => void | Promise<void>;
    updateWeeklySchedulesAction: (formData: FormData) => void | Promise<void>;
    deleteWeeklyScheduleAction: (formData: FormData) => void | Promise<void>;
    addExistingMemberAction: (formData: FormData) => void | Promise<void>;
    joinGroupAction: (formData: FormData) => void | Promise<void>;
  };
};

function formatMeridiemTime(value: string) {
  const [rawHour, minute = '00'] = value.slice(0, 5).split(':');
  const hour = Number(rawHour);
  const suffix = hour >= 12 ? 'pm' : 'am';
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(twelveHour).padStart(2, '0')}:${minute} ${suffix}`;
}

export function GroupPageView({
  locale,
  canBrowseLookupLayer,
  initialLiveOpen,
  primaryGroup,
  isPrimaryGroupFounder,
  currentCaptainId,
  schedules,
  weeklyCompletedQuestions,
  weeklyTargetQuestions,
  memberPerformance,
  weekdayLabels,
  groupInfoSummary,
  sessions,
  canCreateSession,
  liveGroups,
  labels,
  actions,
}: GroupPageViewProps) {
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState(false);
  const groupPath = primaryGroup ? `/${locale}/groups/${primaryGroup.id}` : `/${locale}/groups`;

  return (
    <>
      {canBrowseLookupLayer ? (
        <LiveGroupsModal
          locale={locale}
          groups={liveGroups}
          canJoinLiveGroups={canBrowseLookupLayer}
          initialOpen={initialLiveOpen}
          joinGroupAction={actions.joinGroupAction}
          labels={{
            open: labels.joinLiveGroups,
            title: labels.liveGroupsTitle,
            close: labels.close,
            join: labels.liveGroupJoin,
            joinPending: labels.joinGroupPending,
            upgradeRequired: labels.unlimitedPlanRequired,
            upgradeDescription: labels.unlimitedPlanRequiredDescription,
            upgrade: labels.upgrade,
            empty: labels.liveGroupsEmpty,
            remainingPlaces: labels.liveGroupRemainingPlaces,
            oneRemainingPlace: labels.oneRemainingPlace,
            secondsAgo: labels.liveGroupSecondsAgo,
            minutesAgo: labels.liveGroupMinutesAgo,
            hoursAgo: labels.liveGroupHoursAgo,
            daysAgo: labels.liveGroupDaysAgo,
            weeksAgo: labels.liveGroupWeeksAgo,
            monthsAgo: labels.liveGroupMonthsAgo,
            yearsAgo: labels.liveGroupYearsAgo,
            averageWeekly: labels.averageWeeklyShort,
          }}
        />
      ) : null}

      <section className="surface-mockup p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{primaryGroup?.name ?? labels.unknownGroup}</p>
            <p className="mt-1 text-xs text-slate-500">{groupInfoSummary}</p>
            {!primaryGroup?.meeting_link ? (
              <p className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {labels.meetingLinkRequiredWarning}
              </p>
            ) : null}
          </div>

          {isPrimaryGroupFounder && primaryGroup ? (
            <GroupEditModal
              action={actions.updateGroupDetailsAction}
              locale={locale}
              groupId={primaryGroup.id}
              initialName={primaryGroup.name}
              initialMeetingLink={primaryGroup.meeting_link ?? ''}
              labels={{
                open: labels.editGroup,
                title: labels.editGroupTitle,
                close: labels.close,
                cancel: labels.cancel,
                groupName: labels.groupName,
                groupNamePlaceholder: labels.groupNamePlaceholder,
                meetingLink: labels.meetingToolLink,
                meetingLinkPlaceholder: labels.meetingLinkRequiredPlaceholder,
                meetingLinkWarning: labels.meetingLinkRequiredWarning,
                helper: labels.meetingToolHelper,
                savePending: labels.saveNamePending,
                save: labels.save,
              }}
            />
          ) : (
            <span className="h-2 w-2 rounded-full bg-brand" />
          )}
        </div>
      </section>

      <section className="surface-mockup p-5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-bold text-white">{labels.sessionsTitle}</p>
          {primaryGroup ? (
            <button
              type="button"
              onClick={() => setIsCreateSessionOpen(true)}
              className="button-primary h-10 rounded-[7px] px-4 text-sm"
              disabled={!canCreateSession}
            >
              <span className="mr-2 text-lg leading-none">+</span>
              {labels.newSession}
            </button>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          {sessions.length > 0 ? (
            sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                locale={locale}
                labels={{
                  share: labels.share,
                  delete: labels.delete,
                  copied: labels.copied,
                  statusScheduled: labels.statusScheduled,
                  statusActive: labels.statusActive,
                  statusCompleted: labels.statusCompleted,
                  statusIncomplete: labels.statusIncomplete,
                  statusCancelled: labels.statusCancelled,
                }}
                cancelSessionAction={actions.cancelSessionAction}
                returnTo={groupPath}
              />
            ))
          ) : (
            <p className="text-sm text-slate-400">{labels.noSessionCta}</p>
          )}
        </div>
      </section>

      <section className="surface-mockup p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarIcon />
            <p className="text-sm font-bold text-white">{labels.scheduleAndGoalTitle}</p>
          </div>
          {isPrimaryGroupFounder && primaryGroup ? (
            <div className="flex items-center gap-1">
              <GroupScheduleModal
                addAction={actions.addWeeklyScheduleAction}
                updateAction={actions.updateWeeklySchedulesAction}
                deleteAction={actions.deleteWeeklyScheduleAction}
                locale={locale}
                groupId={primaryGroup.id}
                schedules={schedules}
                weekdayLabels={weekdayLabels}
                labels={{
                  open: locale === 'fr' ? 'Modifier les horaires' : 'Edit schedules',
                  title: labels.scheduleAndGoalTitle,
                  description: labels.scheduleAndGoalDescription,
                  close: labels.close,
                  cancel: labels.cancel,
                  addDay: locale === 'fr' ? 'Ajouter' : 'Add',
                  saveSchedule: labels.save,
                  saveSchedulePending: labels.saveSchedulePending,
                  questionGoal: labels.questionGoalValue,
                  removeDay: labels.removeDay,
                }}
              />
            </div>
          ) : null}
        </div>

        <div className="mt-4 space-y-2">
          {schedules.length > 0 ? (
            schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="grid grid-cols-[88px_1fr] items-center gap-2 text-sm min-[420px]:grid-cols-[88px_1fr_auto] min-[420px]:gap-3"
              >
                <span className="rounded-full bg-brand/12 px-3 py-1 text-xs font-semibold text-brand">
                  {weekdayLabels[schedule.weekday]}
                </span>
                <span className="font-semibold text-slate-300">
                  {formatMeridiemTime(schedule.start_time)} - {formatMeridiemTime(schedule.end_time)}
                </span>
                <span className="col-span-2 rounded-[7px] bg-white/[0.05] px-3 py-1 text-xs font-extrabold text-white min-[420px]:col-span-1">
                  {labels.questionGoalValue.replace('{count}', String(schedule.question_goal))}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">{labels.groupScheduleEmpty}</p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4 text-sm">
          <span className="font-semibold text-slate-500">{labels.weeklyTotal}</span>
          <span className="font-extrabold text-white">
            {weeklyCompletedQuestions} / {weeklyTargetQuestions || 100} Q
          </span>
        </div>
      </section>

      <section className="surface-mockup p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <UsersIcon />
            <p className="text-sm font-bold text-white">{labels.membersTitle}</p>
          </div>
        </div>

        {isPrimaryGroupFounder && primaryGroup ? (
          <div className="mt-4 rounded-[10px] bg-white/[0.025] p-3">
            <InviteMemberForm
              action={actions.addExistingMemberAction}
              locale={locale}
              groupId={primaryGroup.id}
              label={labels.addExistingMember}
              emailLabel={labels.email}
              emailPlaceholder={labels.existingMemberEmailPlaceholder}
              pendingLabel={labels.addMemberPending}
              submitLabel={labels.addMember}
              compact
            />
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {memberPerformance.length > 0 ? (
            memberPerformance.map((member) => (
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
                        <span>{labels.memberAverageWeekly.replace('{value}', String(member.averageWeeklyQuestions))}</span>
                        <span className="px-2">|</span>
                        <span>{labels.memberCompletion.replace('{value}', String(member.completionRate))}</span>
                        <span className="px-2">|</span>
                        <span>{labels.memberTotal.replace('{value}', String(member.totalAnswers))}</span>
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[10px] font-bold text-brand">
                    {member.userId === currentCaptainId ? labels.captainLabel : labels.memberStatusActive}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">{labels.groupViewEmpty}</p>
          )}
        </div>
      </section>

      {isCreateSessionOpen && primaryGroup ? (
        <CreateSessionModal
          locale={locale}
          groupId={primaryGroup.id}
          memberCount={primaryGroup.memberCount}
          canCreateSession={canCreateSession}
          action={actions.createSessionAction}
          returnTo={groupPath}
          labels={{
            newSession: labels.newSession,
            createSession: labels.createSession,
            createSessionPending: labels.createSessionPending,
            sessionName: labels.sessionName,
            sessionNamePlaceholder: labels.sessionNamePlaceholder,
            questionCount: labels.questionCount,
            timerMode: labels.timerMode,
            perQuestionMode: labels.perQuestionMode,
            globalMode: labels.globalMode,
            timerSeconds: labels.timerSeconds,
            totalTimerSeconds: labels.totalTimerSeconds,
            modalHint: labels.modalHint,
            close: labels.close,
            groupAccessHint: labels.groupAccessHint,
          }}
          onClose={() => setIsCreateSessionOpen(false)}
        />
      ) : null}
    </>
  );
}
