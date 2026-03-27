import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { SessionAutoRefresh } from '@/components/session/session-auto-refresh';
import { SessionCountdown } from '@/components/session/session-countdown';
import { SubmitButton } from '@/components/ui/submit-button';
import { Link } from '@/i18n/navigation';
import { requireUser } from '@/lib/auth';
import { getSessionData } from '@/lib/demo/data';
import { ANSWER_OPTIONS } from '@/lib/types/demo';
import type { AppLocale } from '@/i18n/routing';

import { launchQuestionAction, revealAnswerAction, startSessionAction, submitAnswerAction } from './actions';

type SessionPageProps = {
  params: { locale: string; sessionId: string };
  searchParams: {
    feedbackMessage?: string;
    feedbackTone?: string;
  };
};

export default async function SessionPage({ params, searchParams }: SessionPageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('Session');
  const data = await getSessionData(params.sessionId, user);

  if (!data?.session || !data.group) {
    notFound();
  }

  const isLeader = data.session.leader_id === user.id || data.membership.role === 'admin';
  const statusLabel =
    data.session.status === 'scheduled'
      ? t('statusScheduled')
      : data.session.status === 'active'
        ? t('statusActive')
        : t('statusCompleted');
  const timeRemaining =
    data.currentQuestion?.answer_deadline_at && data.currentQuestion.phase === 'answering'
      ? Math.max(
          0,
          Math.floor((new Date(data.currentQuestion.answer_deadline_at).getTime() - Date.now()) / 1000),
        )
      : 0;

  return (
    <main className="flex flex-1 flex-col gap-6">
      <SessionAutoRefresh enabled={data.session.status === 'active'} />
      <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />

      <section className="surface p-8 sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href={`/groups/${data.group.id}`} className="text-sm font-medium text-brand-strong">
              {data.group.name}
            </Link>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">{t('title')}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                new Date(data.session.scheduled_at),
              )}
            </p>
          </div>
          <div className="space-y-2 text-right">
            <p className="text-sm font-medium text-slate-500">{statusLabel}</p>
            <p className="text-xl font-semibold text-brand-strong">{data.session.timer_seconds}s</p>
          </div>
        </div>

        {data.session.meeting_link ? (
          <a
            href={data.session.meeting_link}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {t('joinCall')}
          </a>
        ) : null}
      </section>

      {data.session.status === 'scheduled' ? (
        <section className="surface p-6">
          <p className="text-sm leading-6 text-slate-600">{t('sessionNotStarted')}</p>
          {isLeader ? (
            <form action={startSessionAction} className="mt-4">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="sessionId" value={params.sessionId} />
              <SubmitButton
                pendingLabel={t('startSessionPending')}
                className="rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong"
              >
                {t('startSession')}
              </SubmitButton>
            </form>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-6">
          {isLeader ? (
            <div className="surface p-6">
              <h2 className="text-lg font-semibold text-slate-950">{t('captainPanel')}</h2>
              <form action={launchQuestionAction} className="mt-4 space-y-3">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="sessionId" value={params.sessionId} />
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">{t('questionBody')}</span>
                  <textarea
                    name="questionBody"
                    rows={5}
                    placeholder={t('questionPlaceholder')}
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 outline-none ring-brand transition focus:ring-2"
                  />
                </label>
                <SubmitButton
                  pendingLabel={t('launchQuestionPending')}
                  className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong"
                >
                  {t('launchQuestion')}
                </SubmitButton>
              </form>
            </div>
          ) : null}

          <div className="surface p-6">
            <h2 className="text-lg font-semibold text-slate-950">{t('participantPanel')}</h2>
            {data.currentQuestion ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-3xl bg-slate-950 px-5 py-4 text-white">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{t('timer')}</p>
                  <p className="mt-2 text-4xl font-semibold">
                    <SessionCountdown initialSeconds={timeRemaining} />
                  </p>
                </div>
                <div className="rounded-3xl border border-border bg-slate-50/80 p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    {t('questionNumber', { number: data.currentQuestion.order_index + 1 })}
                  </p>
                  <p className="mt-3 text-base leading-7 text-slate-900">{data.currentQuestion.body}</p>
                </div>

                {data.currentQuestion.phase === 'answering' ? (
                  <form action={submitAnswerAction} className="space-y-4">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="sessionId" value={params.sessionId} />
                    <input type="hidden" name="questionId" value={data.currentQuestion.id} />
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {ANSWER_OPTIONS.map((option) => (
                        <label
                          key={option}
                          className="cursor-pointer rounded-2xl border border-border bg-white px-4 py-4 text-center text-base font-semibold text-slate-800 transition hover:border-brand hover:bg-brand/5 has-[:checked]:border-brand has-[:checked]:bg-brand/10 has-[:checked]:text-brand-strong has-[:checked]:ring-2 has-[:checked]:ring-brand/20"
                        >
                          <input
                            type="radio"
                            name="selectedOption"
                            value={option}
                            defaultChecked={data.myAnswer?.selected_option === option}
                            className="sr-only"
                          />
                          {option}
                        </label>
                      ))}
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">{t('yourConfidence')}</span>
                      <select
                        name="confidence"
                        defaultValue={String(data.myAnswer?.confidence ?? 3)}
                        className="w-full rounded-2xl border border-border bg-white px-4 py-3 outline-none ring-brand transition focus:ring-2"
                      >
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                      </select>
                    </label>

                    <SubmitButton
                      pendingLabel={t('submitAnswerPending')}
                      className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong"
                    >
                      {t('submitAnswer')}
                    </SubmitButton>
                  </form>
                ) : (
                  <div className="rounded-3xl border border-border bg-slate-50/80 p-5">
                    <p className="text-sm leading-6 text-slate-600">{t('reviewHint')}</p>
                    {data.myAnswer ? (
                      <p className="mt-3 text-sm font-semibold text-slate-900">
                        {t('yourAnswer')}: {data.myAnswer.selected_option ?? t('blank')}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-600">{t('sessionNotStarted')}</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="surface p-6">
            <h2 className="text-lg font-semibold text-slate-950">{t('structuredReview')}</h2>
            {data.currentQuestion ? (
              <div className="mt-4 space-y-4">
                <p className="text-sm leading-6 text-slate-600">
                  {t('waitingAnswers', { submitted: data.answers.length, total: data.members.length })}
                </p>

                {isLeader && data.currentQuestion.phase === 'answering' ? (
                  <form action={revealAnswerAction} className="space-y-3">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="sessionId" value={params.sessionId} />
                    <input type="hidden" name="questionId" value={data.currentQuestion.id} />
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">{t('correctAnswer')}</span>
                      <select
                        name="correctOption"
                        className="w-full rounded-2xl border border-border bg-white px-4 py-3 outline-none ring-brand transition focus:ring-2"
                        defaultValue="A"
                      >
                        {ANSWER_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <SubmitButton
                      pendingLabel={t('revealAnswerPending')}
                      className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {t('revealAnswer')}
                    </SubmitButton>
                  </form>
                ) : null}

                {data.distribution ? (
                  <div className="rounded-3xl border border-border bg-slate-50/80 p-5">
                    <p className="text-sm font-medium text-slate-500">{t('distribution')}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {[
                        { label: 'A', count: data.distribution.A },
                        { label: 'B', count: data.distribution.B },
                        { label: 'C', count: data.distribution.C },
                        { label: 'D', count: data.distribution.D },
                        { label: 'E', count: data.distribution.E },
                        { label: t('blank'), count: data.distribution.blank },
                      ].map((item) => (
                        <div key={item.label} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 ring-1 ring-border">
                          {t('countLabel', item)}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-600">{t('sessionNotStarted')}</p>
            )}
          </div>

          <div className="surface p-6">
            <h2 className="text-lg font-semibold text-slate-950">{data.group.name}</h2>
            <div className="mt-4 space-y-3">
              {data.members.map((member) => (
                <div key={member.user_id} className="rounded-2xl border border-border bg-slate-50/80 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    {member.profile?.display_name ?? member.profile?.email ?? member.user_id}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {member.role === 'admin' ? t('captainLabel') : t('memberLabel')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
