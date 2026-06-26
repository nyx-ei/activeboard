'use client';

import {
  useCallback,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ArrowRight,
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Info,
  Lock,
  LogOut,
  Mail,
  MoreHorizontal,
  Play,
  Plus,
  Radio,
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
  status?: 'scheduled' | 'active' | 'incomplete' | 'completed' | 'cancelled';
  share_code: string;
  timer_seconds: number;
  question_goal: number;
  answeredQuestionCount?: number;
  questionCount?: number;
  currentQuestionNumber?: number;
  leaderInitials?: string;
  completionPercent?: number;
  accuracyPercent?: number | null;
};

type DashboardGroupNotification = {
  readAt: string | null;
};

export type DashboardGroupZoneProps = {
  locale: string;
  groups: DashboardGroupZoneGroup[];
  initialGroupId?: string;
  createGroupHref: string;
  liveGroupsHref: string;
  canBrowseLookupLayer: boolean;
  calibrationStats: {
    trueMasteryPercent: number;
    falseConfidencePercent: number;
  };
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
    captain: string;
    questionsUnit: string;
    completion: string;
    accuracy: string;
    trueMastery: string;
    falseConfidence: string;
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
  calibrationStats,
  labels,
}: DashboardGroupZoneProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<
    'members' | 'leave' | null
  >(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
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
  const mobileGroupSwitcherRef = useRef<HTMLDivElement | null>(null);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileOverflowMenuRef = useRef<HTMLDivElement | null>(null);
  const liveSignatureRef = useRef('');
  const appliedInitialGroupIdRef = useRef<string | null>(null);
  const selectedGroup = useMemo(
    () =>
      groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null,
    [groups, selectedGroupId],
  );
  const selectedMembers = selectedGroup?.membersPreview ?? [];
  const selectedMaxMembers = selectedGroup?.maxMembers ?? 5;
  const selectedActiveSession = selectedGroup?.activeSession ?? null;
  const selectedNextSession = selectedGroup?.nextSession ?? null;
  const selectedSession = selectedActiveSession ?? selectedNextSession;
  const sessionHref = selectedSession
    ? `/${locale}/sessions/${selectedSession.id}`
    : null;
  const activeProgress = selectedActiveSession
    ? getLiveSessionProgress(selectedActiveSession)
    : null;
  const mobileJoinLabel = getCompactJoinLabel(labels.joinLiveSession);
  const mobileLiveGroupsLabel = getCompactLiveGroupsLabel(
    canBrowseLookupLayer
      ? labels.exploreLiveGroupsTitle
      : labels.exploreLiveGroupsLockedTitle,
    locale,
  );
  const selectedSeatsAvailable = selectedGroup
    ? Math.max(0, selectedMaxMembers - selectedGroup.memberCount)
    : 0;
  const hasUnfinishedSession = Boolean(
    selectedActiveSession &&
      (selectedActiveSession.status === 'active' ||
        selectedActiveSession.status === 'incomplete'),
  );
  const canInviteSelectedGroup = Boolean(
    selectedGroup && selectedSeatsAvailable > 0,
  );
  const shouldShowMemberPrompt = Boolean(
    selectedGroup &&
    selectedGroup.memberCount < 2 &&
    selectedSeatsAvailable > 0 &&
    !hasUnfinishedSession,
  );
  const canStartSelectedGroup = Boolean(
    selectedGroup &&
    selectedGroup.memberCount >= 2 &&
    !hasUnfinishedSession &&
    !shouldShowMemberPrompt,
  );
  const canOpenSessionPlanner = Boolean(selectedGroup);
  const normalizedInviteEmail = inviteEmail.trim().toLowerCase();

  function prefetchSession(href: string | null) {
    if (href) {
      router.prefetch(href as never);
    }
  }

  const loadNotifications = useCallback(
    async (groupId: string) => {
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

        setUnreadNotificationCount(payload.unreadCount ?? 0);
      } catch {
        // Notification badge refresh must never block the dashboard.
      }
    },
    [locale],
  );

  useEffect(() => {
    if (groups.length === 0) {
      setSelectedGroupId('');
      liveSignatureRef.current = '';
      appliedInitialGroupIdRef.current = null;
      return;
    }

    const requestedGroup = initialGroupId
      ? groups.find((group) => group.id === initialGroupId)
      : null;
    if (
      requestedGroup &&
      appliedInitialGroupIdRef.current !== requestedGroup.id
    ) {
      appliedInitialGroupIdRef.current = requestedGroup.id;
      setSelectedGroupId(requestedGroup.id);
      return;
    }

    if (!initialGroupId) {
      appliedInitialGroupIdRef.current = null;
    }

    const firstGroup = groups[0];
    if (firstGroup && !groups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(firstGroup.id);
    }
  }, [groups, initialGroupId, selectedGroupId]);

  useEffect(() => {
    const liveSignature = getLiveGroupsSignature(groups);
    const requestedGroupExists = Boolean(
      initialGroupId && groups.some((group) => group.id === initialGroupId),
    );

    if (requestedGroupExists) {
      liveSignatureRef.current = liveSignature;
      return;
    }

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
  }, [groups, initialGroupId, selectedGroupId]);

  useEffect(() => {
    if (sessionHref) {
      router.prefetch(sessionHref as never);
    }
  }, [router, sessionHref]);

  useEffect(() => {
    if (!selectedGroup?.id) {
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
        mobileGroupSwitcherRef.current?.contains(target) ||
        overflowMenuRef.current?.contains(target) ||
        mobileOverflowMenuRef.current?.contains(target)
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
      <div>
        <MobileSessionFirstDashboardZone
          locale={locale}
          selectedGroup={selectedGroup}
          selectedMembers={selectedMembers}
          selectedActiveSession={selectedActiveSession}
          selectedNextSession={selectedNextSession}
          sessionHref={sessionHref}
          canOpenSessionPlanner={canOpenSessionPlanner}
          calibrationStats={calibrationStats}
          labels={labels}
        />
      </div>

      <div className="hidden">
        <div className="flex items-center justify-between gap-3">
          <div ref={groupMenuRef} className="relative min-w-0 flex-1">
            <button
              type="button"
              className="pointer-events-none flex max-w-full items-center gap-2 rounded-[10px] pr-2 text-left text-[31px] font-medium leading-none tracking-[-0.04em] text-[#e8f4f0]"
              tabIndex={-1}
            >
              <span className="truncate">
                {selectedGroup?.name ?? labels.noGroups}
              </span>
            </button>

            {false ? (
              <div className="absolute left-0 z-30 mt-2 w-[min(330px,calc(100vw-40px))] overflow-hidden rounded-[14px] border border-white/[0.09] bg-[#0d332d] p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
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

          <div className="hidden shrink-0 items-center">
            <MemberAvatarStack members={selectedMembers.slice(0, 3)} />
            {selectedGroup &&
            selectedGroup.memberCount > selectedMembers.slice(0, 3).length ? (
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0e2c28] bg-white/[0.06] text-[11px] font-medium text-[#8fa7a2]"
                style={{ marginLeft: -10 }}
              >
                +{selectedGroup.memberCount - selectedMembers.slice(0, 3).length}
              </span>
            ) : null}
          </div>
        </div>

        {selectedGroup ? (
          <div className="relative mt-5 space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr)_58px] gap-2.5">
              <div
                ref={mobileGroupSwitcherRef}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setIsOpen((current) => !current);
                  setIsOverflowOpen(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setIsOpen((current) => !current);
                    setIsOverflowOpen(false);
                  }
                }}
                className={`relative grid min-h-[72px] grid-cols-[86px_minmax(0,1fr)_auto] items-center gap-2 rounded-[13px] border border-white/[0.06] bg-white/[0.018] px-2.5 py-2 transition hover:bg-white/[0.03] ${
                  isOpen ? 'border-[#20D9A3]/25 bg-[#20D9A3]/[0.04]' : ''
                }`}
                aria-expanded={isOpen}
              >
                <div className="flex min-w-0 items-center">
                  <CompactAvatarStack members={selectedMembers.slice(0, 3)} />
                </div>

                <a
                  href={
                    selectedActiveSession
                      ? `/${locale}/sessions/${selectedActiveSession.id}`
                      : (sessionHref ?? `/${locale}/dashboard`)
                  }
                  onFocus={() =>
                    prefetchSession(
                      selectedActiveSession
                        ? `/${locale}/sessions/${selectedActiveSession.id}`
                        : sessionHref,
                    )
                  }
                  onPointerEnter={() =>
                    prefetchSession(
                      selectedActiveSession
                        ? `/${locale}/sessions/${selectedActiveSession.id}`
                        : sessionHref,
                    )
                  }
                  className="min-w-0"
                >
                  <span
                    className={`block truncate text-[12px] font-medium ${
                      selectedActiveSession ? 'text-[#20D9A3]' : 'text-[#8fa7a2]'
                    }`}
                  >
                    {selectedActiveSession
                      ? labels.live
                      : selectedNextSession
                        ? labels.nextSession
                        : labels.noUpcomingSession}
                  </span>
                  <span className="mt-0.5 block truncate text-[15px] font-semibold text-[#e8f4f0]">
                    {selectedActiveSession?.name ??
                      selectedNextSession?.name ??
                      labels.noUpcomingSession}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-[#8fa7a2]">
                    {selectedActiveSession
                      ? getCompactSessionMeta(selectedActiveSession)
                      : selectedNextSession
                        ? getCompactSessionMeta(selectedNextSession)
                        : `${selectedGroup.memberCount} ${labels.members}`}
                  </span>
                </a>

                {selectedActiveSession ? (
                  <a
                    href={`/${locale}/sessions/${selectedActiveSession.id}`}
                    onClick={(event) => event.stopPropagation()}
                    className="relative inline-flex h-8 max-w-[64px] shrink-0 items-center justify-center rounded-[9px] border border-white/[0.08] px-2 text-[11px] font-semibold text-[#e8f4f0]"
                  >
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-400" />
                    {mobileJoinLabel}
                  </a>
                ) : selectedNextSession && sessionHref ? (
                  <a
                    href={sessionHref}
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#20D9A3] text-[#062b22] shadow-[0_0_22px_rgba(32,217,163,0.22)]"
                    aria-label={labels.openSession}
                  >
                    <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  </a>
                ) : null}
                {isOpen ? (
                  <div className="absolute left-0 top-full z-30 mt-2 w-[min(330px,calc(100vw-96px))] overflow-hidden rounded-[14px] border border-white/[0.09] bg-[#0d332d] p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
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
                            onClick={(event) => {
                              event.stopPropagation();
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
                      onClick={(event) => event.stopPropagation()}
                      className="mt-1 flex items-center gap-2 border-t border-white/[0.045] px-3 py-3 text-[14px] font-medium text-[#20D9A3] transition hover:bg-[#20D9A3]/[0.06]"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      {labels.createAnother}
                    </a>
                  </div>
                ) : null}
              </div>

              <div ref={mobileOverflowMenuRef} className="relative">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsOverflowOpen((current) => !current);
                    setIsOpen(false);
                  }}
                  className="flex h-full min-h-[72px] w-full items-center justify-center rounded-[13px] border border-white/[0.06] bg-white/[0.018] text-[#d7e3df] transition hover:border-white/[0.1] hover:bg-white/[0.04]"
                  aria-expanded={isOverflowOpen}
                  aria-label={labels.dropdownLabel}
                >
                  <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                </button>
                {isOverflowOpen ? (
                  <div
                    className="absolute right-0 z-30 mt-2 w-[min(270px,calc(100vw-32px))] rounded-[14px] border border-white/[0.09] bg-[#0d332d] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <GroupOverflowItem
                      icon={<UsersRound className="h-5 w-5" aria-hidden="true" />}
                      label={labels.manageMembers}
                      onClick={() => {
                        setIsOverflowOpen(false);
                        setActivePanel('members');
                      }}
                    />
                    <GroupOverflowItem
                      icon={<UserPlus className="h-5 w-5" aria-hidden="true" />}
                      label={labels.invite}
                      onClick={() => {
                        setIsOverflowOpen(false);
                        if (!canInviteSelectedGroup) {
                          return;
                        }
                        setInviteError(null);
                        setIsInviteOpen(true);
                      }}
                    />
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsOverflowOpen(false);
                        window.dispatchEvent(
                          new CustomEvent('activeboard:open-create-session', {
                            detail: { groupId: selectedGroup.id },
                          }),
                        );
                      }}
                      className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[14px] font-medium text-[#e8f4f0] transition hover:bg-white/[0.04]"
                    >
                      <CalendarClock className="h-4 w-4 text-[#8fa7a2]" aria-hidden="true" />
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
                        router.push(
                          `/dashboard/groups/${selectedGroup.id}/notifications` as never,
                        );
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
            </div>

            <button
              type="button"
              disabled={!canStartSelectedGroup}
              onClick={() => {
                if (!canStartSelectedGroup) {
                  return;
                }
                window.dispatchEvent(
                  new CustomEvent('activeboard:open-create-session', {
                    detail: { groupId: selectedGroup.id },
                  }),
                );
              }}
              className={`inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-[12px] px-4 text-[15px] font-semibold transition ${
                canStartSelectedGroup
                  ? 'bg-[#20D9A3] text-[#062b22] hover:bg-[#2fe9b1]'
                  : 'cursor-not-allowed bg-white/[0.16] text-[#8fa7a2]'
              }`}
            >
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              {labels.startSession}
            </button>

            <a
              href={liveGroupsHref}
              className={`flex min-h-[48px] items-center gap-3 rounded-[13px] border px-3 py-2 transition ${
                canBrowseLookupLayer
                  ? 'border-[#20D9A3]/25 bg-[#20D9A3]/[0.07]'
                  : 'border-amber-300/20 bg-amber-300/[0.055]'
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border ${
                  canBrowseLookupLayer
                    ? 'border-[#20D9A3]/25 bg-[#20D9A3]/[0.12] text-[#9FF0CE]'
                    : 'border-amber-300/20 bg-amber-300/10 text-amber-100'
                }`}
              >
                {canBrowseLookupLayer ? (
                  <Search className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Lock className="h-4 w-4" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[#e8f4f0]">
                {mobileLiveGroupsLabel}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-[#9FF0CE]" aria-hidden="true" />
            </a>

            <MobileSessionList
              locale={locale}
              labels={labels}
              selectedGroup={selectedGroup}
              selectedActiveSession={selectedActiveSession}
              selectedNextSession={selectedNextSession}
              sessionHref={sessionHref}
            />

            <button
              type="button"
              disabled={!canStartSelectedGroup}
              onClick={() => {
                if (!canStartSelectedGroup) {
                  return;
                }
                window.dispatchEvent(
                  new CustomEvent('activeboard:open-create-session', {
                    detail: { groupId: selectedGroup.id },
                  }),
                );
              }}
              className={`absolute bottom-3 right-3 flex h-14 w-14 items-center justify-center rounded-full border text-[#9FF0CE] shadow-[0_18px_44px_rgba(0,0,0,0.35)] transition ${
                canStartSelectedGroup
                  ? 'border-[#20D9A3]/30 bg-[#0d3a34] hover:bg-[#114940]'
                  : 'cursor-not-allowed border-white/[0.06] bg-white/[0.04] text-[#5f7b75]'
              }`}
              aria-label={labels.startSession}
            >
              <Plus className="h-7 w-7" aria-hidden="true" />
            </button>

          </div>
        ) : null}
      </div>

      <div className="hidden">
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
                      router.push(
                        `/dashboard/groups/${selectedGroup.id}/notifications` as never,
                      );
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

          {canOpenSessionPlanner && selectedGroup ? (
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

      </div>

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

function MobileSessionFirstDashboardZone({
  locale,
  selectedGroup,
  selectedMembers,
  selectedActiveSession,
  selectedNextSession,
  sessionHref,
  canOpenSessionPlanner,
  calibrationStats,
  labels,
}: {
  locale: string;
  selectedGroup: DashboardGroupZoneGroup | null;
  selectedMembers: DashboardGroupZoneGroup['membersPreview'];
  selectedActiveSession: DashboardGroupZoneSession | null;
  selectedNextSession: DashboardGroupZoneSession | null;
  sessionHref: string | null;
  canOpenSessionPlanner: boolean;
  calibrationStats: DashboardGroupZoneProps['calibrationStats'];
  labels: DashboardGroupZoneProps['labels'];
}) {
  const latestCompletedSession =
    selectedGroup?.recentSessions?.find(
      (session) => session.status === 'completed',
    ) ?? null;
  const primarySession =
    selectedActiveSession ?? selectedNextSession ?? latestCompletedSession;
  const secondarySession =
    selectedActiveSession && selectedNextSession ? selectedNextSession : null;
  const primaryHref = primarySession
    ? `/${locale}/sessions/${primarySession.id}`
    : (sessionHref ?? `/${locale}/dashboard`);
  const primaryAction = primarySession
    ? getSessionDashboardAction(primarySession, Boolean(selectedNextSession))
    : null;
  const [calibrationHelpMetric, setCalibrationHelpMetric] = useState<
    'trueMastery' | 'falseConfidence' | null
  >(null);
  const [isCalibrationHelpOpen, setIsCalibrationHelpOpen] = useState(false);
  const calibrationHelpRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!calibrationHelpMetric) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target || calibrationHelpRef.current?.contains(target)) {
        return;
      }

      setCalibrationHelpMetric(null);
    }

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [calibrationHelpMetric]);

  if (!selectedGroup) {
    return (
      <div className="rounded-[16px] border border-dashed border-white/[0.08] px-4 py-5 text-sm font-semibold text-[#8fa7a2]">
        {labels.noGroups}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-3 sm:space-y-4 lg:mx-0 lg:max-w-none">
      <section className="rounded-[15px] border border-white/[0.045] bg-[#071a18]/75 px-4 py-3 sm:px-6 sm:py-5">
        <div className="flex items-center justify-between">
          <div className="hidden">
            <button
              type="button"
              onClick={() => setIsCalibrationHelpOpen((isOpen) => !isOpen)}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.025] text-[#9FF0CE] transition hover:border-[#20D9A3]/30 hover:bg-[#20D9A3]/10"
              aria-label={
                locale === 'fr'
                  ? 'Comprendre la mesure'
                  : 'Understand this measure'
              }
              aria-expanded={isCalibrationHelpOpen}
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            {isCalibrationHelpOpen ? (
              <div className="absolute left-0 top-full z-20 mt-2 w-[min(260px,calc(100vw-64px))] rounded-[10px] border border-white/[0.08] bg-[#071a18] p-3 text-[11px] font-medium leading-relaxed text-[#b4c8c3] shadow-[0_18px_50px_rgba(0,0,0,0.45)] sm:text-xs">
                {locale === 'fr'
                  ? 'Mesure issue des réponses révisées et du niveau de certitude.'
                  : 'Measured from reviewed answers and confidence level.'}
              </div>
            ) : null}
          </div>
          <a
            href={`/${locale}/dashboard/progression`}
            className="text-[11px] font-semibold text-[#20D9A3] sm:text-[13px]"
          >
            {locale === 'fr' ? 'Voir plus' : 'View more'}
          </a>
        </div>
        <div
          ref={calibrationHelpRef}
          className="mt-3 grid grid-cols-2 divide-x divide-white/[0.06] sm:mt-4"
        >
          <div className="relative pr-3 text-center">
            <p className="text-[25px] font-semibold leading-none text-[#20D9A3] sm:text-[34px]">
              {calibrationStats.trueMasteryPercent}%
            </p>
            <p className="mt-1 inline-flex items-center justify-center gap-1 text-[11px] text-[#8fa7a2] sm:text-[13px]">
              <span>{labels.trueMastery}</span>
              <button
                type="button"
                onClick={() =>
                  setCalibrationHelpMetric((metric) =>
                    metric === 'trueMastery' ? null : 'trueMastery',
                  )
                }
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/[0.08] text-[#9FF0CE] transition hover:border-[#20D9A3]/30 hover:bg-[#20D9A3]/10"
                aria-label={
                  locale === 'fr'
                    ? 'Comprendre la maîtrise réelle'
                    : 'Understand true mastery'
                }
                aria-expanded={calibrationHelpMetric === 'trueMastery'}
              >
                <Info className="h-2.5 w-2.5" aria-hidden="true" />
              </button>
            </p>
            {calibrationHelpMetric === 'trueMastery' ? (
              <div className="absolute left-0 top-full z-20 mt-2 w-[min(230px,calc(100vw-64px))] rounded-[10px] border border-white/[0.08] bg-[#071a18] p-3 text-left text-[11px] font-medium leading-relaxed text-[#b4c8c3] shadow-[0_18px_50px_rgba(0,0,0,0.45)] sm:text-xs">
                {locale === 'fr'
                  ? 'Réponses justes avec une certitude élevée.'
                  : 'Correct answers submitted with high confidence.'}
              </div>
            ) : null}
          </div>
          <div className="relative pl-3 text-center">
            <p className="text-[25px] font-semibold leading-none text-[#9FF0CE] sm:text-[34px]">
              {calibrationStats.falseConfidencePercent}%
            </p>
            <p className="mt-1 inline-flex items-center justify-center gap-1 text-[11px] text-[#8fa7a2] sm:text-[13px]">
              <span>{labels.falseConfidence}</span>
              <button
                type="button"
                onClick={() =>
                  setCalibrationHelpMetric((metric) =>
                    metric === 'falseConfidence' ? null : 'falseConfidence',
                  )
                }
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/[0.08] text-[#9FF0CE] transition hover:border-[#20D9A3]/30 hover:bg-[#20D9A3]/10"
                aria-label={
                  locale === 'fr'
                    ? 'Comprendre la fausse confiance'
                    : 'Understand false confidence'
                }
                aria-expanded={calibrationHelpMetric === 'falseConfidence'}
              >
                <Info className="h-2.5 w-2.5" aria-hidden="true" />
              </button>
            </p>
            {calibrationHelpMetric === 'falseConfidence' ? (
              <div className="absolute right-0 top-full z-20 mt-2 w-[min(230px,calc(100vw-64px))] rounded-[10px] border border-white/[0.08] bg-[#071a18] p-3 text-left text-[11px] font-medium leading-relaxed text-[#b4c8c3] shadow-[0_18px_50px_rgba(0,0,0,0.45)] sm:text-xs">
                {locale === 'fr'
                  ? 'Réponses fausses soumises avec une certitude élevée.'
                  : 'Incorrect answers submitted with high confidence.'}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="relative rounded-[18px] border border-white/[0.045] bg-[#0b2a25] px-4 pb-5 pt-4 shadow-[0_18px_60px_rgba(0,0,0,0.2)] sm:px-6 sm:pb-7 sm:pt-6">
        <h2 className="truncate text-[15px] font-semibold leading-none text-[#d7e3df] sm:text-[20px]">
          {selectedGroup.name}
        </h2>

        <div
          className={`mt-3 space-y-2.5 sm:mt-4 sm:pr-[72px] ${
            secondarySession ? '' : 'pb-[66px] sm:pb-0'
          }`}
        >
          <a
            href={primaryHref}
            className="grid min-h-[66px] grid-cols-[96px_minmax(0,1fr)_64px] items-center gap-2 rounded-[13px] border border-white/[0.055] bg-white/[0.018] px-2.5 py-2 transition hover:border-[#20D9A3]/25 hover:bg-white/[0.028] sm:min-h-[76px] sm:grid-cols-[132px_minmax(0,1fr)_72px] sm:px-4 sm:py-3"
          >
            <span className="flex min-w-0 items-center">
              <CompactAvatarStack members={selectedMembers?.slice(0, 3)} />
            </span>
            <span className="min-w-0">
              {primarySession ? (
                <span
                  className={`mb-0.5 block truncate text-[10px] font-semibold sm:text-[12px] ${
                    primarySession.status === 'active'
                      ? 'text-[#20D9A3]'
                      : 'text-[#8fa7a2]'
                  }`}
                >
                  {getSessionStatusLabel(primarySession, locale, labels)}
                </span>
              ) : null}
              <span className="block truncate text-[13px] font-semibold text-[#e8f4f0] sm:text-[17px]">
                {primarySession?.name ?? labels.noUpcomingSession}
              </span>
              <span className="mt-0.5 block truncate text-[10px] text-[#8fa7a2] sm:text-[13px]">
                {primarySession
                  ? getDashboardSessionMeta(primarySession)
                  : `${selectedGroup.memberCount} ${labels.members}`}
              </span>
            </span>
            <span className="flex flex-col items-center justify-center">
              {primaryAction ? (
                <>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#20D9A3] text-[#062b22] shadow-[0_0_18px_rgba(32,217,163,0.25)] sm:h-11 sm:w-11">
                    <primaryAction.Icon
                      className={`h-4 w-4 sm:h-5 sm:w-5 ${
                        primaryAction.fill ? 'fill-current' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="mt-1 max-w-[64px] break-words text-center text-[9px] font-semibold leading-[1.05] text-[#9FF0CE] sm:max-w-[72px] sm:text-[11px]">
                    {primaryAction.label}
                  </span>
                </>
              ) : null}
            </span>
          </a>

          {secondarySession ? (
          <a
            href={`/${locale}/sessions/${secondarySession.id}`}
            className="grid min-h-[58px] w-full grid-cols-[104px_minmax(0,1fr)_72px] items-center gap-2 rounded-[13px] border border-white/[0.035] bg-white/[0.012] px-2.5 py-2 pr-12 text-left transition hover:border-white/[0.08] hover:bg-white/[0.025] sm:min-h-[76px] sm:grid-cols-[132px_minmax(0,1fr)_150px] sm:px-4 sm:py-3 sm:pr-4"
          >
            <span className="flex items-center gap-1">
              <PlaceholderAvatar />
              <PlaceholderAvatar />
              <PlaceholderAvatar />
            </span>
            <span className="min-w-0">
              <span className="mb-0.5 block truncate text-[10px] font-semibold text-[#8fa7a2] sm:text-[12px]">
                {getSessionStatusLabel(secondarySession, locale, labels)}
              </span>
              <span className="block truncate text-[13px] font-semibold text-[#e8f4f0] sm:text-[17px]">
                {secondarySession.name ?? labels.nextSession}
              </span>
              <span className="hidden">
                {secondarySession
                  ? `${secondarySession.question_goal}Q · ${secondarySession.timer_seconds}sec`
                  : `20Q · ${labels.timerLabel.replace('{seconds}', '90')}`}
              </span>
            </span>
            <span className="min-w-0 text-right text-[10px] font-semibold text-[#8fa7a2] sm:text-[13px]">
              <span className="block truncate text-[#9fb5b0]">
                {secondarySession
                  ? formatSessionDate(secondarySession.scheduled_at, locale)
                  : labels.scheduledFor.replace('{date}', '')}
              </span>
              <span className="mt-0.5 block truncate text-[10px] font-medium text-[#6f8984] sm:text-[12px]">
                {getPlannedDashboardSessionMeta(secondarySession, labels)}
              </span>
            </span>
          </a>
          ) : null}
        </div>

        <button
          type="button"
          disabled={!canOpenSessionPlanner}
          onClick={() => {
            if (!canOpenSessionPlanner) return;
            window.dispatchEvent(
              new CustomEvent('activeboard:open-create-session', {
                detail: { groupId: selectedGroup.id },
              }),
            );
          }}
          className={`absolute bottom-4 right-4 flex h-[52px] w-[52px] items-center justify-center rounded-full border text-[#9FF0CE] shadow-[0_18px_44px_rgba(0,0,0,0.35)] transition sm:bottom-7 sm:right-6 sm:h-14 sm:w-14 ${
            canOpenSessionPlanner
              ? 'border-[#20D9A3]/30 bg-[#0d3a34] hover:bg-[#114940]'
              : 'cursor-not-allowed border-white/[0.06] bg-white/[0.04] text-[#5f7b75]'
          }`}
          aria-label={labels.startSession}
        >
          <Plus className="h-7 w-7" aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}

function PlaceholderAvatar() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#0e2c28] bg-white/[0.045] text-[#8fa7a2]">
      <UsersRound className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}

function MobileSessionList({
  locale,
  labels,
  selectedGroup,
  selectedActiveSession,
  selectedNextSession,
  sessionHref,
}: {
  locale: string;
  labels: DashboardGroupZoneProps['labels'];
  selectedGroup: DashboardGroupZoneGroup;
  selectedActiveSession: DashboardGroupZoneSession | null;
  selectedNextSession: DashboardGroupZoneSession | null;
  sessionHref: string | null;
}) {
  const secondarySessions = selectedGroup.recentSessions?.filter(
    (session) =>
      session.id !== selectedActiveSession?.id &&
      session.id !== selectedNextSession?.id,
  );
  const secondarySession =
    selectedNextSession ?? secondarySessions?.[0] ?? selectedActiveSession;
  const primarySession = selectedActiveSession ?? selectedNextSession;

  return (
    <div className="space-y-2 pb-10">
      {secondarySession ? (
        <a
          href={`/${locale}/sessions/${secondarySession.id}`}
          className="grid min-h-[64px] grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded-[13px] border border-white/[0.055] bg-white/[0.014] px-3 py-2.5"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full text-[#9FF0CE]">
            <ArrowRight className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[16px] font-semibold tracking-[-0.02em] text-[#e8f4f0]">
              {secondarySession.name ?? labels.nextSession}
            </span>
            <span className="mt-1 block truncate text-[13px] text-[#8fa7a2]">
              {getMobileSessionSummary(secondarySession, locale)}
            </span>
          </span>
          <span
            className={`shrink-0 text-[13px] font-semibold ${
              secondarySession.status === 'active'
                ? 'text-[#9FF0CE]'
                : 'text-[#8fa7a2]'
            }`}
          >
            {secondarySession.status === 'active' ? labels.live : formatShortDate(secondarySession.scheduled_at, locale)}
          </span>
        </a>
      ) : (
        <div className="grid min-h-[64px] grid-cols-[42px_minmax(0,1fr)] items-center gap-3 rounded-[13px] border border-dashed border-white/[0.055] bg-white/[0.01] px-3 py-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full text-[#5f7b75]">
            <ArrowRight className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[16px] font-semibold tracking-[-0.02em] text-[#e8f4f0]">
              {labels.noUpcomingSession}
            </span>
            <span className="mt-1 block truncate text-[13px] text-[#8fa7a2]">
              {selectedGroup.memberCount} {labels.members}
            </span>
          </span>
        </div>
      )}

      {primarySession && sessionHref ? (
        <a
          href={sessionHref}
          className="sr-only"
        >
          {labels.openSession}
        </a>
      ) : null}
    </div>
  );
}

function formatSessionDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatShortDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function getDashboardSessionMeta(session: DashboardGroupZoneSession) {
  return [
    `${session.answeredQuestionCount ?? 0}/${session.question_goal} Q`,
    `${session.timer_seconds} sec`,
  ].join(' · ');
}

function getPlannedDashboardSessionMeta(
  session: DashboardGroupZoneSession | null,
  labels: DashboardGroupZoneProps['labels'],
) {
  if (!session) {
    return `20Q · ${labels.timerLabel.replace('{seconds}', '90')}`;
  }

  return [`${session.question_goal}Q`, `${session.timer_seconds}sec`].join(
    ' · ',
  );
}

function getSessionStatusLabel(
  session: DashboardGroupZoneSession,
  locale: string,
  labels: DashboardGroupZoneProps['labels'],
) {
  if (session.status === 'active') {
    return labels.live;
  }

  if (session.status === 'completed') {
    return locale === 'fr' ? 'Terminée' : 'Completed';
  }

  if (session.status === 'incomplete') {
    return locale === 'fr' ? 'À reprendre' : 'Resume';
  }

  return locale === 'fr' ? 'Programmée' : 'Scheduled';
}

function getSessionDashboardAction(
  session: DashboardGroupZoneSession,
  hasNextSession: boolean,
) {
  if (session.status === 'active') {
    return {
      label: 'Live',
      Icon: Radio,
      fill: false,
    };
  }

  if (session.status === 'incomplete') {
    return {
      label: 'Revision',
      Icon: ClipboardCheck,
      fill: false,
    };
  }

  if (session.status === 'completed') {
    return hasNextSession
      ? {
          label: 'Ended',
          Icon: CheckCircle2,
          fill: false,
        }
      : {
          label: 'Plan next session',
          Icon: CalendarClock,
          fill: false,
        };
  }

  if (session.status === 'cancelled') {
    return {
      label: 'Ended',
      Icon: CheckCircle2,
      fill: false,
    };
  }

  return {
    label: 'Start',
    Icon: Play,
    fill: true,
  };
}

function getCompactSessionMeta(session: DashboardGroupZoneSession) {
  return `${session.answeredQuestionCount ?? 0}/${session.question_goal} Q · ${session.timer_seconds} sec`;
}

function getMobileSessionSummary(
  session: DashboardGroupZoneSession,
  locale: string,
) {
  const scheduledAt = formatShortDate(session.scheduled_at, locale);
  return `${session.answeredQuestionCount ?? 0} Q · ${scheduledAt} · ${session.timer_seconds} sec`;
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
    Math.max(
      1,
      session.currentQuestionNumber ??
        session.questionCount ??
        session.answeredQuestionCount ??
        1,
    ),
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
      return `${group.id}:${session?.id ?? ''}:${session?.started_at ?? session?.scheduled_at ?? ''}:${session?.currentQuestionNumber ?? ''}`;
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

function getCompactJoinLabel(label: string) {
  const firstWord = label.trim().split(/\s+/)[0];
  return firstWord || label;
}

function getCompactLiveGroupsLabel(_label: string, locale: string) {
  return locale === 'fr' ? 'Groupes en direct' : 'Live groups';
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

function CompactAvatarStack({
  members,
}: {
  members: DashboardGroupZoneGroup['membersPreview'];
}) {
  const safeMembers = members ?? [];

  if (safeMembers.length === 0) {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#0e2c28] bg-white/[0.05] text-[#8fa7a2]">
        <UsersRound className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="flex items-center">
      {safeMembers.map((member, index) => (
        <span
          key={member.id}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#0e2c28] bg-[#22504a] bg-cover bg-center text-[11px] font-medium text-[#9FF0CE]"
          style={{
            marginLeft: index === 0 ? 0 : -11,
            backgroundImage: member.avatarUrl
              ? `url("${member.avatarUrl}")`
              : undefined,
          }}
          title={member.initials}
        >
          {member.avatarUrl ? null : member.initials}
        </span>
      ))}
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
