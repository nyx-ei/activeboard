'use client';

import {
  useCallback,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import {
  ArrowRight,
  Bell,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  Lock,
  LogOut,
  Mail,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Send,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';

import { useRouter } from '@/i18n/navigation';
import { Modal, ModalTitle } from '@/components/ui/modal';

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

type DashboardGroupNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};

export type DashboardGroupZoneProps = {
  locale: string;
  groups: DashboardGroupZoneGroup[];
  initialGroupId?: string;
  createGroupHref: string;
  liveGroupsHref: string;
  canBrowseLookupLayer: boolean;
  labels: {
    title: string;
    subtitle: string;
    dropdownLabel: string;
    groupsListTitle: string;
    manageMembers: string;
    scheduleSession: string;
    groupNotifications: string;
    leaveGroup: string;
    manageMembersTitle: string;
    manageMembersDescription: string;
    confirmedMembers: string;
    seatsAvailable: string;
    notificationsTitle: string;
    notificationsDescription: string;
    notificationsEmpty: string;
    notificationsUnread: string;
    notificationsLoading: string;
    leaveGroupTitle: string;
    leaveGroupDescription: string;
    leaveGroupConfirm: string;
    leaveGroupPending: string;
    leaveGroupSuccess: string;
    leaveGroupBlocked: string;
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
    editSession: string;
    cancelSession: string;
    cancelSessionSuccess: string;
    memberRequirementPrompt: string;
    exploreLiveGroupsTitle: string;
    exploreLiveGroupsDescription: string;
    exploreLiveGroupsLockedTitle: string;
    exploreLiveGroupsLockedDescription: string;
    exploreLiveGroupsCta: string;
    exploreLiveGroupsUpgrade: string;
  };
};

export const DashboardGroupZone = memo(function DashboardGroupZone({
  locale,
  groups,
  initialGroupId,
  createGroupHref,
  liveGroupsHref,
  canBrowseLookupLayer,
  labels,
}: DashboardGroupZoneProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<
    'members' | 'notifications' | 'leave' | null
  >(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [notifications, setNotifications] = useState<
    DashboardGroupNotification[]
  >([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [cancellingSessionId, setCancellingSessionId] = useState<
    string | null
  >(null);
  const [selectedGroupId, setSelectedGroupId] = useState(
    initialGroupId && groups.some((group) => group.id === initialGroupId)
      ? initialGroupId
      : (groups[0]?.id ?? ''),
  );
  const router = useRouter();
  const groupMenuRef = useRef<HTMLDivElement | null>(null);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);
  const liveSignatureRef = useRef('');
  const selectedGroup = useMemo(
    () =>
      groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null,
    [groups, selectedGroupId],
  );
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
  const normalizedInviteEmail = inviteEmail.trim().toLowerCase();

  function prefetchSession(href: string | null) {
    if (href) {
      router.prefetch(href as never);
    }
  }

  const loadNotifications = useCallback(
    async (groupId: string) => {
      setIsLoadingNotifications(true);

      try {
        const response = await fetch(
          `/api/groups/${groupId}/notifications?locale=${locale}`,
          {
            cache: 'no-store',
            credentials: 'same-origin',
          },
        );
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          unreadCount?: number;
          notifications?: DashboardGroupNotification[];
        } | null;

        if (!response.ok || !payload?.ok) {
          return;
        }

        setNotifications(payload.notifications ?? []);
        setUnreadNotificationCount(payload.unreadCount ?? 0);
      } finally {
        setIsLoadingNotifications(false);
      }
    },
    [locale],
  );

  useEffect(() => {
    if (groups.length === 0) {
      setSelectedGroupId('');
      liveSignatureRef.current = '';
      return;
    }

    const requestedGroup = initialGroupId
      ? groups.find((group) => group.id === initialGroupId)
      : null;
    if (requestedGroup && selectedGroupId !== requestedGroup.id) {
      setSelectedGroupId(requestedGroup.id);
      return;
    }

    const firstGroup = groups[0];
    if (firstGroup && !groups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(firstGroup.id);
    }
  }, [groups, initialGroupId, selectedGroupId]);

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

  useEffect(() => {
    if (sessionHref) {
      router.prefetch(sessionHref as never);
    }
  }, [router, sessionHref]);

  useEffect(() => {
    if (!selectedGroup?.id) {
      setNotifications([]);
      setUnreadNotificationCount(0);
      return;
    }

    void loadNotifications(selectedGroup.id);
  }, [loadNotifications, selectedGroup?.id]);

  useEffect(() => {
    if (!isOpen && !isOverflowOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;

      if (!target) {
        return;
      }

      if (
        groupMenuRef.current?.contains(target) ||
        overflowMenuRef.current?.contains(target)
      ) {
        return;
      }

      setIsOpen(false);
      setIsOverflowOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen, isOverflowOpen]);

  return (
    <section className="v11-card px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
          <div ref={groupMenuRef} className="relative">
            <button
              type="button"
              className={`flex items-center gap-2 rounded-[10px] px-1 py-1 text-[21px] font-medium tracking-[-0.035em] text-[#e8f4f0] transition hover:bg-white/[0.03] sm:px-2 sm:text-[24px] ${
                isOpen ? 'bg-white/[0.03]' : ''
              }`}
              aria-expanded={isOpen}
              onClick={() => {
                setIsOpen((current) => !current);
                setIsOverflowOpen(false);
              }}
            >
              {selectedGroup?.hasLiveSession ? (
                <span className="live-dot" aria-hidden="true" />
              ) : null}
              <span className="max-w-[240px] truncate">
                {selectedGroup?.name ?? labels.noGroups}
              </span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-[#8fa7a2] transition ${
                  isOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            {isOpen ? (
              <div className="absolute left-0 z-30 mt-2 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-[14px] border border-white/[0.09] bg-[#0d332d] p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
                <p className="px-3 pb-2 pt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[#6f8984]">
                  {labels.groupsListTitle}
                </p>
                {groups.length > 0 ? (
                  groups.map((group) => {
                    const isSelected = selectedGroup?.id === group.id;

                    return (
                      <button
                        key={group.id}
                        type="button"
                        className={`flex w-full items-center gap-3 rounded-[11px] px-3 py-2.5 text-left transition hover:bg-white/[0.04] ${
                          isSelected ? 'bg-[#20D9A3]/10' : ''
                        }`}
                        onClick={() => {
                          setSelectedGroupId(group.id);
                          setIsOpen(false);
                          setIsOverflowOpen(false);
                        }}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-white/[0.09] bg-[#22504a] text-[12px] font-semibold text-white">
                          {getGroupInitials(group.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-2">
                            {group.hasLiveSession ? (
                              <span className="live-dot" aria-hidden="true" />
                            ) : null}
                            <span className="truncate text-[15px] font-semibold text-[#e8f4f0]">
                              {group.name}
                            </span>
                          </span>
                          <span className="mt-1 block text-[13px] font-normal text-[#8fa7a2]">
                            {group.memberCount} {labels.members} ·{' '}
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
                <a
                  href={createGroupHref}
                  className="mt-1 flex items-center gap-2 border-t border-white/[0.045] px-3 py-3 text-[14px] font-medium text-[#20D9A3] transition hover:bg-[#20D9A3]/[0.06]"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {labels.createAnother}
                </a>
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

        <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex sm:flex-row sm:items-center sm:gap-3">
          {selectedGroup ? (
            <button
              type="button"
              disabled={!canInviteSelectedGroup}
              onClick={() => {
                if (!canInviteSelectedGroup) {
                  return;
                }

                setInviteError(null);
                setIsInviteOpen(true);
              }}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-[12px] border px-4 text-[14px] font-semibold transition sm:h-12 sm:px-5 sm:text-[15px] ${
                canInviteSelectedGroup
                  ? 'border-white/[0.06] bg-white/[0.02] text-[#e8f4f0] hover:border-[#20D9A3]/35 hover:bg-[#20D9A3]/10'
                  : 'cursor-not-allowed border-white/[0.04] bg-white/[0.012] text-[#5f7b75]'
              }`}
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              {labels.invite}
            </button>
          ) : null}

          {selectedGroup && !shouldShowMemberPrompt ? (
            <div ref={overflowMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsOverflowOpen((current) => !current);
                  setIsOpen(false);
                }}
                className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] border border-white/[0.06] bg-white/[0.02] text-[#8fa7a2] transition hover:border-white/[0.1] hover:bg-white/[0.04] hover:text-white sm:h-12 sm:w-12"
                aria-expanded={isOverflowOpen}
                aria-label={labels.dropdownLabel}
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              </button>
              {isOverflowOpen ? (
                <div className="absolute right-0 z-30 mt-2 w-[min(270px,calc(100vw-32px))] rounded-[14px] border border-white/[0.09] bg-[#0d332d] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
                  <GroupOverflowItem
                    icon={<UsersRound className="h-5 w-5" aria-hidden="true" />}
                    label={labels.manageMembers}
                    onClick={() => {
                      setIsOverflowOpen(false);
                      setActivePanel('members');
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsOverflowOpen(false);
                      window.dispatchEvent(
                        new CustomEvent('activeboard:open-create-session', {
                          detail: { groupId: selectedGroup.id },
                        }),
                      );
                    }}
                    className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[14px] font-medium text-[#e8f4f0] transition hover:bg-white/[0.04]"
                  >
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                    {labels.scheduleSession}
                  </button>
                  <GroupOverflowItem
                    icon={<Bell className="h-5 w-5" aria-hidden="true" />}
                    label={labels.groupNotifications}
                    badge={
                      unreadNotificationCount > 0
                        ? String(Math.min(unreadNotificationCount, 99))
                        : undefined
                    }
                    onClick={() => {
                      setIsOverflowOpen(false);
                      setActivePanel('notifications');
                      if (selectedGroup?.id) {
                        void loadNotifications(selectedGroup.id);
                      }
                    }}
                  />
                  <GroupOverflowItem
                    icon={<LogOut className="h-5 w-5" aria-hidden="true" />}
                    label={labels.leaveGroup}
                    onClick={() => {
                      setIsOverflowOpen(false);
                      setActivePanel('leave');
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {canStartSelectedGroup && selectedGroup ? (
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('activeboard:open-create-session', {
                    detail: { groupId: selectedGroup.id },
                  }),
                );
              }}
              className="col-span-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[#20D9A3] px-5 text-[14px] font-semibold text-[#062b22] transition hover:bg-[#2fe9b1] sm:col-auto sm:h-12 sm:w-auto sm:px-6 sm:text-[15px]"
            >
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              {labels.startSession}
            </button>
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

      {selectedGroup ? (
        <div className="mt-4 sm:mt-[22px]">
          {selectedActiveSession ? (
            <a
              href={`/${locale}/sessions/${selectedActiveSession.id}`}
              onFocus={() =>
                prefetchSession(`/${locale}/sessions/${selectedActiveSession.id}`)
              }
              onPointerEnter={() =>
                prefetchSession(`/${locale}/sessions/${selectedActiveSession.id}`)
              }
              className="group grid grid-cols-[1fr_auto] items-center gap-3 rounded-[14px] border border-[#20D9A3]/35 bg-[linear-gradient(135deg,rgba(32,217,163,0.12),rgba(32,217,163,0.025))] px-3 py-3 transition hover:border-[#20D9A3]/60 hover:bg-[#20D9A3]/[0.08] sm:flex sm:flex-row sm:items-center sm:gap-4 sm:px-5 sm:py-4"
            >
              <span className="flex min-w-0 flex-1 items-center gap-3 sm:items-start sm:gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#20D9A3]/25 bg-[#20D9A3]/15 text-[#9FF0CE] sm:h-[42px] sm:w-[42px] sm:rounded-[11px]">
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="inline-flex items-center gap-2 rounded-[6px] bg-[#20D9A3]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9FF0CE] sm:px-2.5 sm:py-1 sm:text-[11px]">
                    <span className="live-dot" aria-hidden="true" />
                    {labels.live}
                  </span>
                  <span className="mt-1 block truncate text-[14px] font-medium tracking-[-0.015em] text-[#e8f4f0] sm:mt-2 sm:text-[16px]">
                    {selectedActiveSession.name ?? labels.nextSession}
                  </span>
                  {activeProgress ? (
                    <>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-[#8fa7a2] sm:mt-2 sm:gap-2 sm:text-[13px]">
                        <span className="font-semibold text-[#e8f4f0]">
                          Q{activeProgress.current}/{activeProgress.total}
                        </span>
                        <span className="text-[#345049]">·</span>
                        <span>
                          {selectedGroup.memberCount} {labels.members}
                        </span>
                      </span>
                      <span className="mt-2 hidden h-2 overflow-hidden rounded-full bg-[#102b27] sm:block">
                        <span
                          className="block h-full rounded-full bg-[#20D9A3] shadow-[0_0_18px_rgba(32,217,163,0.42)]"
                          style={{ width: `${activeProgress.percent}%` }}
                        />
                      </span>
                    </>
                  ) : null}
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center justify-center rounded-[10px] border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[13px] font-semibold text-[#e8f4f0] transition group-hover:border-[#20D9A3]/40 group-hover:bg-[#20D9A3]/10 sm:w-auto sm:bg-[#20D9A3] sm:px-4 sm:py-2.5 sm:text-[#062b22] sm:group-hover:bg-[#2fe9b1]">
                {labels.joinLiveSession}
              </span>
            </a>
          ) : selectedNextSession && sessionHref ? (
            <div
              className="flex flex-col gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.018] px-3 py-3 transition hover:border-white/[0.1] hover:bg-white/[0.03] sm:flex-row sm:items-center sm:gap-4 sm:px-5 sm:py-4"
            >
              <a
                href={sessionHref}
                onFocus={() => prefetchSession(sessionHref)}
                onPointerEnter={() => prefetchSession(sessionHref)}
                className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#6BA8F2]/25 bg-[#6BA8F2]/15 text-[#A8C9F4] sm:h-11 sm:w-11 sm:rounded-[11px]">
                  <CalendarClock className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-[13px] font-normal tracking-[0.02em] text-[#8fa7a2]">
                    {labels.nextSession}
                  </span>
                  <span className="mt-1 block truncate text-[15px] font-semibold tracking-[-0.02em] text-[#e8f4f0] sm:mt-1.5 sm:text-[17px]">
                    {selectedNextSession.name ?? labels.nextSession}
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[#8fa7a2] sm:mt-2 sm:gap-2 sm:text-[13px]">
                    {labels.scheduledFor.replace(
                      '{date}',
                      formatSessionDate(
                        selectedNextSession.scheduled_at,
                        locale,
                      ),
                    )}
                    <span className="text-[#345049]">·</span>
                    {selectedNextSession.question_goal} {labels.questionsUnit}
                    <span className="text-[#345049]">·</span>
                    {labels.timerLabel.replace(
                      '{seconds}',
                      String(selectedNextSession.timer_seconds),
                    )}
                  </span>
                </span>
              </a>
              <span className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedGroup) {
                      return;
                    }

                    window.dispatchEvent(
                      new CustomEvent('activeboard:open-create-session', {
                        detail: { groupId: selectedGroup.id },
                      }),
                    );
                  }}
                  className="inline-flex h-9 items-center justify-center rounded-[10px] border border-white/[0.07] bg-white/[0.025] px-4 text-[12px] font-semibold text-[#e8f4f0] transition hover:border-white/[0.12] hover:bg-white/[0.045] sm:h-10 sm:px-5 sm:text-[13px]"
                >
                  {labels.editSession}
                </button>
                <button
                  type="button"
                  disabled={cancellingSessionId === selectedNextSession.id}
                  onClick={() =>
                    void cancelDashboardScheduledSession({
                      sessionId: selectedNextSession.id,
                      locale,
                      labels,
                      setCancellingSessionId,
                    })
                  }
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/[0.07] bg-white/[0.025] text-[#8fa7a2] transition hover:border-red-300/30 hover:bg-red-400/10 hover:text-red-100 disabled:cursor-wait disabled:opacity-60 sm:h-10 sm:w-10"
                  aria-label={labels.cancelSession}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-[14px] border border-dashed border-white/[0.09] bg-transparent px-3 py-3 text-[#8fa7a2] sm:gap-4 sm:px-5 sm:py-[18px]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-white/[0.045] bg-white/[0.03] text-[#5c7773] sm:h-[42px] sm:w-[42px] sm:rounded-[11px]">
                <CalendarClock className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-[#e8f4f0] sm:text-[16px]">
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

      <a
        href={liveGroupsHref}
        className={`group mt-[18px] flex flex-col gap-4 rounded-[14px] border px-4 py-4 transition sm:flex-row sm:items-center sm:justify-between sm:px-5 ${
          canBrowseLookupLayer
            ? 'border-[#20D9A3]/25 bg-[#20D9A3]/[0.07] hover:border-[#20D9A3]/45 hover:bg-[#20D9A3]/[0.1]'
            : 'border-amber-300/20 bg-amber-300/[0.055] hover:border-amber-300/30 hover:bg-amber-300/[0.075]'
        }`}
      >
        <span className="flex min-w-0 items-start gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] border ${
              canBrowseLookupLayer
                ? 'border-[#20D9A3]/25 bg-[#20D9A3]/[0.12] text-[#9FF0CE]'
                : 'border-amber-300/20 bg-amber-300/10 text-amber-100'
            }`}
          >
            {canBrowseLookupLayer ? (
              <Search className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Lock className="h-5 w-5" aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-[16px] font-semibold tracking-[-0.02em] text-[#e8f4f0]">
              {canBrowseLookupLayer
                ? labels.exploreLiveGroupsTitle
                : labels.exploreLiveGroupsLockedTitle}
            </span>
            <span className="mt-1 block max-w-[620px] text-[13px] leading-5 text-[#8fa7a2]">
              {canBrowseLookupLayer
                ? labels.exploreLiveGroupsDescription
                : labels.exploreLiveGroupsLockedDescription}
            </span>
          </span>
        </span>
        <span
          className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[10px] px-4 text-[13px] font-semibold transition ${
            canBrowseLookupLayer
              ? 'bg-[#20D9A3] text-[#062b22] group-hover:bg-[#2fe9b1]'
              : 'border border-amber-300/20 bg-amber-300/10 text-amber-100 group-hover:bg-amber-300/15'
          }`}
        >
          {canBrowseLookupLayer
            ? labels.exploreLiveGroupsCta
            : labels.exploreLiveGroupsUpgrade}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </a>

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
                onFocus={() =>
                  prefetchSession(`/${locale}/sessions/${session.id}`)
                }
                onPointerEnter={() =>
                  prefetchSession(`/${locale}/sessions/${session.id}`)
                }
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
            href={`/${locale}/dashboard`}
            className="mt-3 inline-flex text-[13px] font-medium text-[#20D9A3] transition hover:text-[#9FF0CE]"
          >
            {labels.viewAllSessions}
          </a>
        </footer>
      ) : null}

      {selectedGroup && activePanel === 'members' ? (
        <Modal
          open
          onClose={() => setActivePanel(null)}
          labelledBy="dashboard-group-members-title"
          contentClassName="w-full rounded-t-[18px] border border-white/[0.08] bg-[#081b18] shadow-2xl sm:max-w-[560px] sm:rounded-[18px]"
        >
          <div className="p-5 sm:p-6">
            <GroupPanelHeader
              id="dashboard-group-members-title"
              icon={<UsersRound className="h-4 w-4" aria-hidden="true" />}
              title={labels.manageMembersTitle}
              description={labels.manageMembersDescription}
              onClose={() => setActivePanel(null)}
            />

            <div className="mt-5 grid grid-cols-2 gap-3">
              <PanelStat
                label={labels.confirmedMembers}
                value={`${selectedGroup.memberCount}/${selectedMaxMembers}`}
              />
              <PanelStat
                label={labels.seatsAvailable}
                value={String(selectedSeatsAvailable)}
              />
            </div>

            <div className="mt-5 space-y-2">
              {selectedMembers.length > 0 ? (
                selectedMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-[12px] border border-white/[0.055] bg-white/[0.02] px-3 py-3"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-[#22504a] bg-cover bg-center text-[12px] font-semibold text-[#9FF0CE]"
                      style={{
                        backgroundImage: member.avatarUrl
                          ? `url("${member.avatarUrl}")`
                          : undefined,
                      }}
                    >
                      {member.avatarUrl ? null : member.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-[#e8f4f0]">
                        {member.initials}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-[#8fa7a2]">
                        {labels.members}
                      </span>
                    </span>
                  </div>
                ))
              ) : (
                <div className="rounded-[12px] border border-dashed border-white/[0.08] px-3 py-4 text-sm text-[#8fa7a2]">
                  {labels.noData}
                </div>
              )}
            </div>

            {canInviteSelectedGroup ? (
              <button
                type="button"
                onClick={() => {
                  setActivePanel(null);
                  setInviteError(null);
                  setIsInviteOpen(true);
                }}
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[#20D9A3] px-4 text-sm font-semibold text-[#062b22] transition hover:bg-[#2fe9b1]"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                {labels.invite}
              </button>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {selectedGroup && activePanel === 'notifications' ? (
        <Modal
          open
          onClose={() => setActivePanel(null)}
          labelledBy="dashboard-group-notifications-title"
          contentClassName="w-full rounded-t-[18px] border border-white/[0.08] bg-[#081b18] shadow-2xl sm:max-w-[520px] sm:rounded-[18px]"
        >
          <div className="p-5 sm:p-6">
            <GroupPanelHeader
              id="dashboard-group-notifications-title"
              icon={<Bell className="h-4 w-4" aria-hidden="true" />}
              title={labels.notificationsTitle}
              description={
                unreadNotificationCount > 0
                  ? labels.notificationsUnread.replace(
                      '{count}',
                      String(unreadNotificationCount),
                    )
                  : labels.notificationsDescription
              }
              onClose={() => setActivePanel(null)}
            />

            <div className="mt-5 max-h-[min(70vh,520px)] space-y-2 overflow-y-auto pr-1">
              {isLoadingNotifications ? (
                <div className="rounded-[12px] border border-white/[0.055] bg-white/[0.02] px-4 py-5 text-sm font-semibold text-[#8fa7a2]">
                  {labels.notificationsLoading}
                </div>
              ) : notifications.length > 0 && selectedGroup ? (
                notifications.map((notification) => (
                  <NotificationListItem
                    key={notification.id}
                    notification={notification}
                    locale={locale}
                    onOpen={() =>
                      void openGroupNotification({
                        groupId: selectedGroup.id,
                        notification,
                        setNotifications,
                        setUnreadNotificationCount,
                        router,
                      })
                    }
                  />
                ))
              ) : (
                <div className="rounded-[12px] border border-dashed border-white/[0.08] px-4 py-5 text-sm font-semibold text-[#8fa7a2]">
                  {labels.notificationsEmpty}
                </div>
              )}
            </div>
          </div>
        </Modal>
      ) : null}

      {selectedGroup && activePanel === 'leave' ? (
        <Modal
          open
          onClose={() => setActivePanel(null)}
          labelledBy="dashboard-group-leave-title"
          contentClassName="w-full rounded-t-[18px] border border-white/[0.08] bg-[#081b18] shadow-2xl sm:max-w-[500px] sm:rounded-[18px]"
        >
          <div className="p-5 sm:p-6">
            <GroupPanelHeader
              id="dashboard-group-leave-title"
              icon={<LogOut className="h-4 w-4" aria-hidden="true" />}
              title={labels.leaveGroupTitle}
              description={labels.leaveGroupDescription.replace(
                '{group}',
                selectedGroup.name,
              )}
              onClose={() => setActivePanel(null)}
            />
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                className="inline-flex min-h-11 items-center justify-center rounded-[11px] border border-white/[0.08] px-4 text-sm font-semibold text-[#e8f4f0] transition hover:bg-white/[0.04]"
              >
                {labels.cancelSession}
              </button>
              <button
                type="button"
                disabled={isLeavingGroup}
                onClick={() =>
                  void leaveDashboardGroup({
                    groupId: selectedGroup.id,
                    locale,
                    labels,
                    setIsLeavingGroup,
                    onDone: () => setActivePanel(null),
                  })
                }
                className="inline-flex min-h-11 items-center justify-center rounded-[11px] bg-red-400 px-4 text-sm font-semibold text-[#250607] transition hover:bg-red-300 disabled:cursor-wait disabled:opacity-70"
              >
                {isLeavingGroup ? labels.leaveGroupPending : labels.leaveGroupConfirm}
              </button>
            </div>
          </div>
        </Modal>
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

async function cancelDashboardScheduledSession({
  sessionId,
  locale,
  labels,
  setCancellingSessionId,
}: {
  sessionId: string;
  locale: string;
  labels: DashboardGroupZoneProps['labels'];
  setCancellingSessionId: (value: string | null) => void;
}) {
  setCancellingSessionId(sessionId);

  try {
    const response = await fetch(`/api/sessions/${sessionId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({
        locale,
        returnTo: `/${locale}/dashboard`,
      }),
    });

    if (!response.ok) {
      notifyDashboardGroupAction(labels.actionFailed, 'error');
      return;
    }

    window.dispatchEvent(
      new CustomEvent('activeboard:dashboard-invalidate', {
        detail: { view: 'sessions' },
      }),
    );
    notifyDashboardGroupAction(labels.cancelSessionSuccess, 'success');
  } catch {
    notifyDashboardGroupAction(labels.actionFailed, 'error');
  } finally {
    setCancellingSessionId(null);
  }
}

async function leaveDashboardGroup({
  groupId,
  locale,
  labels,
  setIsLeavingGroup,
  onDone,
}: {
  groupId: string;
  locale: string;
  labels: DashboardGroupZoneProps['labels'];
  setIsLeavingGroup: (value: boolean) => void;
  onDone: () => void;
}) {
  setIsLeavingGroup(true);

  try {
    const response = await fetch(`/api/groups/${groupId}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ locale }),
    });
    const payload = (await response.json().catch(() => null)) as {
      reason?: string;
    } | null;

    if (!response.ok) {
      const message =
        payload?.reason === 'active_session'
          ? labels.leaveGroupBlocked
          : labels.actionFailed;
      notifyDashboardGroupAction(message, 'error');
      return;
    }

    onDone();
    window.dispatchEvent(
      new CustomEvent('activeboard:dashboard-invalidate', {
        detail: { view: 'sessions' },
      }),
    );
    notifyDashboardGroupAction(labels.leaveGroupSuccess, 'success');
  } catch {
    notifyDashboardGroupAction(labels.actionFailed, 'error');
  } finally {
    setIsLeavingGroup(false);
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

function getGroupInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return initials || 'AB';
}

function GroupOverflowItem({
  icon,
  label,
  badge,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[14px] font-medium text-[#e8f4f0] transition hover:bg-white/[0.04]"
    >
      <span className="text-[#8fa7a2]">{icon}</span>
      <span className="min-w-0 flex-1">{label}</span>
      {badge ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#20D9A3] px-1.5 py-0.5 text-[11px] font-bold leading-none text-[#062b22]">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function GroupPanelHeader({
  id,
  icon,
  title,
  description,
  onClose,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#20D9A3]/10 text-[#9FF0CE]">
          {icon}
        </span>
        <ModalTitle
          id={id}
          className="mt-4 text-xl font-semibold tracking-[-0.02em] text-[#e8f4f0]"
        >
          {title}
        </ModalTitle>
        <p className="mt-2 text-sm leading-5 text-[#8fa7a2]">{description}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded-full p-2 text-[#8fa7a2] transition hover:bg-white/[0.06] hover:text-white"
        aria-label={title}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function PanelStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-[12px] border border-white/[0.055] bg-white/[0.02] px-3 py-3">
      <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-[#6f8984]">
        {label}
      </span>
      <span className="mt-1 block text-[22px] font-semibold leading-none text-[#20D9A3]">
        {value}
      </span>
    </span>
  );
}

function NotificationListItem({
  notification,
  locale,
  onOpen,
}: {
  notification: DashboardGroupNotification;
  locale: string;
  onOpen: () => void;
}) {
  const isUnread = !notification.readAt;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-start gap-3 rounded-[12px] border px-3 py-3 text-left transition hover:bg-white/[0.04] ${
        isUnread
          ? 'border-[#20D9A3]/25 bg-[#20D9A3]/[0.06]'
          : 'border-white/[0.055] bg-white/[0.02]'
      }`}
    >
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border ${
          isUnread
            ? 'border-[#20D9A3]/25 bg-[#20D9A3]/10 text-[#9FF0CE]'
            : 'border-white/[0.055] bg-white/[0.025] text-[#8fa7a2]'
        }`}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-start justify-between gap-3">
          <span className="min-w-0 text-sm font-semibold leading-5 text-[#e8f4f0]">
            {notification.title}
          </span>
          {isUnread ? (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#20D9A3]" />
          ) : null}
        </span>
        <span className="mt-1 block text-[13px] leading-5 text-[#8fa7a2]">
          {notification.body}
        </span>
        <span className="mt-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[#5f7b75]">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {formatNotificationDate(notification.createdAt, locale)}
        </span>
      </span>
    </button>
  );
}

async function openGroupNotification({
  groupId,
  notification,
  setNotifications,
  setUnreadNotificationCount,
  router,
}: {
  groupId: string;
  notification: DashboardGroupNotification;
  setNotifications: Dispatch<SetStateAction<DashboardGroupNotification[]>>;
  setUnreadNotificationCount: Dispatch<SetStateAction<number>>;
  router: ReturnType<typeof useRouter>;
}) {
  if (!notification.readAt) {
    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, readAt } : item,
      ),
    );
    setUnreadNotificationCount((current) => Math.max(0, current - 1));

    void fetch(`/api/groups/${groupId}/notifications`, {
      method: 'PATCH',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: notification.id }),
    });
  }

  router.push(notification.href as never);
}

function formatNotificationDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
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
