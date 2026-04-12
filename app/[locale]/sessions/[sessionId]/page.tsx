import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { ReviewAnswerForm, SessionAnswerForm, SessionHeaderMeta } from '@/components/session/session-flow-client';
import { SubmitButton } from '@/components/ui/submit-button';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { getSessionData } from '@/lib/demo/data';
import { ANSWER_OPTIONS, ERROR_TYPE_OPTIONS } from '@/lib/types/demo';

import {
  finishReviewSessionAction,
  initializeSessionFlowAction,
  advanceSessionStepAction,
  quitIncompleteSessionAction,
  saveCaptainFrequentErrorAction,
  saveReviewAnswerAction,
  submitSessionStepAction,
  timeoutSessionStepAction,
} from './actions';

type SessionPageProps = {
  params: { locale: string; sessionId: string };
  searchParams: {
    feedbackMessage?: string;
    feedbackTone?: string;
    q?: string;
    stage?: string;
  };
};

function getDistribution(answers: Array<{ selected_option: string | null; confidence: string | null }>, memberCount: number) {
  const distribution = new Map<string, number>();
  for (const option of [...ANSWER_OPTIONS, '?']) {
    distribution.set(option, 0);
  }

  for (const answer of answers) {
    const option = answer.selected_option ?? '?';
    distribution.set(option, (distribution.get(option) ?? 0) + 1);
  }

  const submitted = answers.length;
  distribution.set('?', Math.max(distribution.get('?') ?? 0, Math.max(0, memberCount - submitted)));
  return distribution;
}

function getStabilityLabel(correctOption: string | null, distribution: Map<string, number>, t: (key: string) => string) {
  if (!correctOption) return t('stabilityUnstable');
  const correctCount = distribution.get(correctOption) ?? 0;
  const maxCount = Math.max(...Array.from(distribution.values()));
  return correctCount > 0 && correctCount === maxCount ? t('stabilityAlmostSolid') : t('stabilityUnstable');
}

export default async function SessionPage({ params, searchParams }: SessionPageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('Session');
  const data = await getSessionData(params.sessionId, user);

  if (!data?.session || !data.group) {
    notFound();
  }

  const questionGoal = data.session.question_goal ?? Math.max(data.questions.length, 10);
  const currentIndex = Math.max(0, Math.min(Number(searchParams.q ?? 0) || 0, questionGoal - 1));
  const questions = [...data.questions].sort((left, right) => left.order_index - right.order_index);
  const question = questions.find((item) => item.order_index === currentIndex) ?? questions[currentIndex] ?? questions[0] ?? null;
  const myAnswers = data.allAnswers.filter((answer) => answer.user_id === user.id);
  const answeredCount = new Set(myAnswers.map((answer) => answer.question_id)).size;
  const memberCount = Math.max(data.members.length, 1);
  const shouldShowCompletion =
    searchParams.stage === 'complete' ||
    (data.session.status === 'incomplete' && searchParams.stage !== 'review') ||
    (data.session.status === 'active' && answeredCount >= questionGoal && searchParams.stage !== 'review');
  const isReview = searchParams.stage === 'review';

  if (data.session.status === 'scheduled') {
    const timerLabel =
      data.session.timer_mode === 'global'
        ? `${data.session.timer_seconds}s ${t('globalShort')}`
        : `${data.session.timer_seconds}s ${t('perQuestionShort')}`;

    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />
        <section className="flex w-full max-w-md flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
            <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8" aria-hidden="true">
              <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
          </div>
          <h1 className="mt-8 text-2xl font-extrabold text-white">{data.session.name ?? data.group.name}</h1>
          <p className="mt-3 text-lg font-medium text-slate-400">
            {questionGoal} {t('questionsUnit')} | {timerLabel}
          </p>
          <p className="mt-4 text-sm font-bold text-slate-500">
            {t('shareCodeLabel', { code: data.session.share_code })}
          </p>
          <form action={initializeSessionFlowAction} className="mt-7">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="sessionId" value={params.sessionId} />
            <SubmitButton pendingLabel={t('startSessionPending')} className="button-primary rounded-[7px] px-5 py-2.5 text-sm">
              <span className="mr-2" aria-hidden="true">▷</span>
              {t('startSession')}
            </SubmitButton>
          </form>
          <Link href="/dashboard?view=sessions" className="button-ghost mt-4 px-4 py-2 text-sm text-slate-500">
            {t('quitSession')}
          </Link>
        </section>
      </main>
    );
  }

  if (shouldShowCompletion) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />
        <section className="flex w-full max-w-md flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
            <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
              <path d="M7 12.5 10.5 16 17 8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </div>
          <h1 className="mt-8 text-2xl font-extrabold text-white">{t('allAnswersSubmitted')}</h1>
          <p className="mt-3 text-lg font-medium text-slate-400">{t('questionsCompletedValue', { current: questionGoal, total: questionGoal })}</p>
          <Link href={`/sessions/${params.sessionId}?stage=review&q=0`} className="button-primary mt-7 rounded-[7px] px-5 py-2.5 text-sm">
            {t('goToReview')} <span aria-hidden="true">›</span>
          </Link>
          <form action={quitIncompleteSessionAction} className="mt-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="sessionId" value={params.sessionId} />
            <SubmitButton pendingLabel={t('quitPending')} className="button-ghost px-4 py-2 text-sm text-slate-500">
              {t('quitSession')}
            </SubmitButton>
          </form>
        </section>
      </main>
    );
  }

  if (isReview && question) {
    const questionAnswers = data.allAnswers.filter((answer) => answer.question_id === question.id);
    const distribution = getDistribution(questionAnswers, data.members.length);
    const stabilityLabel = getStabilityLabel(question.correct_option, distribution, t);
    const classification = data.allClassifications.find((item) => item.question_id === question.id) ?? null;
    const canFinish = questions.filter((item) => item.correct_option).length >= questionGoal;
    const isLeader = data.session.leader_id === user.id || data.membership.is_founder;

    return (
      <main className="flex flex-1 flex-col">
        <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />
        <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-[700px] items-center justify-between px-4">
            <Link href="/dashboard?view=sessions" className="text-sm font-bold text-slate-500 hover:text-white">
              ← Dashboard
            </Link>
            <p className="text-lg font-extrabold text-white">{data.session.name ?? data.group.name} — {t('reviewShort')}</p>
            <p className="text-sm font-bold text-slate-500">Q{currentIndex + 1}/{questionGoal}</p>
          </div>
        </header>

        <section className="mx-auto w-full max-w-[700px] space-y-6 px-4 py-7">
          <div className="flex items-center justify-between text-sm font-bold text-slate-500">
            <Link href={`/sessions/${params.sessionId}?stage=review&q=${Math.max(0, currentIndex - 1)}`} className="hover:text-white">
              ‹ {t('previous')}
            </Link>
            <h1 className="text-2xl font-extrabold text-white">{t('questionNumber', { number: currentIndex + 1 })}</h1>
            <Link href={`/sessions/${params.sessionId}?stage=review&q=${Math.min(questionGoal - 1, currentIndex + 1)}`} className="hover:text-white">
              {t('next')} ›
            </Link>
          </div>

          <section className="surface-mockup p-5">
            <div className="flex items-center gap-2">
              <span className="text-brand">▥</span>
              <h2 className="text-sm font-extrabold text-white">{t('distribution')}</h2>
            </div>
            <div className="mt-8 flex items-end justify-center gap-8">
              {[...ANSWER_OPTIONS, '?'].map((option) => (
                <div key={option} className="flex min-w-7 flex-col items-center gap-1 text-center">
                  <span className={question.correct_option === option ? 'text-sm font-extrabold text-brand' : 'text-sm font-bold text-slate-500'}>
                    {option}{question.correct_option === option ? ' ✓' : ''}
                  </span>
                  <span className="text-xs font-bold text-slate-600">{distribution.get(option) ?? 0}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-white/[0.06] pt-5">
              <ReviewAnswerForm
                action={saveReviewAnswerAction}
                locale={locale}
                sessionId={params.sessionId}
                questionId={question.id}
                questionIndex={currentIndex}
                initialCorrectOption={question.correct_option as never}
                labels={{
                  correctAnswer: t('correctAnswer'),
                  save: t('saveReview'),
                  update: t('updateReview'),
                  savePending: t('saveReviewPending'),
                }}
              />
            </div>
          </section>

          <details className="surface-mockup p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-extrabold text-slate-400">
              <span><span className="mr-2 inline-block h-3 w-3 rounded-full bg-orange-400" />{stabilityLabel}</span>
              <span className="text-slate-600">ⓘ</span>
            </summary>
            <div className="mt-4 rounded-[8px] border border-white/[0.10] p-4 text-sm text-slate-400">
              <p className="font-bold text-white">{t('pointLegendTitle')}</p>
              <p className="mt-3"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-brand" />{t('legendHighCorrect')}</p>
              <p className="mt-2"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-red-400" />{t('legendHighWrong')}</p>
              <p className="mt-2"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-yellow-400" />{t('legendMediumCorrect')}</p>
              <p className="mt-2"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-orange-400" />{t('legendMediumWrong')}</p>
              <p className="mt-2"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-sky-400" />{t('legendLowCorrect')}</p>
              <p className="mt-2"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-slate-500" />{t('legendLowWrong')}</p>
            </div>
          </details>

          {isLeader ? (
            <section className="surface-mockup p-5">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-xs font-extrabold text-slate-950">C</span>
                <h2 className="text-sm font-extrabold text-white">{t('captainOnly')}</h2>
              </div>
              <form action={saveCaptainFrequentErrorAction} className="mt-6 space-y-4">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="sessionId" value={params.sessionId} />
                <input type="hidden" name="questionId" value={question.id} />
                <input type="hidden" name="questionIndex" value={currentIndex} />
                <label className="block">
                  <span className="text-sm font-bold text-slate-300">{t('frequentErrorType')}</span>
                  <select
                    name="frequentErrorType"
                    className="field mt-2 h-10 rounded-[7px] px-3 py-2 text-sm"
                    defaultValue={classification?.frequent_error_type ?? ''}
                  >
                    <option value="">{t('selectPlaceholder')}</option>
                    {ERROR_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {t(`errorType.${option}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <SubmitButton pendingLabel={t('saveReviewPending')} className="button-primary h-10 w-full rounded-[7px] py-2 text-sm">
                  {classification?.frequent_error_type ? t('updateReview') : t('saveReview')}
                </SubmitButton>
              </form>
            </section>
          ) : null}

          {canFinish ? (
            <form action={finishReviewSessionAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="sessionId" value={params.sessionId} />
              <SubmitButton pendingLabel={t('finishSessionPending')} className="h-10 w-full rounded-[7px] border border-brand bg-transparent text-sm font-extrabold text-brand hover:bg-brand/10">
                {t('finishSession')}
              </SubmitButton>
            </form>
          ) : null}
        </section>
      </main>
    );
  }

  if (!question) {
    return (
      <main className="flex flex-1 flex-col">
        <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />
        <section className="flex flex-1 items-center justify-center px-4 text-center text-sm font-bold text-slate-500">
          {t('loadingSession')}
        </section>
      </main>
    );
  }

  const myAnswer = data.allAnswers.find((answer) => answer.question_id === question.id && answer.user_id === user.id) ?? null;
  const questionAnswers = data.allAnswers.filter((answer) => answer.question_id === question.id);
  const isQuestionExpired =
    Boolean(question.answer_deadline_at) && new Date(question.answer_deadline_at ?? '').getTime() <= Date.now();
  const submittedCount = isQuestionExpired ? memberCount : questionAnswers.length;

  return (
    <main className="flex flex-1 flex-col">
      <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />
      <header className="border-b border-white/[0.07]">
        <div className="mx-auto flex h-16 w-full max-w-[560px] items-center justify-between px-4">
          <Link href="/dashboard?view=sessions" className="text-slate-500 hover:text-white">↩</Link>
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{t('questionUpper')}</p>
            <p className="text-xl font-extrabold text-white">{currentIndex + 1}<span className="text-sm text-slate-500">/{questionGoal}</span></p>
          </div>
          <SessionHeaderMeta
            submittedCount={submittedCount}
            memberCount={memberCount}
            answerDeadlineAt={question.answer_deadline_at}
          />
        </div>
      </header>

      <section className="mx-auto w-full max-w-[560px] px-4 py-7">
        <SessionAnswerForm
          key={question.id}
          action={submitSessionStepAction}
          timeoutAction={timeoutSessionStepAction}
          advanceAction={advanceSessionStepAction}
          locale={locale}
          sessionId={params.sessionId}
          questionId={question.id}
          questionIndex={currentIndex}
          initialAnswer={myAnswer?.selected_option}
          initialConfidence={myAnswer?.confidence}
          answerDeadlineAt={question.answer_deadline_at}
          submittedCount={submittedCount}
          memberCount={memberCount}
          labels={{
            confidenceTitle: t('confidenceLevel'),
            confidenceLow: t('confidenceLow'),
            confidenceMedium: t('confidenceMedium'),
            confidenceHigh: t('confidenceHigh'),
            submit: t('submitAnswer'),
            submitPending: t('submitAnswerPending'),
            nextQuestion: t('nextQuestion'),
            nextQuestionPending: t('nextQuestionPending'),
            allAnswersReceived: t('allAnswersSubmitted'),
          }}
        />
      </section>
    </main>
  );
}
