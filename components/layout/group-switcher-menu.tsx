'use client';

import { ChevronDown, Lock, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

import { ModalPortal } from '@/components/ui/modal-portal';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type ShellGroup = {
  id: string;
  name: string;
  language: string;
  scheduleLabel: string;
  weeklyQuestions: number;
  membersPreview: Array<{
    id: string;
    initials: string;
    avatarUrl: string | null;
  }>;
};

type GroupSwitcherMenuProps = {
  groups: ShellGroup[];
  liveGroupCount: number;
  liveHref: string;
  userInitials: string;
  labels: {
    myGroups: string;
    active: string;
    selectHint: string;
    noSchedule: string;
    averageWeekly: string;
  };
};

const MEMBER_AVATAR_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#f59e0b'];

export function GroupSwitcherMenu({ groups, liveGroupCount, liveHref, userInitials, labels }: GroupSwitcherMenuProps) {
  const [open, setOpen] = useState(false);
  const [failedAvatarIds, setFailedAvatarIds] = useState<string[]>([]);
  const pathname = usePathname();
  const pathGroupId = pathname.match(/\/groups\/([^/?#]+)/)?.[1] ?? null;
  const selectedGroup = useMemo(() => groups.find((group) => group.id === pathGroupId) ?? null, [groups, pathGroupId]);
  const resolvedLiveHref =
    liveHref === '/groups?live=1' && selectedGroup ? `/groups/${selectedGroup.id}?live=1` : liveHref;
  const failedAvatarSet = useMemo(() => new Set(failedAvatarIds), [failedAvatarIds]);

  useEffect(() => {
    if (!open) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open]);

  if (groups.length === 0) return null;

  return (
    <>
      <div className="hidden items-center gap-2 sm:flex">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-10 min-w-0 max-w-[290px] items-center gap-3 rounded-[10px] border border-white/[0.08] bg-[#11192c] px-3 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.015)] transition hover:border-white/15 hover:bg-[#131d32]"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#176b55] bg-[#053b32] text-[10px] font-extrabold text-[#22e39c]">
            {userInitials}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#11192c] bg-brand" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-white">
            {selectedGroup?.name ?? labels.myGroups}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" strokeWidth={1.8} />
        </button>
        <Link
          href={resolvedLiveHref}
          className="inline-flex h-10 items-center gap-1.5 rounded-[8px] bg-amber-500/10 px-3 text-xs font-extrabold text-amber-400 ring-1 ring-amber-500/10 transition hover:bg-amber-500/15"
          aria-label={`${liveGroupCount}`}
        >
          <Lock className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.8} />
          {liveGroupCount}
        </Link>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 sm:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-white/[0.08] bg-[#11192c] px-3 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.015)] transition hover:border-white/15 hover:bg-[#131d32]"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#176b55] bg-[#053b32] text-[10px] font-extrabold text-[#22e39c]">
            {userInitials}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#11192c] bg-brand" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-white">
            {selectedGroup?.name ?? labels.myGroups}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" strokeWidth={1.8} />
        </button>
        <Link
          href={resolvedLiveHref}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[8px] bg-amber-500/10 px-3 text-xs font-extrabold text-amber-400 ring-1 ring-amber-500/10 transition hover:bg-amber-500/15"
          aria-label={`${liveGroupCount}`}
        >
          <Lock className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.8} />
          {liveGroupCount}
        </Link>
      </div>

      {open ? (
        <ModalPortal>
          <div
            className="fixed inset-0 flex items-end justify-center bg-black/72 px-0 py-0 backdrop-blur-[2px] sm:items-center sm:px-4 sm:py-6"
            style={{ zIndex: 1000 }}
            role="dialog"
            aria-modal="true"
          >
            <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={() => setOpen(false)} />
            <section className="relative w-full max-w-[440px] overflow-hidden rounded-t-[16px] border border-white/[0.06] bg-[#11192c] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.55)] sm:rounded-[15px] sm:p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-brand" aria-hidden="true" strokeWidth={1.8} />
                  <h2 className="text-lg font-extrabold tracking-tight text-white">{labels.myGroups}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <X className="h-5 w-5" aria-hidden="true" strokeWidth={1.8} />
                </button>
              </div>

              <div className="max-h-[min(58vh,360px)] space-y-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {groups.map((group) => {
                  const active = group.id === selectedGroup?.id;
                  return (
                    <Link
                      key={group.id}
                      href={`/groups/${group.id}`}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'block rounded-[10px] border p-3 transition',
                        active
                          ? 'border-brand/60 bg-[#073a33] shadow-[inset_0_0_0_1px_rgba(0,194,129,0.18),0_0_22px_rgba(0,194,129,0.12)] ring-1 ring-brand/25 hover:border-brand hover:bg-[#0a4a40]'
                          : 'border-white/[0.06] bg-white/[0.035] hover:border-brand/45 hover:bg-brand/[0.08]',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-slate-500">
                        <span className="inline-flex items-center gap-2">
                          <span className={cn('h-2 w-2 rounded-full', active ? 'bg-brand' : 'bg-slate-500')} />
                          {group.scheduleLabel || labels.noSchedule}
                        </span>
                        {active ? <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] text-brand">{labels.active}</span> : null}
                      </div>
                      <div className="mt-3 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="mt-0.5 flex shrink-0 -space-x-2">
                            {group.membersPreview.length > 0 ? (
                              group.membersPreview.map((member, index) =>
                                member.avatarUrl && !failedAvatarSet.has(member.id) ? (
                                  <img
                                    key={member.id}
                                    src={member.avatarUrl}
                                    alt=""
                                    className="h-6 w-6 rounded-full border-2 border-[#11192c] object-cover"
                                    onError={() =>
                                      setFailedAvatarIds((current) =>
                                        current.includes(member.id) ? current : [...current, member.id],
                                      )
                                    }
                                  />
                                ) : (
                                  <span
                                    key={member.id}
                                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#11192c] text-[9px] font-extrabold text-white"
                                    style={{ backgroundColor: MEMBER_AVATAR_COLORS[index % MEMBER_AVATAR_COLORS.length] }}
                                  >
                                    {member.initials}
                                  </span>
                                ),
                              )
                            ) : (
                              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-[9px] font-extrabold text-slate-500">
                                <Users className="h-3 w-3" aria-hidden="true" />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-slate-300">{group.name}</p>
                            <p className="mt-1 text-[11px] font-semibold text-slate-500">
                              {labels.averageWeekly}: {group.weeklyQuestions}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 text-xs font-bold text-slate-400">{group.language}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <p className="mt-4 text-center text-[11px] font-medium italic text-slate-500">{labels.selectHint}</p>
            </section>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
