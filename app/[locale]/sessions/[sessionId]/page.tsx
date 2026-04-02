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

import {
  endSessionAction,
  launchQuestionAction,
  passLeaderAction,
  revealAnswerAction,
  startSessionAction,
  submitAnswerAction,
} from './actions';

type SessionPageProps = {
  params: { locale: string; sessionId: string };
  searchParams: {
    feedbackMessage?: string;
    feedbackTone?: string;
  };
};

function getConfidenceTone(
  confidence: number | null | undefined,
  t: (key: 'confidenceLow' | 'confidenceMedium' | 'confidenceHigh' | 'blank') => string,
) {
  if (confidence === 1) return t('confidenceLow');
  if (confidence === 2) return t('confidenceMedium');
  if (typeof confidence === 'number' && confidence >= 3) return t('confidenceHigh');
  return t('blank');
}

export default async function SessionPage({ params, searchParams }: SessionPageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('Session');
  const data = await getSessionData(params.sessionId, user);

  if (!data?.session || !data.group) {
    notFound();
  }

  const isLeader = data.session.leader_id === user.id || data.membership.role === 'admin';
  const isSessionActive = data.session.status === 'active';
  const isSessionCompleted = data.session.status === 'completed';
  const canStartSession = data.members.length >= 3;
  const questionCount = data.questions.length;
  const timeRemaining =
    data.session.timer_mode === 'global'
      ? data.session.started_at
        ? Math.max(
            0,
            Math.floor(
              (new Date(data.session.started_at).getTime() + data.session.timer_seconds * 1000 - Date.now()) / 1000,
            ),
          )
        : data.session.timer_seconds
      : data.currentQuestion?.answer_deadline_at && data.currentQuestion.phase === 'answering'
        ? Math.max(0, Math.floor((new Date(data.currentQuestion.answer_deadline_at).getTime() - Date.now()) / 1000))
        : 0;
  const timerModeLabel = data.session.timer_mode === 'global' ? t('globalShort') : t('perQuestionShort');

  if (data.session.status === 'scheduled') {
    return (
      <main className="flex flex-1 flex-col gap-6">
        <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />
        <section className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
            <SessionAutoRefresh enabled={false} />
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand/10">
              <div className="ml-1 h-0 w-0 border-y-[16px] border-y-transparent border-l-[24px] border-l-brand" />
            </div>
            <h1 className="mt-8 text-5xl font-extrabold tracking-tight text-white">{data.session.name ?? data.group.name}</h1>
            <p className="mt-4 text-2xl text-slate-300">
              {questionCount} {t('questionsUnit')} | {data.session.timer_seconds}s {timerModeLabel}
            </p>
            <p className="mt-3 text-lg text-slate-500">{t('shareCodeLabel', { code: data.session.share_code })}</p>

            {data.session.meeting_link ? (
              <a
                href={data.session.meeting_link}
                target="_blank"
                rel="noreferrer"
                className="mt-4 text-sm font-semibold text-slate-400 transition hover:text-white"
              >
                {t('joinCall')}
              </a>
            ) : null}

            {isLeader ? (
              <form action={startSessionAction} className="mt-8">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="sessionId" value={params.sessionId} />
                <SubmitButton
                  pendingLabel={t('startSessionPending')}
                  className="button-primary min-w-[180px]"
                  disabled={!canStartSession}
                >
                  {t('startSession')}
                </SubmitButton>
              </form>
            ) : null}

            <Link href={`/groups/${data.group.id}`} className="button-ghost mt-3">
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M15 6l-6 6l6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
              </svg>
              {t('leaveSession')}
            </Link>

            <p className="mt-5 text-sm text-slate-500">{t('minimumMembersHint', { count: data.members.length })}</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6">
      <SessionAutoRefresh enabled={data.session.status === 'active'} />
      <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <section className="surface p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Link href={`/groups/${data.group.id}`} className="button-ghost -ml-4 justify-start px-4">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path d="M15 6l-6 6l6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                  </svg>
                  {data.session.name ?? data.group.name}
                </Link>
                <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white">{t('title')}</h1>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                    new Date(data.session.scheduled_at),
                  )}
                </p>
              </div>
              <div className="space-y-2 text-left sm:text-right">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
                  {isSessionCompleted ? t('statusCompleted') : t('statusActive')}
                </p>
                <p className="text-xl font-bold text-white">{data.session.timer_seconds}s</p>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {timerModeLabel} | {t('shareCodeLabel', { code: data.session.share_code })}
                </p>
              </div>
            </div>

            {data.currentQuestion ? (
              <div className="mt-6 rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {t('questionNumber', { number: data.currentQuestion.order_index + 1 })}
                </p>
                <p className="mt-3 text-lg leading-8 text-white">
                  {data.currentQuestion.body ?? t('questionWithoutPrompt')}
                </p>
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                <p className="text-sm leading-7 text-slate-400">{t('sessionNotStarted')}</p>
              </div>
            )}
          </section>

          <section className="surface p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">{t('participantPanel')}</h2>
              <div className="rounded-full bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-300">
                <SessionCountdown initialSeconds={timeRemaining} />
              </div>
            </div>

            {isSessionCompleted ? (
              <div className="mt-6 space-y-4">
                <p className="text-sm leading-7 text-slate-400">{t('sessionCompletedHint')}</p>
                <Link href={`/sessions/${params.sessionId}/summary`} className="button-primary">
                  {t('viewSummary')}
                </Link>
              </div>
            ) : data.currentQuestion && data.currentQuestion.phase === 'answering' ? (
              <form action={submitAnswerAction} className="mt-6 space-y-6">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="sessionId" value={params.sessionId} />
                <input type="hidden" name="questionId" value={data.currentQuestion.id} />

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {ANSWER_OPTIONS.map((option) => (
                    <label
                      key={option}
                      className="cursor-pointer rounded-[18px] border border-border bg-white/[0.04] px-4 py-5 text-center text-lg font-bold text-slate-200 transition hover:border-brand hover:bg-brand/10 has-[:checked]:border-brand has-[:checked]:bg-brand/12 has-[:checked]:text-white has-[:checked]:ring-2 has-[:checked]:ring-brand/25"
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

                <div>
                  <span className="mb-3 block text-sm font-medium text-slate-300">{t('yourConfidence')}</span>
                  <div className="grid grid-cols-3 gap-2 rounded-[18px] border border-border bg-white/[0.03] p-1">
                    {[
                      { value: '1', label: t('confidenceLow') },
                      { value: '2', label: t('confidenceMedium') },
                      { value: '3', label: t('confidenceHigh') },
                    ].map((item) => (
                      <label
                        key={item.value}
                        className="cursor-pointer rounded-[14px] px-3 py-3 text-center text-sm font-semibold text-slate-300 transition hover:bg-white/[0.04] has-[:checked]:bg-brand has-[:checked]:text-slate-950"
                      >
                        <input
                          type="radio"
                          name="confidence"
                          value={item.value}
                          defaultChecked={String(data.myAnswer?.confidence ?? '') === item.value}
                          className="sr-only"
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{t('confidenceHint')}</p>
                </div>

                <SubmitButton pendingLabel={t('submitAnswerPending')} className="button-primary w-full">
                  {t('submitAnswer')}
                </SubmitButton>
              </form>
            ) : (
              <div className="mt-6 rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                <p className="text-sm leading-7 text-slate-400">{t('reviewHint')}</p>
                {data.myAnswer ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[18px] bg-white/[0.04] px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('yourAnswer')}</p>
                      <p className="mt-2 text-base font-semibold text-white">
                        {data.myAnswer.selected_option ?? t('blank')}
                      </p>
                    </div>
                    <div className="rounded-[18px] bg-white/[0.04] px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('yourConfidence')}</p>
                      <p className="mt-2 text-base font-semibold text-white">
                        {getConfidenceTone(data.myAnswer.confidence, t)}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {isLeader && isSessionActive ? (
            <section className="surface p-6 sm:p-8">
              <h2 className="text-xl font-bold text-white">{t('captainPanel')}</h2>
              <form action={launchQuestionAction} className="mt-5 space-y-4">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="sessionId" value={params.sessionId} />
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">{t('questionBody')}</span>
                  <textarea
                    name="questionBody"
                    rows={5}
                    placeholder={t('questionPlaceholder')}
                    className="field resize-none"
                  />
                </label>
                <SubmitButton pendingLabel={t('launchQuestionPending')} className="button-primary w-full">
                  {t('launchQuestion')}
                </SubmitButton>
              </form>

              <div className="mt-5 grid gap-3">
                <form action={passLeaderAction} className="grid gap-3">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="sessionId" value={params.sessionId} />
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-300">{t('passLeader')}</span>
                    <select
                      name="nextLeaderId"
                      className="field"
                      defaultValue={data.members.find((member) => member.user_id !== user.id)?.user_id ?? user.id}
                    >
                      {data.members.map((member) => (
                        <option key={member.user_id} value={member.user_id}>
                          {member.profile?.display_name ?? member.profile?.email ?? member.user_id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <SubmitButton pendingLabel={t('passLeaderPending')} className="button-secondary w-full">
                    {t('passLeader')}
                  </SubmitButton>
                </form>

                <form action={endSessionAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="sessionId" value={params.sessionId} />
                  <SubmitButton
                    pendingLabel={t('endSessionPending')}
                    className="w-full rounded-[16px] border border-rose-500/20 bg-rose-500/10 px-5 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/15"
                  >
                    {t('endSession')}
                  </SubmitButton>
                </form>
              </div>
            </section>
          ) : null}

          <section className="surface p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white">{t('structuredReview')}</h2>

            {data.currentQuestion ? (
              <div className="mt-5 space-y-5">
                <p className="text-sm leading-7 text-slate-400">
                  {t('waitingAnswers', { submitted: data.answers.length, total: data.members.length })}
                </p>

                {isLeader && isSessionActive && data.currentQuestion.phase === 'answering' ? (
                  <form action={revealAnswerAction} className="space-y-3">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="sessionId" value={params.sessionId} />
                    <input type="hidden" name="questionId" value={data.currentQuestion.id} />
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-300">{t('correctAnswer')}</span>
                      <select name="correctOption" className="field" defaultValue="A">
                        {ANSWER_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <SubmitButton pendingLabel={t('revealAnswerPending')} className="button-secondary w-full">
                      {t('revealAnswer')}
                    </SubmitButton>
                  </form>
                ) : null}

                {data.distribution ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { label: 'A', count: data.distribution.A },
                      { label: 'B', count: data.distribution.B },
                      { label: 'C', count: data.distribution.C },
                      { label: 'D', count: data.distribution.D },
                      { label: 'E', count: data.distribution.E },
                      { label: t('blank'), count: data.distribution.blank },
                    ].map((item) => (
                      <div key={item.label} className="rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                        <p className="mt-2 text-lg font-bold text-white">{item.count}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-5 text-sm leading-7 text-slate-400">{t('sessionNotStarted')}</p>
            )}
          </section>

          <section className="surface p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white">{data.session.name ?? data.group.name}</h2>
            <div className="mt-4 space-y-3">
              {data.members.map((member) => (
                <div key={member.user_id} className="rounded-[18px] bg-white/[0.04] px-4 py-4">
                  <p className="text-sm font-semibold text-white">
                    {member.profile?.display_name ?? member.profile?.email ?? member.user_id}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {member.role === 'admin' ? t('captainLabel') : t('memberLabel')}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
