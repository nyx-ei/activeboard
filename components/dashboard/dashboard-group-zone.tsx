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
    <section className="surface-mockup p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">
            {labels.title}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {labels.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
          {liveGroupCount > 0 ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-400/[0.08] px-3 py-2 text-red-200">
              <span className="live-dot" aria-hidden="true" />
              {liveGroupCount} {labels.live}
            </span>
          ) : null}
          <a
            href={createGroupHref}
            className="hover:border-brand/50 hover:bg-brand/10 inline-flex h-9 items-center gap-2 rounded-full border border-border bg-white/[0.04] px-3 text-xs font-extrabold text-slate-200 transition hover:text-white"
          >
            <Plus className="h-4 w-4 text-brand" aria-hidden="true" />
            {labels.createAnother}
          </a>
        </div>
      </div>

      <div className="relative mt-5">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          {labels.dropdownLabel}
        </p>
        <button
          type="button"
          className="hover:border-brand/40 flex min-h-16 w-full items-center justify-between gap-3 rounded-[14px] border border-border bg-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.06]"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="bg-brand/10 grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-brand">
              <UsersRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="flex min-w-0 items-center gap-2">
                {selectedGroup?.hasLiveSession ? (
                  <span className="live-dot" aria-hidden="true" />
                ) : null}
                <span className="truncate text-base font-extrabold text-white">
                  {selectedGroup?.name ?? labels.noGroups}
                </span>
              </span>
              {selectedGroup ? (
                <span className="mt-1 block text-xs font-semibold text-slate-500">
                  {selectedGroup.memberCount} {labels.members}
                </span>
              ) : null}
            </span>
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-slate-500 transition ${
              isOpen ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        {isOpen ? (
          <div className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-[14px] border border-border bg-[#090f1d] p-2 shadow-panel">
            {groups.length > 0 ? (
              groups.map((group) => {
                const isSelected = selectedGroup?.id === group.id;

                return (
                  <button
                    key={group.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-3 text-left transition hover:bg-white/[0.05]"
                    onClick={() => {
                      setSelectedGroupId(group.id);
                      setIsOpen(false);
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-white/[0.05] text-slate-300">
                        <UsersRound className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex min-w-0 items-center gap-2">
                          {group.hasLiveSession ? (
                            <span className="live-dot" aria-hidden="true" />
                          ) : null}
                          <span className="truncate text-sm font-extrabold text-white">
                            {group.name}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs font-semibold text-slate-500">
                          {group.memberCount} {labels.members}
                          {group.hasLiveSession ? ` · ${labels.live}` : ''}
                        </span>
                      </span>
                    </span>
                    {isSelected ? (
                      <Check
                        className="h-4 w-4 shrink-0 text-brand"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-4 text-sm font-semibold text-slate-500">
                {labels.noGroups}
              </p>
            )}
            <a
              href={createGroupHref}
              className="border-brand/30 hover:border-brand/60 hover:bg-brand/10 mt-2 flex items-center gap-2 rounded-[10px] border border-dashed px-3 py-3 text-sm font-extrabold text-brand transition"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {labels.createAnother}
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
});
