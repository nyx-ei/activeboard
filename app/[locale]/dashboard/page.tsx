import { getTranslations } from 'next-intl/server';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { LogoutButton } from '@/components/auth/logout-button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Link } from '@/i18n/navigation';
import { requireUser } from '@/lib/auth';
import { getDashboardData } from '@/lib/demo/data';
import type { AppLocale } from '@/i18n/routing';

import { createGroupAction, joinGroupAction, respondToInviteAction } from './actions';

type DashboardPageProps = {
  params: { locale: string };
  searchParams: {
    feedbackMessage?: string;
    feedbackTone?: string;
  };
};

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('Dashboard');
  const data = await getDashboardData(user);

  return (
    <main className="flex flex-1 flex-col gap-6">
      <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />

      <section className="surface p-8 sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">{t('eyebrow')}</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">{t('title')}</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{t('description')}</p>
            <p className="mt-4 text-sm font-medium text-brand-strong">
              {t('welcome', { name: user.user_metadata.full_name ?? user.email ?? t('captainLabel') })}
            </p>
          </div>
          <LogoutButton />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-6">
          <div className="surface p-6">
            <h2 className="text-lg font-semibold text-slate-950">{t('createGroup')}</h2>
            <form action={createGroupAction} className="mt-4 space-y-3">
              <input type="hidden" name="locale" value={locale} />
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">{t('groupName')}</span>
                <input
                  name="groupName"
                  placeholder={t('groupNamePlaceholder')}
                  autoComplete="off"
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 outline-none ring-brand transition focus:ring-2"
                />
              </label>
              <SubmitButton
                pendingLabel={t('createGroupPending')}
                className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong"
              >
                {t('createGroup')}
              </SubmitButton>
            </form>
          </div>

          <div className="surface p-6">
            <h2 className="text-lg font-semibold text-slate-950">{t('joinGroup')}</h2>
            <form action={joinGroupAction} className="mt-4 space-y-3">
              <input type="hidden" name="locale" value={locale} />
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">{t('inviteCode')}</span>
                <input
                  name="inviteCode"
                  maxLength={6}
                  placeholder={t('inviteCodePlaceholder')}
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 uppercase outline-none ring-brand transition focus:ring-2"
                />
              </label>
              <SubmitButton
                pendingLabel={t('joinGroupPending')}
                className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {t('joinGroup')}
              </SubmitButton>
            </form>
          </div>

          <div className="surface p-6">
            <h2 className="text-lg font-semibold text-slate-950">{t('pendingInvites')}</h2>
            <div className="mt-4 space-y-3">
              {data.pendingInvites.length > 0 ? (
                data.pendingInvites.map((invite) => (
                  <div key={invite.id} className="rounded-3xl border border-border bg-slate-50/70 p-4">
                    <p className="text-sm font-semibold text-slate-900">{invite.groupName ?? t('unknownGroup')}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {t('invitedBy', { name: invite.invitedByName ?? t('captainLabel') })}
                    </p>
                    <div className="mt-4 flex gap-3">
                      <form action={respondToInviteAction} className="flex-1">
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <input type="hidden" name="intent" value="accept" />
                        <SubmitButton
                          pendingLabel={t('acceptPending')}
                          className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong"
                        >
                          {t('accept')}
                        </SubmitButton>
                      </form>
                      <form action={respondToInviteAction} className="flex-1">
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <input type="hidden" name="intent" value="decline" />
                        <SubmitButton
                          pendingLabel={t('declinePending')}
                          className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          {t('decline')}
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-slate-600">{t('noInvites')}</p>
              )}
            </div>
          </div>
        </div>

        <div className="surface p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-950">{t('groups')}</h2>
          <div className="mt-4 grid gap-4">
            {data.groups.length > 0 ? (
              data.groups.map((group) => (
                <article key={group.id} className="rounded-3xl border border-border bg-slate-50/80 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">{group.name}</h3>
                      <p className="mt-1 text-sm text-slate-600">{t('members', { count: group.memberCount })}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {group.role === 'admin' ? t('captainLabel') : t('memberLabel')} - {group.invite_code}
                      </p>
                    </div>
                    <Link
                      href={`/groups/${group.id}`}
                      className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-border transition hover:bg-slate-100"
                    >
                      {t('openGroup')}
                    </Link>
                  </div>
                  {group.nextSession ? (
                    <div className="mt-4 rounded-2xl bg-white p-4">
                      <p className="text-sm font-medium text-slate-500">{t('nextSession')}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {t('scheduledFor', {
                          date: new Intl.DateTimeFormat(locale, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(group.nextSession.scheduled_at)),
                        })}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-brand-strong">
                        {t('timerLabel', { seconds: group.nextSession.timer_seconds })}
                      </p>
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="text-sm leading-6 text-slate-600">{t('emptyGroups')}</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
