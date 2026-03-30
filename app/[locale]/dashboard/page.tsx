import { getTranslations } from 'next-intl/server';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { SubmitButton } from '@/components/ui/submit-button';
import { Link } from '@/i18n/navigation';
import { requireUser } from '@/lib/auth';
import { getDashboardData } from '@/lib/demo/data';
import type { AppLocale } from '@/i18n/routing';

import { createGroupAction, joinGroupAction, joinSessionByCodeAction, respondToInviteAction } from './actions';

type DashboardPageProps = {
  params: { locale: string };
  searchParams: {
    feedbackMessage?: string;
    feedbackTone?: string;
  };
};

function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand" aria-hidden="true">
      <path
        d="M13.2 2.7L6.8 12h4.1L10.8 21.3L17.2 12h-4.1l.1-9.3Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand" aria-hidden="true">
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand" aria-hidden="true">
      <path
        d="M12 4.5L20 18.5H4L12 4.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M12 9v4.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="12" cy="16.5" r="1" fill="currentColor" />
    </svg>
  );
}

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('Dashboard');
  const data = await getDashboardData(user);

  return (
    <main className="flex flex-1 flex-col gap-5">
      <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />

      <section className="mx-auto w-full max-w-[860px] space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-4xl font-extrabold tracking-tight text-white">{t('title')}</h1>
            <a href="#workspace-actions" className="button-primary gap-2 px-6">
              <span className="text-lg leading-none">+</span>
              {t('primaryAction')}
            </a>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <article className="surface p-5">
              <div className="flex items-center gap-2">
                <IconSpark />
                <p className="text-sm font-semibold text-white">{t('activityTitle')}</p>
              </div>
              <p className="mt-4 text-4xl font-extrabold tracking-tight text-white">{data.metrics.answeredCount}</p>
              <p className="mt-2 text-sm text-slate-400">{t('questionsAnswered')}</p>
              <p className="mt-3 text-sm text-slate-300">
                {t('sessionsFinished', { count: data.metrics.completedSessionsCount })}
              </p>
            </article>

            <article className="surface p-5">
              <div className="flex items-center gap-2">
                <IconTarget />
                <p className="text-sm font-semibold text-white">{t('certaintyTitle')}</p>
              </div>
              {data.metrics.successRate !== null ? (
                <>
                  <p className="mt-4 text-2xl font-extrabold tracking-tight text-white">{data.metrics.successRate}%</p>
                  <p className="mt-2 text-sm text-slate-400">
                    {t('confidenceValue', {
                      value:
                        data.metrics.averageConfidence !== null
                          ? data.metrics.averageConfidence.toFixed(1)
                          : t('noData'),
                    })}
                  </p>
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-400">{t('noData')}</p>
              )}
            </article>

            <article className="surface p-5">
              <div className="flex items-center gap-2">
                <IconAlert />
                <p className="text-sm font-semibold text-white">{t('errorTitle')}</p>
              </div>
              {data.metrics.errorRate !== null ? (
                <>
                  <p className="mt-4 text-2xl font-extrabold tracking-tight text-white">{data.metrics.errorRate}%</p>
                  <p className="mt-2 text-sm text-slate-400">{t('errorFrequencyHint')}</p>
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-400">{t('noData')}</p>
              )}
            </article>
          </div>

          <section className="surface p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-sm font-bold text-white">
                {data.metrics.leagueProgress}%
              </div>
              <div>
                <p className="text-lg font-bold text-white">{t('leagueTitle')}</p>
                <p className="mt-1 text-sm text-slate-400">{t('leagueDescription')}</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-white">{t('sessions')}</h2>
              <form action={joinSessionByCodeAction} className="flex items-center gap-2">
                <input type="hidden" name="locale" value={locale} />
                <input
                  name="sessionCode"
                  maxLength={6}
                  placeholder={t('sessionCodePlaceholder')}
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="field h-9 w-[188px] rounded-[12px] px-4 py-2 uppercase"
                />
                <SubmitButton pendingLabel={t('goPending')} className="button-primary h-9 min-w-[54px] rounded-[12px] px-4 py-2">
                  {t('go')}
                </SubmitButton>
              </form>
            </div>

            {data.sessions.length > 0 ? (
              <div className="space-y-3">
                {data.sessions.map((session) => (
                  <article key={session.id} className="surface p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-bold text-white">{session.groupName ?? t('unknownGroup')}</h3>
                        <p className="mt-2 text-sm text-slate-400">
                          {new Intl.DateTimeFormat(locale, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(session.scheduled_at))}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-brand">
                          {t('sessionCodeValue', { code: session.share_code })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
                          {session.status === 'active'
                            ? t('statusActive')
                            : session.status === 'scheduled'
                              ? t('statusScheduled')
                              : t('statusCompleted')}
                        </span>
                        <Link href={`/sessions/${session.id}`} className="button-secondary rounded-[12px] px-4 py-2">
                          {t('openSession')}
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="space-y-6 py-4">
                <p className="text-sm text-slate-400">{t('emptyGroups')}</p>
                <p className="text-sm text-slate-500">{t('noActiveSessions')}</p>
              </div>
            )}
          </section>

          <section id="workspace-actions" className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="surface p-5">
              <h2 className="text-base font-bold text-white">{t('createGroup')}</h2>
              <form action={createGroupAction} className="mt-4 space-y-3">
                <input type="hidden" name="locale" value={locale} />
                <input
                  name="groupName"
                  placeholder={t('groupNamePlaceholder')}
                  autoComplete="off"
                  className="field"
                />
                <SubmitButton pendingLabel={t('createGroupPending')} className="button-primary w-full">
                  {t('createGroup')}
                </SubmitButton>
              </form>
            </div>

            <div className="space-y-4">
              <div className="surface p-5">
                <h2 className="text-base font-bold text-white">{t('joinGroup')}</h2>
                <form action={joinGroupAction} className="mt-4 flex items-center gap-2">
                  <input type="hidden" name="locale" value={locale} />
                  <input
                    name="inviteCode"
                    maxLength={6}
                    placeholder={t('inviteCodePlaceholder')}
                    autoCapitalize="characters"
                    autoComplete="off"
                    className="field uppercase"
                  />
                  <SubmitButton pendingLabel={t('goPending')} className="button-primary min-w-[62px] rounded-[12px] px-4 py-3">
                    {t('go')}
                  </SubmitButton>
                </form>
              </div>

              {data.pendingInvites.length > 0 ? (
                <div className="surface p-5">
                  <h2 className="text-base font-bold text-white">{t('pendingInvites')}</h2>
                  <div className="mt-4 space-y-3">
                    {data.pendingInvites.map((invite) => (
                      <div key={invite.id} className="surface-soft p-4">
                        <p className="text-sm font-semibold text-white">{invite.groupName ?? t('unknownGroup')}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {t('invitedBy', { name: invite.invitedByName ?? t('captainLabel') })}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <form action={respondToInviteAction} className="flex-1">
                            <input type="hidden" name="locale" value={locale} />
                            <input type="hidden" name="inviteId" value={invite.id} />
                            <input type="hidden" name="intent" value="accept" />
                            <SubmitButton pendingLabel={t('acceptPending')} className="button-primary w-full rounded-[12px] px-4 py-2.5">
                              {t('accept')}
                            </SubmitButton>
                          </form>
                          <form action={respondToInviteAction} className="flex-1">
                            <input type="hidden" name="locale" value={locale} />
                            <input type="hidden" name="inviteId" value={invite.id} />
                            <input type="hidden" name="intent" value="decline" />
                            <SubmitButton pendingLabel={t('declinePending')} className="button-secondary w-full rounded-[12px] px-4 py-2.5">
                              {t('decline')}
                            </SubmitButton>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {data.groups.length > 0 ? (
            <section id="groups-list" className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-white">{t('groups')}</h2>
                <span className="text-sm text-slate-500">{t('membershipsCount', { count: data.groups.length })}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {data.groups.map((group) => (
                  <article key={group.id} className="surface p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-bold text-white">{group.name}</h3>
                        <p className="mt-1 text-sm text-slate-400">{t('members', { count: group.memberCount })}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                          {group.role === 'admin' ? t('captainLabel') : t('memberLabel')}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-brand">
                          {t('inviteCodeValue', { code: group.invite_code })}
                        </p>
                      </div>
                      <Link href={`/groups/${group.id}`} className="button-secondary rounded-[12px] px-4 py-2">
                        {t('openGroup')}
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
      </section>
    </main>
  );
}
