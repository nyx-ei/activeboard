import { getTranslations } from 'next-intl/server';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { SubmitButton } from '@/components/ui/submit-button';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { getDashboardData } from '@/lib/demo/data';

import { createGroupAction, joinGroupAction, joinSessionByCodeAction, respondToInviteAction } from './actions';

type DashboardPageProps = {
  params: { locale: string };
  searchParams: {
    feedbackMessage?: string;
    feedbackTone?: string;
    view?: string;
  };
};

function SectionAccent() {
  return <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />;
}

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('Dashboard');
  const view = searchParams.view === 'group' ? 'group' : 'individual';
  const isGroupView = view === 'group';
  const data = await getDashboardData(user, isGroupView);
  const weekdayLabels = {
    monday: t('weekdayMonday'),
    tuesday: t('weekdayTuesday'),
    wednesday: t('weekdayWednesday'),
    thursday: t('weekdayThursday'),
    friday: t('weekdayFriday'),
    saturday: t('weekdaySaturday'),
    sunday: t('weekdaySunday'),
  };
  const leadSchedule = data.groupDashboard.schedules[0] ?? null;

  return (
    <main className="flex flex-1 flex-col gap-5">
      <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />

      <section className="mx-auto w-full max-w-[860px] space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">{t('title')}</h1>
          <a href="#workspace-actions" className="button-primary gap-2 px-6">
            <span className="text-lg leading-none">+</span>
            {t('primaryAction')}
          </a>
        </div>

        <section className="relative rounded-[20px] border border-border bg-white/[0.03] p-1.5">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-3 left-1/2 hidden w-px -translate-x-1/2 bg-white/[0.08] md:block"
          />
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`/${locale}/dashboard?view=individual`}
              className={[
                'relative z-10 inline-flex items-center justify-center rounded-[14px] px-4 py-2.5 text-base font-semibold transition',
                !isGroupView
                  ? 'bg-emerald-500/18 text-brand shadow-[inset_0_0_0_1px_rgba(22,210,144,0.16)] hover:bg-emerald-500/28'
                  : 'text-slate-400 hover:bg-emerald-500/10 hover:text-white',
              ].join(' ')}
            >
              {t('individualTab')}
            </a>
            <a
              href={`/${locale}/dashboard?view=group`}
              className={[
                'relative z-10 inline-flex items-center justify-center rounded-[14px] px-4 py-2.5 text-base font-semibold transition',
                isGroupView
                  ? 'bg-emerald-500/18 text-brand shadow-[inset_0_0_0_1px_rgba(22,210,144,0.16)] hover:bg-emerald-500/28'
                  : 'text-slate-400 hover:bg-emerald-500/10 hover:text-white',
              ].join(' ')}
            >
              {t('groupTab')}
            </a>
          </div>
        </section>

        {isGroupView ? (
          <section className="space-y-5">
            <article className="surface p-5">
              <div className="flex items-center gap-3">
                <SectionAccent />
                <div className="w-full">
                  <p className="text-[1.2rem] font-bold text-white">{t('groupScheduleTitle')}</p>
                  <div className="mt-4">
                    {leadSchedule ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full bg-brand/12 px-3 py-1 text-sm font-semibold text-brand">
                            {weekdayLabels[leadSchedule.weekday]}
                          </span>
                          <span className="text-sm font-medium text-slate-300">
                            {leadSchedule.start_time.slice(0, 5)} {'->'} {leadSchedule.end_time.slice(0, 5)}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-slate-500">
                          {t('questionGoalValue', { count: leadSchedule.question_goal })}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">{t('groupScheduleEmpty')}</p>
                    )}
                  </div>
                  <p className="mt-4 text-xs italic text-slate-500">{t('groupScheduleHint')}</p>
                </div>
              </div>
            </article>

            <article className="surface p-5">
              <div className="flex items-center gap-3">
                <SectionAccent />
                <p className="text-[1.2rem] font-bold text-white">{t('groupProgressTitle')}</p>
              </div>
              <p className="mt-5 text-5xl font-extrabold tracking-tight text-white">
                {data.groupDashboard.weeklyProgressPercentage}%
                {data.groupDashboard.weeklyTargetQuestions > 0 ? (
                  <span className="ml-2 text-lg font-semibold text-slate-500">
                    ({t('weeklyQuestionGoalShort', { count: data.groupDashboard.weeklyTargetQuestions })})
                  </span>
                ) : null}
              </p>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-brand transition-[width]"
                  style={{ width: `${data.groupDashboard.weeklyProgressPercentage}%` }}
                />
              </div>
              <p className="mt-4 text-sm text-slate-300">
                {t('groupProgressSummary', {
                  completed: data.groupDashboard.weeklyCompletedQuestions,
                  total: data.groupDashboard.weeklyTargetQuestions,
                })}
              </p>
              <p className="mt-4 text-xs italic text-slate-500">{t('groupProgressHint')}</p>
            </article>

            <article className="surface p-5">
              <div className="flex items-center gap-3">
                <SectionAccent />
                <p className="text-[1.2rem] font-bold text-white">{t('memberPerformanceTitle')}</p>
              </div>

              {data.groupDashboard.memberPerformance.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {data.groupDashboard.memberPerformance.map((member) => (
                    <div key={member.userId} className="surface-soft flex items-center justify-between gap-4 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/20 text-sm font-extrabold text-brand">
                          {member.initials}
                          {member.role === 'admin' ? (
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black text-slate-950">
                              C
                            </span>
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-lg font-bold text-white">{member.name}</p>
                          <p className="mt-1 text-sm text-slate-400">
                            {t('memberPresence', { value: member.presenceRate })} - {t('memberCompletion', { value: member.completionRate })}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300">
                        {member.status === 'setup' ? t('memberStatusSetup') : t('memberStatusActive')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-400">{t('groupViewEmpty')}</p>
              )}
            </article>
          </section>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <article className="surface p-5">
                <div className="flex items-center gap-2">
                  <SectionAccent />
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
                  <SectionAccent />
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
                  <SectionAccent />
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
                          <h3 className="truncate text-lg font-bold text-white">
                            {session.name ?? session.groupName ?? t('unknownGroup')}
                          </h3>
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
          </>
        )}

        <section id="workspace-actions" className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="surface p-5">
            <h2 className="text-base font-bold text-white">{t('createGroup')}</h2>
            <form action={createGroupAction} className="mt-4 space-y-3">
              <input type="hidden" name="locale" value={locale} />
              <input name="groupName" placeholder={t('groupNamePlaceholder')} autoComplete="off" className="field" />
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
