import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Search, Users } from 'lucide-react';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import {
  getUserAccessState,
  hasUserTierCapability,
} from '@/lib/billing/gating';
import { getLiveGroupsForUser } from '@/lib/live-groups/server';

import { joinLookupGroupAction } from './actions';

type LookupPageProps = {
  params: { locale: string };
  searchParams: {
    feedbackMessage?: string;
    feedbackTone?: string;
    feedbackId?: string;
  };
};

export default async function LookupPage({
  params,
  searchParams,
}: LookupPageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const [t, accessState] = await Promise.all([
    getTranslations('Lookup'),
    getUserAccessState(user.id),
  ]);
  const canBrowseLookupLayer = hasUserTierCapability(
    accessState,
    'canBrowseLookupLayer',
  );

  if (!canBrowseLookupLayer) {
    redirect(`/${locale}/billing`);
  }

  const groups = await getLiveGroupsForUser(user.id, locale);

  return (
    <main className="flex flex-1 flex-col gap-5">
      <FeedbackBanner
        message={searchParams.feedbackMessage}
        tone={searchParams.feedbackTone}
        feedbackId={searchParams.feedbackId}
      />

      <section className="overflow-hidden rounded-[16px] border border-white/[0.055] bg-[#071f1c] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-xs font-extrabold text-brand">
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              {t('eyebrow')}
            </p>
            <h1 className="mt-5 max-w-[780px] text-[30px] font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-[44px]">
              {t('title')}
            </h1>
            <p className="mt-3 max-w-[680px] text-sm font-medium leading-6 text-[#8fa7a2] sm:text-[15px]">
              {t('description')}
            </p>
          </div>
          <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.025] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6f8984]">
              {t('availableGroups', { count: groups.length })}
            </p>
            <p className="mt-3 text-[52px] font-semibold leading-none tracking-[-0.05em] text-brand">
              {groups.length}
            </p>
            <p className="mt-2 text-xs font-medium leading-5 text-[#8fa7a2]">
              {t('emptyDescription')}
            </p>
          </div>
        </div>
      </section>

      {groups.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => {
            const remainingPlaces = Math.max(
              group.maxMembers - group.memberCount,
              0,
            );

            return (
              <article
                key={group.id}
                className="flex min-h-[230px] flex-col rounded-[14px] border border-white/[0.055] bg-[#0b2522] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.22)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold tracking-[-0.01em] text-white">
                      {group.name}
                    </h2>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#6f8984]">
                      {group.language}
                    </p>
                  </div>
                  <span className="rounded-full border border-brand/25 bg-brand/10 px-2.5 py-1 text-xs font-extrabold text-brand">
                    {t('spotsRemaining', { count: remainingPlaces })}
                  </span>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <div className="flex -space-x-2">
                    {group.members.length > 0 ? (
                      group.members.map((member) => (
                        <span
                          key={member.id}
                          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#0b2522] bg-[#183247] text-[10px] font-extrabold text-slate-100"
                        >
                          {member.initials}
                        </span>
                      ))
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-slate-500">
                        <Users className="h-4 w-4" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-[#8fa7a2]">
                    {t('weeklyQuestions', { count: group.weeklyQuestions })}
                  </p>
                </div>

                <form action={joinLookupGroupAction} className="mt-auto pt-5">
                  <input type="hidden" name="locale" value={locale} />
                  <input
                    type="hidden"
                    name="inviteCode"
                    value={group.inviteCode}
                  />
                  <button
                    type="submit"
                    className="h-10 w-full rounded-[8px] bg-brand text-sm font-extrabold text-[#03130d] transition hover:bg-brand-strong"
                  >
                    {t('join')}
                  </button>
                </form>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="surface-mockup flex min-h-[220px] items-center justify-center border-dashed p-6 text-center">
          <div className="max-w-[460px]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] text-slate-500">
              <Users className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-extrabold text-white">
              {t('emptyTitle')}
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-400">
              {t('emptyDescription')}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
