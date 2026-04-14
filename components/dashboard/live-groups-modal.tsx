'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import { SubmitButton } from '@/components/ui/submit-button';

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
  groups: LiveGroup[];
  canJoinLiveGroups: boolean;
  joinGroupAction: (formData: FormData) => void | Promise<void>;
  labels: {
    open: string;
    title: string;
    close: string;
    join: string;
    joinPending: string;
    upgradeRequired: string;
    upgrade: string;
    compatibleDays: string;
    remainingPlaces: string;
    oneRemainingPlace: string;
    minutesAgo: string;
  };
};

export function LiveGroupsModal({ locale, groups, canJoinLiveGroups, joinGroupAction, labels }: LiveGroupsModalProps) {
  const [open, setOpen] = useState(false);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-[2px]">
          <section className="max-h-[78vh] w-full max-w-[548px] overflow-y-auto rounded-[14px] border border-white/[0.08] bg-[#11192c] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-extrabold text-white">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                {labels.title}
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="text-2xl leading-none text-slate-400 hover:text-white" aria-label={labels.close}>
                x
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {groups.map((group) => {
                const remaining = Math.max(group.maxMembers - group.memberCount, 0);
                return (
                  <article key={group.id} className="rounded-[12px] border border-white/[0.06] bg-[#18243a] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-500">{labels.minutesAgo.replace('{count}', String(group.minutesAgo))}</p>
                        <div className="mt-4 flex -space-x-2">
                          {group.members.map((member, index) => (
                            <span
                              key={member.id}
                              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#18243a] text-[10px] font-extrabold text-white"
                              style={{ backgroundColor: ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899'][index % 5] }}
                            >
                              {member.initials}
                            </span>
                          ))}
                        </div>
                      </div>
                      {canJoinLiveGroups ? (
                        <form action={joinGroupAction}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="inviteCode" value={group.inviteCode} />
                          <SubmitButton pendingLabel={labels.joinPending} className="button-secondary h-9 rounded-[8px] px-4 text-sm font-extrabold">
                            <Lock className="mr-1 h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.7} />
                            {labels.join}
                          </SubmitButton>
                        </form>
                      ) : (
                        <Link href="/billing" className="button-primary h-9 rounded-[8px] px-4 text-sm font-extrabold">
                          {labels.upgrade}
                        </Link>
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-4 text-xs font-semibold text-slate-500">
                      <p className="truncate">
                        {group.name} · {group.language} · {group.timezone} · Moy./sem: {group.weeklyQuestions} ·{' '}
                        <span className={remaining === 1 ? 'text-amber-400' : ''}>
                          {remaining === 1 ? labels.oneRemainingPlace : labels.remainingPlaces.replace('{count}', String(remaining))}
                        </span>
                      </p>
                      <span className="shrink-0 text-slate-400">{group.language}</span>
                    </div>
                    {group.compatible ? <p className="mt-3 text-xs font-bold text-brand">✓ {labels.compatibleDays}</p> : null}
                  </article>
                );
              })}

              {!canJoinLiveGroups ? (
                <div className="flex items-center justify-between gap-4 rounded-[12px] border border-amber-400/20 bg-white/[0.035] p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Lock className="h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" strokeWidth={1.7} />
                    <div>
                      <p className="text-sm font-extrabold text-white">{labels.upgradeRequired}</p>
                      <p className="text-xs text-slate-500">Passez au plan illimité pour rejoindre des groupes en direct</p>
                    </div>
                  </div>
                  <Link href="/billing" className="button-primary h-9 rounded-[8px] px-4 text-sm font-extrabold">
                    {labels.upgrade}
                  </Link>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
