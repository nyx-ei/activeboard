import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { SubmitButton } from '@/components/ui/submit-button';
import { Link } from '@/i18n/navigation';
import { requireUser } from '@/lib/auth';
import { getGroupData } from '@/lib/demo/data';
import type { AppLocale } from '@/i18n/routing';

import { inviteMemberAction, scheduleSessionAction } from './actions';

type GroupPageProps = {
  params: { locale: string; groupId: string };
  searchParams: {
    feedbackMessage?: string;
    feedbackTone?: string;
  };
};

export default async function GroupPage({ params, searchParams }: GroupPageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('Group');
  const data = await getGroupData(params.groupId, user);

  if (!data?.group) {
    notFound();
  }

  const statusLabels = {
    pending: t('pending'),
    accepted: t('accepted'),
    declined: t('declined'),
    cancelled: t('declined'),
  };

  return (
    <main className="flex flex-1 flex-col gap-6">
      <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />

      <section className="surface p-8 sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/dashboard" className="text-sm font-medium text-brand-strong">
              {t('backToDashboard')}
            </Link>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">{data.group.name}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{t('createdCode', { code: data.group.invite_code })}</p>
          </div>
          <span className="rounded-full bg-brand/10 px-4 py-2 text-sm font-semibold text-brand-strong">
            {data.membership.role === 'admin' ? t('captain') : t('member')}
          </span>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          {data.membership.role === 'admin' ? (
            <>
              <div className="surface p-6">
                <h2 className="text-lg font-semibold text-slate-950">{t('inviteMember')}</h2>
                <form action={inviteMemberAction} className="mt-4 space-y-3">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="groupId" value={params.groupId} />
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">{t('email')}</span>
                    <input
                      name="email"
                      type="email"
                      placeholder={t('emailPlaceholder')}
                      autoComplete="email"
                      className="w-full rounded-2xl border border-border bg-white px-4 py-3 outline-none ring-brand transition focus:ring-2"
                    />
                  </label>
                  <SubmitButton
                    pendingLabel={t('sendInvitePending')}
                    className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong"
                  >
                    {t('sendInvite')}
                  </SubmitButton>
                </form>
              </div>

              <div className="surface p-6">
                <h2 className="text-lg font-semibold text-slate-950">{t('scheduleSession')}</h2>
                <form action={scheduleSessionAction} className="mt-4 grid gap-3">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="groupId" value={params.groupId} />
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">{t('date')}</span>
                    <input
                      name="date"
                      type="date"
                      className="w-full rounded-2xl border border-border bg-white px-4 py-3 outline-none ring-brand transition focus:ring-2"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">{t('time')}</span>
                    <input
                      name="time"
                      type="time"
                      className="w-full rounded-2xl border border-border bg-white px-4 py-3 outline-none ring-brand transition focus:ring-2"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">{t('timer')}</span>
                    <select
                      name="timerSeconds"
                      className="w-full rounded-2xl border border-border bg-white px-4 py-3 outline-none ring-brand transition focus:ring-2"
                      defaultValue="60"
                    >
                      <option value="30">30</option>
                      <option value="45">45</option>
                      <option value="60">60</option>
                      <option value="90">90</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">{t('meetingLink')}</span>
                    <input
                      name="meetingLink"
                      type="url"
                      placeholder={t('meetingLinkPlaceholder')}
                      className="w-full rounded-2xl border border-border bg-white px-4 py-3 outline-none ring-brand transition focus:ring-2"
                    />
                  </label>
                  <SubmitButton
                    pendingLabel={t('scheduleSessionPending')}
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {t('scheduleSession')}
                  </SubmitButton>
                </form>
              </div>
            </>
          ) : null}

          <div className="surface p-6">
            <h2 className="text-lg font-semibold text-slate-950">{t('membersTitle')}</h2>
            <div className="mt-4 space-y-3">
              {data.members.map((member) => (
                <div key={member.user_id} className="rounded-2xl border border-border bg-slate-50/80 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    {member.profile?.display_name ?? member.profile?.email ?? member.user_id}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {member.role === 'admin' ? t('captain') : t('member')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="surface p-6">
            <h2 className="text-lg font-semibold text-slate-950">{t('invitesTitle')}</h2>
            <div className="mt-4 space-y-3">
              {data.invites.length > 0 ? (
                data.invites.map((invite) => (
                  <div key={invite.id} className="rounded-2xl border border-border bg-slate-50/80 p-4">
                    <p className="text-sm font-semibold text-slate-900">{invite.invitee_email}</p>
                    <p className="mt-1 text-sm text-slate-600">{invite.invitedByName ?? t('captain')}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-brand-strong">
                      {statusLabels[invite.status]}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-slate-600">{t('inviteEmpty')}</p>
              )}
            </div>
          </div>

          <div className="surface p-6">
            <h2 className="text-lg font-semibold text-slate-950">{t('sessionsTitle')}</h2>
            <div className="mt-4 space-y-3">
              {data.sessions.length > 0 ? (
                data.sessions.map((session) => (
                  <div key={session.id} className="rounded-2xl border border-border bg-slate-50/80 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(session.scheduled_at))}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{session.timer_seconds}s</p>
                    <div className="mt-4">
                      <Link
                        href={`/sessions/${session.id}`}
                        className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-border transition hover:bg-slate-100"
                      >
                        {t('openSession')}
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-slate-600">{t('sessionEmpty')}</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
