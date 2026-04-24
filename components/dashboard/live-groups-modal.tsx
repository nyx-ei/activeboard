'use client';

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';

import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { SubmitButton } from '@/components/ui/submit-button';
import { Modal, ModalTitle } from '@/components/ui/modal';

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

type LiveGroupsModalProps = {
  locale: string;
  canJoinLiveGroups: boolean;
  initialOpen?: boolean;
  joinGroupAction: (formData: FormData) => void | Promise<void>;
  labels: {
    open: string;
    title: string;
    close: string;
    join: string;
    joinPending: string;
    upgradeRequired: string;
    upgradeDescription: string;
    upgrade: string;
    empty: string;
    remainingPlaces: string;
    oneRemainingPlace: string;
    secondsAgo: string;
    minutesAgo: string;
    daysAgo: string;
    weeksAgo: string;
    monthsAgo: string;
    yearsAgo: string;
    hoursAgo: string;
    averageWeekly: string;
  };
};

const AVATAR_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#f59e0b'];

function formatElapsedTime(minutes: number, labels: LiveGroupsModalProps['labels']) {
  if (minutes < 1) {
    return labels.secondsAgo.replace('{count}', '1');
  }

  if (minutes < 60) {
    return labels.minutesAgo.replace('{count}', String(minutes));
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return labels.hoursAgo.replace('{count}', String(hours));
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return labels.daysAgo.replace('{count}', String(days));
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 4) {
    return labels.weeksAgo.replace('{count}', String(weeks));
  }

  const months = Math.floor(weeks / 4);
  if (months < 12) {
    return labels.monthsAgo.replace('{count}', String(months));
  }

  return labels.yearsAgo.replace('{count}', String(Math.floor(months / 12)));
}

export function LiveGroupsModal({ locale, canJoinLiveGroups, initialOpen = false, joinGroupAction, labels }: LiveGroupsModalProps) {
  const [open, setOpen] = useState(initialOpen);
  const [groups, setGroups] = useState<LiveGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!open || !canJoinLiveGroups) {
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    void fetch(`/api/live-groups?locale=${locale}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as { ok?: boolean; groups?: LiveGroup[] } | null;
      })
      .then((payload) => {
        if (payload?.ok && Array.isArray(payload.groups)) {
          setGroups(payload.groups);
        }
      })
      .catch(() => {
        setGroups([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [canJoinLiveGroups, locale, open]);

  function handleClose() {
    setOpen(false);
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (!params.has('live')) {
      return;
    }

    params.delete('live');
    const nextSearch = params.toString();
    router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-[50px] w-full items-center justify-center gap-2 rounded-[9px] bg-[#344258] text-sm font-extrabold text-white transition hover:bg-[#3b4a62]"
      >
        <Lock className="h-4 w-4" aria-hidden="true" strokeWidth={1.7} />
        {labels.open}
      </button>

      {open ? (
        <Modal
          open={open}
          onClose={handleClose}
          backdropLabel={labels.close}
          mobileSheet
          contentClassName="relative max-h-[82vh] w-full max-w-[548px] animate-in slide-in-from-bottom-4 overflow-y-auto rounded-t-[16px] border border-white/[0.08] bg-[#11192c] p-5 shadow-[0_-24px_80px_rgba(0,0,0,0.6)] duration-200 [scrollbar-width:none] sm:rounded-[14px] [&::-webkit-scrollbar]:hidden"
        >
            <div className="flex items-center justify-between">
              <ModalTitle className="flex items-center gap-2 text-lg font-extrabold text-white">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.08)]" />
                {labels.title}
              </ModalTitle>
              <button type="button" onClick={handleClose} className="text-2xl leading-none text-slate-400 hover:text-white" aria-label={labels.close}>
                x
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {isLoading ? (
                <div className="rounded-[12px] border border-white/[0.06] bg-[#18243a] p-4 text-sm font-semibold text-slate-400">
                  Loading...
                </div>
              ) : null}

              {!isLoading && groups.length === 0 ? (
                <div className="rounded-[12px] border border-white/[0.06] bg-[#18243a] p-4 text-sm font-semibold text-slate-400">
                  {labels.empty}
                </div>
              ) : null}

              {groups.map((group) => {
                const remaining = Math.max(group.maxMembers - group.memberCount, 0);

                return (
                  <article key={group.id} className="rounded-[12px] border border-white/[0.06] bg-[#18243a] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-500">{formatElapsedTime(group.minutesAgo, labels)}</p>
                        <div className="mt-4 flex -space-x-2">
                          {group.members.length > 0 ? (
                            group.members.map((member, index) => (
                              <span
                                key={member.id}
                                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#18243a] text-[10px] font-extrabold text-white"
                                style={{ backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }}
                              >
                                {member.initials}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs font-semibold text-slate-500">-</span>
                          )}
                        </div>
                      </div>

                      {canJoinLiveGroups ? (
                        <form action={joinGroupAction}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="inviteCode" value={group.inviteCode} />
                          <SubmitButton pendingLabel={labels.joinPending} className="button-secondary h-8 rounded-[8px] px-4 text-sm font-extrabold">
                            <Lock className="mr-1 h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.7} />
                            {labels.join}
                          </SubmitButton>
                        </form>
                      ) : (
                        <button type="button" className="inline-flex h-8 items-center rounded-[8px] bg-slate-500/30 px-4 text-sm font-extrabold text-white/80" disabled>
                          <Lock className="mr-1 h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.7} />
                          {labels.join}
                        </button>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                      <span className="rounded-full bg-white/[0.05] px-2.5 py-1">{group.name}</span>
                      <span className="rounded-full bg-white/[0.05] px-2.5 py-1">{group.language}</span>
                      <span className="rounded-full bg-white/[0.05] px-2.5 py-1">{labels.averageWeekly}: {group.weeklyQuestions}</span>
                      <span className={`rounded-full px-2.5 py-1 ${remaining === 1 ? 'bg-amber-400/10 text-amber-400' : 'bg-white/[0.05]'}`}>
                        {remaining === 1 ? labels.oneRemainingPlace : labels.remainingPlaces.replace('{count}', String(remaining))}
                      </span>
                    </div>
                  </article>
                );
              })}

              {!canJoinLiveGroups ? (
                <div className="flex items-center justify-between gap-4 rounded-[12px] border border-amber-400/20 bg-white/[0.035] p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Lock className="h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" strokeWidth={1.7} />
                    <div>
                      <p className="text-sm font-extrabold text-white">{labels.upgradeRequired}</p>
                      <p className="text-xs text-slate-500">{labels.upgradeDescription}</p>
                    </div>
                  </div>
                  <Link href="/billing" className="button-primary h-9 rounded-[8px] px-4 text-sm font-extrabold">
                    {labels.upgrade}
                  </Link>
                </div>
              ) : null}
            </div>
        </Modal>
      ) : null}
    </>
  );
}
