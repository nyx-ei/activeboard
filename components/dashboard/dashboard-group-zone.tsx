'use client';

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import {
  CalendarClock,
  Check,
  ChevronDown,
  Mail,
  Play,
  Plus,
  Send,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';

import { Modal, ModalTitle } from '@/components/ui/modal';
import { openSessionInManagedTab } from '@/components/session/session-tab-channel';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type DashboardGroupZoneGroup = {
  id: string;
  name: string;
  memberCount: number;
  maxMembers?: number;
  membersPreview?: Array<{
    id: string;
    initials: string;
    avatarUrl: string | null;
  }>;
  hasLiveSession?: boolean;
  activeSession?: DashboardGroupZoneSession | null;
  nextSession?: DashboardGroupZoneSession | null;
  recentSessions?: DashboardGroupZoneSession[];
};

export type DashboardGroupZoneSession = {
  id: string;
  name: string | null;
  scheduled_at: string;
  started_at?: string | null;
  share_code: string;
  timer_seconds: number;
  question_goal: number;
  answeredQuestionCount?: number;
  questionCount?: number;
  leaderInitials?: string;
  completionPercent?: number;
  accuracyPercent?: number | null;
};

export type DashboardGroupZoneProps = {
  locale: string;
  groups: DashboardGroupZoneGroup[];
  createGroupHref: string;
  labels: {
    title: string;
    subtitle: string;
    dropdownLabel: string;
    members: string;
    live: string;
    noGroups: string;
    createAnother: string;
    seats: string;
    nextSession: string;
    scheduledFor: string;
    noUpcomingSession: string;
    openSession: string;
    joinLiveSession: string;
    timerLabel: string;
    recentSessions: string;
    viewAllSessions: string;
    captain: string;
    questionsUnit: string;
    completion: string;
    accuracy: string;
    noData: string;
    invite: string;
    inviteTitle: string;
    inviteDescription: string;
    inviteEmailPlaceholder: string;
    inviteSend: string;
    inviteSending: string;
    inviteSuccess: string;
    invalidEmail: string;
    inviteExists: string;
    alreadyMember: string;
    cannotInviteSelf: string;
    emailUnavailable: string;
    actionFailed: string;
    startSession: string;
    memberRequirementPrompt: string;
  };
};

export const DashboardGroupZone = memo(function DashboardGroupZone({
  locale,
  groups,
  createGroupHref,
  labels,
}: DashboardGroupZoneProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? '');
  const liveSignatureRef = useRef('');
  const selectedGroup = useMemo(
    () =>
      groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null,
    [groups, selectedGroupId],
  );
  const liveGroupCount = groups.filter((group) => group.hasLiveSession).length;
  const selectedMembers = selectedGroup?.membersPreview ?? [];
  const selectedMaxMembers = selectedGroup?.maxMembers ?? 5;
  const selectedActiveSession = selectedGroup?.hasLiveSession
    ? (selectedGroup.activeSession ?? null)
    : null;
  const selectedNextSession = selectedGroup?.nextSession ?? null;
  const selectedSession = selectedActiveSession ?? selectedNextSession;
  const sessionHref = selectedSession
    ? `/${locale}/sessions/${selectedSession.id}`
    : null;
  const activeProgress = selectedActiveSession
    ? getLiveSessionProgress(selectedActiveSession)
    : null;
  const recentSessions = selectedGroup?.recentSessions?.slice(0, 3) ?? [];
  const selectedSeatsAvailable = selectedGroup
    ? Math.max(0, selectedMaxMembers - selectedGroup.memberCount)
    : 0;
  const canInviteSelectedGroup = Boolean(
    selectedGroup && selectedSeatsAvailable > 0,
  );
  const shouldShowMemberPrompt = Boolean(
    selectedGroup &&
    selectedGroup.memberCount < 2 &&
    selectedSeatsAvailable > 0 &&
    !selectedGroup.hasLiveSession,
  );
  const canStartSelectedGroup = Boolean(
    selectedGroup &&
    selectedGroup.memberCount >= 2 &&
    !selectedGroup.hasLiveSession &&
    !shouldShowMemberPrompt,
  );
  const showCreateAnotherAction = !shouldShowMemberPrompt;
  const normalizedInviteEmail = inviteEmail.trim().toLowerCase();

  useEffect(() => {
    if (groups.length === 0) {
      setSelectedGroupId('');
      liveSignatureRef.current = '';
      return;
    }

    const firstGroup = groups[0];
    if (firstGroup && !groups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(firstGroup.id);
    }
  }, [groups, selectedGroupId]);

  useEffect(() => {
    const liveSignature = getLiveGroupsSignature(groups);
    const mostRecentLiveGroupId = getMostRecentLiveGroupId(groups);

    if (!mostRecentLiveGroupId) {
      liveSignatureRef.current = liveSignature;
      return;
    }

    if (
      liveSignatureRef.current !== liveSignature ||
      !groups.some((group) => group.id === selectedGroupId)
    ) {
      setSelectedGroupId(mostRecentLiveGroupId);
    }

    liveSignatureRef.current = liveSignature;
  }, [groups, selectedGroupId]);

  return (
    <section className="v11-card">
      <div className="v11-card-head !mb-0 flex-col !items-stretch lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-wrap items-center gap-[18px]">
          <div className="relative">
            <button
              type="button"
              className={`flex items-center gap-2 rounded-[10px] px-2 py-1 text-[20px] font-medium tracking-[-0.02em] text-[#e8f4f0] transition hover:bg-white/[0.03] ${
                isOpen ? 'bg-white/[0.03]' : ''
              }`}
              aria-expanded={isOpen}
              onClick={() => setIsOpen((current) => !current)}
            >
              {selectedGroup?.hasLiveSession ? (
                <span className="live-dot" aria-hidden="true" />
              ) : null}
              <span className="max-w-[260px] truncate">
                {selectedGroup?.name ?? labels.noGroups}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[#8fa7a2] transition ${
                  isOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {isOpen ? (
              <div className="absolute left-0 z-20 mt-2 w-[min(320px,calc(100vw-48px))] overflow-hidden rounded-[14px] border border-white/[0.09] bg-[#0d2924] p-1.5 shadow-[0_24px_48px_rgba(0,0,0,0.45)]">
                {groups.length > 0 ? (
                  groups.map((group) => {
                    const isSelected = selectedGroup?.id === group.id;

                    return (
                      <button
                        key={group.id}
                        type="button"
                        className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition hover:bg-white/[0.04] ${
                          isSelected ? 'bg-[#20D9A3]/10' : ''
                        }`}
                        onClick={() => {
                          setSelectedGroupId(group.id);
                          setIsOpen(false);
                        }}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.09] bg-[#22504a] text-[11px] font-medium text-[#9FF0CE]">
                          {group.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-2">
                            {group.hasLiveSession ? (
                              <span className="live-dot" aria-hidden="true" />
                            ) : null}
                            <span className="truncate text-[14px] font-medium text-[#e8f4f0]">
                              {group.name}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-[12px] font-normal text-[#8fa7a2]">
                            {group.memberCount}/{group.maxMembers ?? 5}{' '}
                            {labels.seats}
                            {group.hasLiveSession ? ` · ${labels.live}` : ''}
                          </span>
                        </span>
                        {isSelected ? (
                          <Check
                            className="h-4 w-4 shrink-0 text-[#20D9A3]"
                            aria-hidden="true"
                          />
                        ) : null}
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-4 text-[14px] font-medium text-[#8fa7a2]">
                    {labels.noGroups}
                  </p>
                )}
                {showCreateAnotherAction ? (
                  <a
                    href={createGroupHref}
                    className="mt-1 flex items-center gap-2 border-t border-white/[0.045] px-3 py-2.5 text-[13px] font-medium text-[#20D9A3] transition hover:bg-[#20D9A3]/[0.06]"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {labels.createAnother}
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex items-center">
            <MemberAvatarStack members={selectedMembers} />
            {selectedGroup &&
            selectedGroup.memberCount > selectedMembers.length ? (
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0e2c28] bg-white/[0.06] text-[11px] font-medium text-[#8fa7a2]"
                style={{ marginLeft: -10 }}
              >
                +{selectedGroup.memberCount - selectedMembers.length}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-[18px]">
          {selectedGroup ? (
            <div className="flex items-center gap-3">
              <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-white/[0.045] bg-white/[0.04] text-[#8fa7a2]">
                <UsersRound className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="flex flex-col">
                <span className="text-[13px] text-[#8fa7a2]">
                  {labels.dropdownLabel}
                </span>
                <span className="text-[14px] text-[#e8f4f0]">
                  {selectedGroup.memberCount}/{selectedMaxMembers}{' '}
                  {labels.seats}
                </span>
              </span>
            </div>
          ) : null}
          {liveGroupCount > 0 ? (
            <span className="v11-chip v11-chip-mint">
              <span className="live-dot" aria-hidden="true" />
              {liveGroupCount} {labels.live}
            </span>
          ) : null}
          {showCreateAnotherAction ? (
            <a
              href={createGroupHref}
              className="inline-flex items-center gap-2 rounded-[12px] bg-[#20D9A3] px-[18px] py-3 text-[14px] font-medium leading-none text-[#062b22] transition hover:bg-[#2fe9b1]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {labels.createAnother}
            </a>
          ) : null}
        </div>
      </div>

      {shouldShowMemberPrompt && selectedGroup ? (
        <div className="mt-[18px] flex items-center gap-3 rounded-[14px] border border-[#20D9A3]/20 bg-[#20D9A3]/[0.07] px-4 py-3 text-[#e8f4f0]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-[#20D9A3]/20 bg-[#20D9A3]/10 text-[#9FF0CE]">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-[14px] font-semibold leading-snug">
            {labels.memberRequirementPrompt.replace(
              '{count}',
              String(selectedGroup.memberCount),
            )}
          </span>
        </div>
      ) : null}

      {selectedGroup && (canInviteSelectedGroup || canStartSelectedGroup) ? (
        <div className="mt-[18px] flex flex-col gap-2.5 sm:flex-row">
          {canInviteSelectedGroup ? (
            <button
              type="button"
              onClick={() => {
                setInviteError(null);
                setIsInviteOpen(true);
              }}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[12px] border border-[#20D9A3]/25 bg-[#20D9A3]/10 px-4 text-[14px] font-semibold text-[#9FF0CE] transition hover:border-[#20D9A3]/45 hover:bg-[#20D9A3]/15 sm:flex-none"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              {labels.invite}
            </button>
          ) : null}

          {canStartSelectedGroup ? (
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('activeboard:open-create-session', {
                    detail: { groupId: selectedGroup.id },
                  }),
                );
              }}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[12px] bg-[#20D9A3] px-4 text-[14px] font-semibold text-[#062b22] transition hover:bg-[#2fe9b1] sm:flex-none"
            >
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              {labels.startSession}
            </button>
          ) : null}
        </div>
      ) : null}

      {selectedGroup ? (
        <div className="mt-[22px]">
          {selectedActiveSession ? (
            <a
              href={`/${locale}/sessions/${selectedActiveSession.id}`}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => {
                if (!isPrimaryPlainClick(event)) {
                  return;
                }

                event.preventDefault();
                void openSessionInManagedTab(
                  selectedActiveSession.id,
                  `/${locale}/sessions/${selectedActiveSession.id}`,
                );
              }}
              className="group flex flex-col gap-4 rounded-[14px] border border-[#20D9A3]/35 bg-[linear-gradient(135deg,rgba(32,217,163,0.12),rgba(32,217,163,0.025))] px-5 py-[18px] transition hover:border-[#20D9A3]/60 hover:bg-[#20D9A3]/[0.08] sm:flex-row sm:items-center"
            >
              <span className="flex min-w-0 flex-1 items-start gap-4">
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] border border-[#20D9A3]/25 bg-[#20D9A3]/15 text-[#9FF0CE]">
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="inline-flex items-center gap-2 rounded-[6px] bg-[#20D9A3]/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9FF0CE]">
                    <span className="live-dot" aria-hidden="true" />
                    {labels.live}
                  </span>
                  <span className="mt-2 block truncate text-[16px] font-medium tracking-[-0.015em] text-[#e8f4f0]">
                    {selectedActiveSession.name ?? labels.nextSession}
                  </span>
                  {activeProgress ? (
                    <>
                      <span className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-[#8fa7a2]">
                        <span className="font-semibold text-[#e8f4f0]">
                          Q{activeProgress.current}/{activeProgress.total}
                        </span>
                        <span className="text-[#345049]">·</span>
                        <span>
                          {selectedGroup.memberCount} {labels.members}
                        </span>
                      </span>
                      <span className="mt-3 block h-2 overflow-hidden rounded-full bg-[#102b27]">
                        <span
                          className="block h-full rounded-full bg-[#20D9A3] shadow-[0_0_18px_rgba(32,217,163,0.42)]"
                          style={{ width: `${activeProgress.percent}%` }}
                        />
                      </span>
                    </>
                  ) : null}
                </span>
              </span>
              <span className="inline-flex w-full shrink-0 items-center justify-center rounded-[10px] bg-[#20D9A3] px-4 py-2.5 text-[13px] font-semibold text-[#062b22] transition group-hover:bg-[#2fe9b1] sm:w-auto">
                {labels.joinLiveSession}
              </span>
            </a>
          ) : selectedNextSession && sessionHref ? (
            <a
              href={sessionHref}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => {
                if (!isPrimaryPlainClick(event)) {
                  return;
                }

                event.preventDefault();
                void openSessionInManagedTab(
                  selectedNextSession.id,
                  sessionHref,
                );
              }}
              className="flex items-center gap-4 rounded-[14px] border border-white/[0.045] bg-white/[0.02] px-5 py-[18px] transition hover:border-white/[0.09] hover:bg-white/[0.035]"
            >
              <span className="bg-[#6BA8F2]/12 flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] border border-[#6BA8F2]/25 text-[#A8C9F4]">
                <CalendarClock className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-[11px] font-normal tracking-[0.04em] text-[#8fa7a2]">
                  {labels.nextSession}
                </span>
                <span className="mt-0.5 block truncate text-[16px] font-medium tracking-[-0.015em] text-[#e8f4f0]">
                  {selectedNextSession.name ?? labels.nextSession}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-[#8fa7a2]">
                  {labels.scheduledFor.replace(
                    '{date}',
                    formatSessionDate(selectedNextSession.scheduled_at, locale),
                  )}
                  <span className="text-[#345049]">·</span>
                  {labels.timerLabel.replace(
                    '{seconds}',
                    String(selectedNextSession.timer_seconds),
                  )}
                </span>
              </span>
              <span className="v11-chip">{labels.openSession}</span>
            </a>
          ) : (
            <div className="flex items-center gap-4 rounded-[14px] border border-dashed border-white/[0.09] bg-transparent px-5 py-[18px] text-[#8fa7a2]">
              <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] border border-white/[0.045] bg-white/[0.03] text-[#5c7773]">
                <CalendarClock className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-medium text-[#e8f4f0]">
                  {labels.noUpcomingSession}
                </span>
                <span className="mt-1 block text-[13px] text-[#5c7773]">
                  {labels.subtitle}
                </span>
              </span>
            </div>
          )}
        </div>
      ) : null}

      {selectedGroup && recentSessions.length > 0 ? (
        <footer className="mt-[22px] border-t border-white/[0.055] pt-[18px]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-[13px] font-medium uppercase tracking-[0.12em] text-[#8fa7a2]">
              {labels.recentSessions}
            </h3>
          </div>
          <div className="grid gap-2.5 lg:grid-cols-3">
            {recentSessions.map((session) => (
              <a
                key={session.id}
                href={`/${locale}/sessions/${session.id}`}
                className="rounded-[12px] border border-white/[0.045] bg-white/[0.018] px-4 py-3 transition hover:border-white/[0.09] hover:bg-white/[0.035]"
              >
                <span className="flex min-w-0 items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium tracking-[-0.01em] text-[#e8f4f0]">
                      {session.name ?? labels.nextSession}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-[#8fa7a2]">
                      <span>
                        {labels.captain} {session.leaderInitials ?? 'AB'}
                      </span>
                      <span className="text-[#345049]">·</span>
                      <span>
                        {session.questionCount ?? 0} {labels.questionsUnit}
                      </span>
                    </span>
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#20D9A3]/20 bg-[#20D9A3]/10 text-[11px] font-semibold text-[#9FF0CE]">
                    {session.leaderInitials ?? 'AB'}
                  </span>
                </span>
                <span className="mt-3 grid grid-cols-2 gap-2">
                  <MetricPill
                    label={labels.completion}
                    value={`${session.completionPercent ?? 0}%`}
                  />
                  <MetricPill
                    label={labels.accuracy}
                    value={
                      session.accuracyPercent === null ||
                      session.accuracyPercent === undefined
                        ? labels.noData
                        : `${session.accuracyPercent}%`
                    }
                  />
                </span>
              </a>
            ))}
          </div>
          <a
            href={`/${locale}/dashboard?view=sessions`}
            className="mt-3 inline-flex text-[13px] font-medium text-[#20D9A3] transition hover:text-[#9FF0CE]"
          >
            {labels.viewAllSessions}
          </a>
        </footer>
      ) : null}

      {selectedGroup && isInviteOpen ? (
        <Modal
          open
          onClose={() => setIsInviteOpen(false)}
          labelledBy="dashboard-group-invite-title"
          contentClassName="w-full rounded-t-[18px] border border-white/[0.08] bg-[#081b18] shadow-2xl sm:max-w-[520px] sm:rounded-[18px]"
        >
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#20D9A3]/10 text-[#9FF0CE]">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                </span>
                <ModalTitle
                  id="dashboard-group-invite-title"
                  className="mt-4 text-xl font-semibold tracking-[-0.02em] text-[#e8f4f0]"
                >
                  {labels.inviteTitle}
                </ModalTitle>
                <p className="mt-2 text-sm leading-5 text-[#8fa7a2]">
                  {labels.inviteDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteOpen(false)}
                className="rounded-full p-2 text-[#8fa7a2] transition hover:bg-white/[0.06] hover:text-white"
                aria-label={labels.inviteTitle}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void sendDashboardGroupInvite({
                      groupId: selectedGroup.id,
                      locale,
                      email: normalizedInviteEmail,
                      labels,
                      setInviteError,
                      setIsInviting,
                      setInviteEmail,
                    });
                  }
                }}
                placeholder={labels.inviteEmailPlaceholder}
                autoComplete="email"
                className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-white/[0.08] bg-[#031411] px-3 py-2 text-sm text-[#e8f4f0] outline-none transition placeholder:text-[#5f7b75] focus:border-[#20D9A3]/55"
              />
              <button
                type="button"
                disabled={isInviting}
                onClick={() =>
                  void sendDashboardGroupInvite({
                    groupId: selectedGroup.id,
                    locale,
                    email: normalizedInviteEmail,
                    labels,
                    setInviteError,
                    setIsInviting,
                    setInviteEmail,
                  })
                }
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[#20D9A3] px-4 text-sm font-semibold text-[#062b22] transition hover:bg-[#2fe9b1] disabled:cursor-wait disabled:bg-white/[0.08] disabled:text-[#5f7b75]"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {isInviting ? labels.inviteSending : labels.inviteSend}
              </button>
            </div>

            {inviteError ? (
              <p className="mt-3 rounded-[8px] border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm font-semibold text-red-200">
                {inviteError}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </section>
  );
});

function formatSessionDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getLiveSessionProgress(session: DashboardGroupZoneSession) {
  const total = Math.max(
    1,
    session.question_goal ||
      session.questionCount ||
      session.answeredQuestionCount ||
      1,
  );
  const current = Math.min(
    total,
    Math.max(1, session.questionCount ?? session.answeredQuestionCount ?? 1),
  );

  return {
    current,
    total,
    percent: Math.round((current / total) * 100),
  };
}

function getLiveGroupsSignature(groups: DashboardGroupZoneGroup[]) {
  return groups
    .filter((group) => group.hasLiveSession && group.activeSession)
    .map((group) => {
      const session = group.activeSession;
      return `${group.id}:${session?.id ?? ''}:${session?.started_at ?? session?.scheduled_at ?? ''}`;
    })
    .sort()
    .join('|');
}

function getMostRecentLiveGroupId(groups: DashboardGroupZoneGroup[]) {
  let selected: { groupId: string; startedAt: number } | null = null;

  for (const group of groups) {
    if (!group.hasLiveSession || !group.activeSession) {
      continue;
    }

    const startedAt = getSessionStartTime(group.activeSession);
    if (!selected || startedAt > selected.startedAt) {
      selected = { groupId: group.id, startedAt };
    }
  }

  return selected?.groupId ?? null;
}

function getSessionStartTime(session: DashboardGroupZoneSession) {
  const timestamp = new Date(
    session.started_at ?? session.scheduled_at,
  ).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isPrimaryPlainClick(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function notifyDashboardGroupAction(
  message: string,
  tone: 'success' | 'error',
) {
  window.dispatchEvent(
    new CustomEvent('activeboard:feedback', {
      detail: {
        id: `dashboard-group-action-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        message,
        tone,
      },
    }),
  );
}

async function sendDashboardGroupInvite({
  groupId,
  locale,
  email,
  labels,
  setInviteError,
  setIsInviting,
  setInviteEmail,
}: {
  groupId: string;
  locale: string;
  email: string;
  labels: DashboardGroupZoneProps['labels'];
  setInviteError: (message: string | null) => void;
  setIsInviting: (value: boolean) => void;
  setInviteEmail: (value: string) => void;
}) {
  if (!EMAIL_PATTERN.test(email)) {
    setInviteError(labels.invalidEmail);
    return;
  }

  setInviteError(null);
  setIsInviting(true);

  try {
    const response = await fetch(`/api/groups/${groupId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ emails: [email], locale }),
    });
    const payload = (await response.json().catch(() => null)) as {
      created?: unknown[];
      errors?: Array<{ reason?: string }>;
    } | null;
    const firstError = payload?.errors?.[0];

    if (!response.ok || firstError) {
      const message = getInviteErrorMessage(
        firstError?.reason ?? 'action_failed',
        labels,
      );
      setInviteError(message);
      notifyDashboardGroupAction(message, 'error');
      return;
    }

    setInviteEmail('');
    notifyDashboardGroupAction(labels.inviteSuccess, 'success');
  } catch {
    setInviteError(labels.actionFailed);
    notifyDashboardGroupAction(labels.actionFailed, 'error');
  } finally {
    setIsInviting(false);
  }
}

function getInviteErrorMessage(
  reason: string,
  labels: DashboardGroupZoneProps['labels'],
) {
  switch (reason) {
    case 'invalid_email':
      return labels.invalidEmail;
    case 'invite_exists':
      return labels.inviteExists;
    case 'already_member':
      return labels.alreadyMember;
    case 'cannot_invite_self':
      return labels.cannotInviteSelf;
    case 'email_unavailable':
    case 'email_failed':
      return labels.emailUnavailable;
    default:
      return labels.actionFailed;
  }
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-[9px] border border-white/[0.04] bg-[#061c19] px-3 py-2">
      <span className="block truncate text-[11px] text-[#5f7b75]">{label}</span>
      <span className="mt-0.5 block truncate text-[13px] font-semibold text-[#e8f4f0]">
        {value}
      </span>
    </span>
  );
}

function MemberAvatarStack({
  members,
}: {
  members: DashboardGroupZoneGroup['membersPreview'];
}) {
  const safeMembers = members ?? [];

  if (safeMembers.length === 0) {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0e2c28] bg-white/[0.05] text-[#8fa7a2]">
        <UsersRound className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }

  return (
    <>
      {safeMembers.map((member, index) => (
        <span
          key={member.id}
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0e2c28] bg-[#22504a] bg-cover bg-center text-[11px] font-medium text-[#9FF0CE]"
          style={{
            marginLeft: index === 0 ? 0 : -10,
            backgroundImage: member.avatarUrl
              ? `url("${member.avatarUrl}")`
              : undefined,
          }}
          title={member.initials}
        >
          {member.avatarUrl ? null : member.initials}
        </span>
      ))}
    </>
  );
}
