'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  ChevronDown,
  Play,
  Plus,
  UsersRound,
} from 'lucide-react';

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
};

export type DashboardGroupZoneSession = {
  id: string;
  name: string | null;
  scheduled_at: string;
  share_code: string;
  timer_seconds: number;
  question_goal: number;
  answeredQuestionCount?: number;
  questionCount?: number;
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
  };
};

export const DashboardGroupZone = memo(function DashboardGroupZone({
  locale,
  groups,
  createGroupHref,
  labels,
}: DashboardGroupZoneProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? '');
  const selectedGroup = useMemo(
    () =>
      groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null,
    [groups, selectedGroupId],
  );
  const liveGroupCount = groups.filter((group) => group.hasLiveSession).length;
  const selectedMembers = selectedGroup?.membersPreview ?? [];
  const selectedMaxMembers = selectedGroup?.maxMembers ?? 5;
  const selectedSession = selectedGroup?.hasLiveSession
    ? selectedGroup.activeSession
    : selectedGroup?.nextSession;
  const sessionHref = selectedSession
    ? `/${locale}/sessions/${selectedSession.id}`
    : null;
  const activeProgress = selectedGroup?.activeSession
    ? getLiveSessionProgress(selectedGroup.activeSession)
    : null;

  useEffect(() => {
    if (groups.length === 0) {
      setSelectedGroupId('');
      return;
    }

    const firstGroup = groups[0];
    if (firstGroup && !groups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(firstGroup.id);
    }
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
                <a
                  href={createGroupHref}
                  className="mt-1 flex items-center gap-2 border-t border-white/[0.045] px-3 py-2.5 text-[13px] font-medium text-[#20D9A3] transition hover:bg-[#20D9A3]/[0.06]"
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
          <a
            href={createGroupHref}
            className="inline-flex items-center gap-2 rounded-[12px] bg-[#20D9A3] px-[18px] py-3 text-[14px] font-medium leading-none text-[#062b22] transition hover:bg-[#2fe9b1]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {labels.createAnother}
          </a>
        </div>
      </div>

      {selectedGroup ? (
        <div className="mt-[22px]">
          {selectedGroup.hasLiveSession && selectedGroup.activeSession ? (
            <a
              href={`/${locale}/sessions/${selectedGroup.activeSession.id}`}
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
                    {selectedGroup.activeSession.name ?? labels.nextSession}
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
          ) : selectedGroup.nextSession && sessionHref ? (
            <a
              href={sessionHref}
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
                  {selectedGroup.nextSession.name ?? labels.nextSession}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-[#8fa7a2]">
                  {labels.scheduledFor.replace(
                    '{date}',
                    formatSessionDate(
                      selectedGroup.nextSession.scheduled_at,
                      locale,
                    ),
                  )}
                  <span className="text-[#345049]">·</span>
                  {labels.timerLabel.replace(
                    '{seconds}',
                    String(selectedGroup.nextSession.timer_seconds),
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
