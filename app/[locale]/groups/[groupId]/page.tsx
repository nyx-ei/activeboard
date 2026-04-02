import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { SubmitButton } from '@/components/ui/submit-button';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { getGroupData } from '@/lib/demo/data';

import {
  addWeeklyScheduleAction,
  deleteWeeklyScheduleAction,
  inviteMemberAction,
  scheduleSessionAction,
  updateGroupNameAction,
} from './actions';

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

  const group = data.group;
  const statusLabels = {
    pending: t('pending'),
    accepted: t('accepted'),
    declined: t('declined'),
    cancelled: t('declined'),
  };
  const weekdayLabels = {
    monday: t('weekdayMonday'),
    tuesday: t('weekdayTuesday'),
    wednesday: t('weekdayWednesday'),
    thursday: t('weekdayThursday'),
    friday: t('weekdayFriday'),
    saturday: t('weekdaySaturday'),
    sunday: t('weekdaySunday'),
  };

  return (
    <main className="flex flex-1 flex-col gap-6">
      <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />

      <section className="mx-auto grid w-full max-w-[1120px] gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="surface p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link href="/dashboard" className="button-ghost -ml-4 justify-start px-4">
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M15 6l-6 6l6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
                {t('backToDashboard')}
              </Link>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white">{t('settingsTitle')}</h1>
            </div>
            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
              {data.membership.role === 'admin' ? t('captain') : t('member')}
            </span>
          </div>

          <div className="mt-8 space-y-6">
            <div className="surface-soft p-5">
              <form action={updateGroupNameAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="groupId" value={params.groupId} />
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">{t('groupName')}</span>
                  <div className="flex items-center gap-3">
                    <input
                      name="groupName"
                      defaultValue={group.name}
                      placeholder={t('groupNamePlaceholder')}
                      autoComplete="off"
                      className="field"
                    />
                    <SubmitButton pendingLabel={t('saveNamePending')} className="button-primary min-w-[52px] px-4">
                      {t('saveShort')}
                    </SubmitButton>
                  </div>
                </label>
              </form>
            </div>

            <div className="surface-soft p-5">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-bold text-white">{t('weeklyScheduleTitle')}</p>
                    {data.weeklySchedules.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">{t('weeklyScheduleEmpty')}</p>
                    ) : null}
                  </div>
                </div>

                {data.membership.role === 'admin' ? (
                  <details className="group rounded-[18px] border border-white/[0.04] bg-white/[0.025] p-4 transition open:bg-white/[0.045]">
                    <summary className="inline-flex cursor-pointer list-none items-center rounded-[14px] px-3 py-2 text-sm font-semibold text-brand transition hover:bg-brand/10 hover:text-emerald-300">
                      + {t('addDay')}
                    </summary>
                    <form action={addWeeklyScheduleAction} className="mt-3 space-y-3">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="groupId" value={params.groupId} />
                      <div className="grid items-center gap-3 lg:grid-cols-[minmax(150px,1.2fr)_minmax(122px,0.95fr)_20px_minmax(122px,0.95fr)_minmax(96px,0.7fr)]">
                        <select
                          name="weekday"
                          className="field-compact min-w-0"
                          defaultValue="monday"
                          aria-label={t('weeklyScheduleTitle')}
                        >
                          <option value="monday">{t('weekdayMonday')}</option>
                          <option value="tuesday">{t('weekdayTuesday')}</option>
                          <option value="wednesday">{t('weekdayWednesday')}</option>
                          <option value="thursday">{t('weekdayThursday')}</option>
                          <option value="friday">{t('weekdayFriday')}</option>
                          <option value="saturday">{t('weekdaySaturday')}</option>
                          <option value="sunday">{t('weekdaySunday')}</option>
                        </select>
                        <input name="startTime" type="time" className="field-compact min-w-0" defaultValue="19:00" />
                        <span className="hidden text-center text-sm text-slate-500 lg:block">-&gt;</span>
                        <input name="endTime" type="time" className="field-compact min-w-0" defaultValue="21:00" />
                        <div className="flex min-w-0 items-center gap-2">
                          <input
                            name="questionGoal"
                            type="number"
                            min="1"
                            max="500"
                            className="field-compact min-w-0 text-center"
                            defaultValue="50"
                            aria-label={t('questionGoalValue', { count: 50 })}
                          />
                          <span className="shrink-0 text-sm font-semibold text-slate-500">Q</span>
                        </div>
                      </div>
                      <SubmitButton pendingLabel={t('saveSchedulePending')} className="button-primary w-full">
                        {t('saveSchedule')}
                      </SubmitButton>
                    </form>
                  </details>
                ) : null}

                {data.weeklySchedules.length > 0 ? (
                  <div className="space-y-3">
                    {data.weeklySchedules.map((schedule) => (
                      <div key={schedule.id} className="rounded-[18px] border border-white/[0.04] bg-white/[0.025] px-4 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="rounded-full bg-brand/12 px-3 py-1 text-sm font-semibold text-brand">
                              {weekdayLabels[schedule.weekday]}
                            </span>
                            <p className="text-sm font-medium text-slate-300">
                              {schedule.start_time.slice(0, 5)} {'->'} {schedule.end_time.slice(0, 5)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-slate-400">
                              {t('questionGoalValue', { count: schedule.question_goal })}
                            </span>
                            {data.membership.role === 'admin' ? (
                              <form action={deleteWeeklyScheduleAction}>
                                <input type="hidden" name="locale" value={locale} />
                                <input type="hidden" name="groupId" value={params.groupId} />
                                <input type="hidden" name="scheduleId" value={schedule.id} />
                                <button type="submit" className="button-ghost px-2 py-2 text-slate-500 hover:text-white">
                                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                                    <path
                                      d="M9 4.5h6M5.5 7.5h13M9 10.5v6M15 10.5v6M7.5 7.5l.6 10a2 2 0 0 0 2 1.8h3.8a2 2 0 0 0 2-1.8l.6-10"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="1.8"
                                    />
                                  </svg>
                                </button>
                              </form>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="surface-soft p-5">
              <p className="text-sm font-semibold text-slate-300">{t('inviteCodeTitle')}</p>
              <p className="mt-2 text-sm text-slate-500">{t('createdCode', { code: group.invite_code })}</p>
            </div>

            {data.membership.role === 'admin' ? (
              <div className="surface-soft p-5">
                <h2 className="text-xl font-bold text-white">{t('inviteMember')}</h2>
                <form action={inviteMemberAction} className="mt-4 space-y-3">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="groupId" value={params.groupId} />
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-300">{t('email')}</span>
                    <div className="flex items-center gap-3">
                      <input
                        name="email"
                        type="email"
                        placeholder={t('emailPlaceholder')}
                        autoComplete="email"
                        className="field"
                      />
                      <SubmitButton pendingLabel={t('sendInvitePending')} className="button-primary min-w-[70px]">
                        {t('sendInviteShort')}
                      </SubmitButton>
                    </div>
                  </label>
                </form>
              </div>
            ) : null}

            <div className="surface-soft p-5">
              <h2 className="text-xl font-bold text-white">{t('membersTitle')}</h2>
              <div className="mt-4 space-y-3">
                {data.members.map((member) => {
                  const label = member.profile?.display_name ?? member.profile?.email ?? member.user_id;
                  const initials = label
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <div key={member.user_id} className="rounded-[18px] bg-white/[0.04] px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/20 text-sm font-bold text-brand">
                          {initials}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{label}</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                            {member.role === 'admin' ? t('captain') : t('member')}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <section className="surface p-6 sm:p-8">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">{t('scheduleSession')}</h2>
            <form action={scheduleSessionAction} className="mt-6 grid gap-4">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="groupId" value={params.groupId} />

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">{t('sessionName')}</span>
                <input
                  name="sessionName"
                  placeholder={t('sessionNamePlaceholder')}
                  className="field"
                  autoComplete="off"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">{t('date')}</span>
                  <input name="date" type="date" className="field" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">{t('time')}</span>
                  <input name="time" type="time" className="field" />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">{t('timerMode')}</span>
                <div className="grid grid-cols-2 gap-2 rounded-[18px] border border-border bg-white/[0.03] p-1">
                  <label className="cursor-pointer">
                    <input type="radio" name="timerMode" value="per_question" defaultChecked className="peer sr-only" />
                    <span className="flex w-full items-center justify-center rounded-[14px] px-4 py-3 text-sm font-semibold text-slate-300 transition peer-checked:bg-brand peer-checked:text-[#05291f] hover:bg-white/[0.05] peer-checked:hover:bg-brand">
                      {t('perQuestionMode')}
                    </span>
                  </label>
                  <label className="cursor-pointer">
                    <input type="radio" name="timerMode" value="global" className="peer sr-only" />
                    <span className="flex w-full items-center justify-center rounded-[14px] px-4 py-3 text-sm font-semibold text-slate-400 transition peer-checked:bg-brand peer-checked:text-[#05291f] hover:bg-white/[0.05] peer-checked:hover:bg-brand">
                      {t('globalMode')}
                    </span>
                  </label>
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">{t('timer')}</span>
                <select name="timerSeconds" className="field" defaultValue="60">
                  <option value="30">30</option>
                  <option value="45">45</option>
                  <option value="60">60</option>
                  <option value="90">90</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">{t('meetingLink')}</span>
                <input
                  name="meetingLink"
                  type="url"
                  placeholder={t('meetingLinkPlaceholder')}
                  className="field"
                />
              </label>

              <SubmitButton pendingLabel={t('scheduleSessionPending')} className="button-primary mt-2 w-full">
                {t('createSession')}
              </SubmitButton>
            </form>
          </section>

          <section className="surface p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white">{t('invitesTitle')}</h2>
            <div className="mt-4 space-y-3">
              {data.invites.length > 0 ? (
                data.invites.map((invite) => (
                  <div key={invite.id} className="surface-soft p-4">
                    <p className="text-sm font-semibold text-white">{invite.invitee_email}</p>
                    <p className="mt-1 text-sm text-slate-400">{invite.invitedByName ?? t('captain')}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                      {statusLabels[invite.status]}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-slate-400">{t('inviteEmpty')}</p>
              )}
            </div>
          </section>

          <section className="surface p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white">{t('sessionsTitle')}</h2>
            <div className="mt-4 space-y-4">
              {data.sessions.length > 0 ? (
                data.sessions.map((session) => (
                  <div key={session.id} className="surface-soft p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-bold text-white">{session.name ?? group.name}</p>
                        <p className="mt-2 text-sm text-slate-400">
                          {new Intl.DateTimeFormat(locale, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(session.scheduled_at))}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {session.timer_mode === 'global'
                            ? t('timerValueGlobal', { seconds: session.timer_seconds })
                            : t('timerValue', { seconds: session.timer_seconds })}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-brand">
                          {t('sessionShareCode', { code: session.share_code })}
                        </p>
                      </div>
                      <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                        {session.status === 'active'
                          ? t('statusActive')
                          : session.status === 'scheduled'
                            ? t('statusScheduled')
                            : t('statusCompleted')}
                      </span>
                    </div>
                    <div className="mt-5">
                      <Link href={`/sessions/${session.id}`} className="button-secondary">
                        {t('openSession')}
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-slate-400">{t('sessionEmpty')}</p>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
