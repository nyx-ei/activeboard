'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Plus, UsersRound } from 'lucide-react';

export type DashboardGroupZoneGroup = {
  id: string;
  name: string;
  memberCount: number;
  hasLiveSession?: boolean;
};

export type DashboardGroupZoneProps = {
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
  };
};

export const DashboardGroupZone = memo(function DashboardGroupZone({
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
  const visibleAvatars = groups.slice(0, 5);

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
                            {group.memberCount} {labels.members}
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
            {visibleAvatars.map((group, index) => (
              <span
                key={group.id}
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0e2c28] bg-[#22504a] text-[11px] font-medium text-[#9FF0CE]"
                style={{ marginLeft: index === 0 ? 0 : -10 }}
                title={group.name}
              >
                {group.name.slice(0, 2).toUpperCase()}
              </span>
            ))}
            {groups.length > visibleAvatars.length ? (
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0e2c28] bg-white/[0.06] text-[11px] font-medium text-[#8fa7a2]"
                style={{ marginLeft: -10 }}
              >
                +{groups.length - visibleAvatars.length}
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
                  {selectedGroup.memberCount} {labels.members}
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
    </section>
  );
});
