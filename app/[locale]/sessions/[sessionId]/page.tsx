import { ArrowLeft, BarChart3, Check, Play } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { SessionActiveRuntime } from '@/components/session/session-active-runtime';
import { ReviewAnswerForm } from '@/components/session/session-flow-client';
import { SessionStageRefresh } from '@/components/session/session-stage-refresh';
import { SubmitButton } from '@/components/ui/submit-button';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import type { ConfidenceLevel } from '@/lib/demo/confidence';
import { getSessionPageData } from '@/lib/demo/data';
import { ANSWER_OPTIONS } from '@/lib/types/demo';

import {
  advanceSessionStepAction,
  finishReviewSessionAction,
  initializeSessionFlowAction,
  quitIncompleteSessionAction,
} from './actions';

type SessionPageProps = {
  params: { locale: string; sessionId: string };
  searchParams: {
    feedbackMessage?: string;
    feedbackTone?: string;
    feedbackId?: string;
    q?: string;
    stage?: string;
  };
};

type ReviewQuestion = {
  id: string;
  body: string | null;
  options: unknown;
  order_index: number;
  phase: string | null;
  launched_at: string | null;
  answer_deadline_at: string | null;
  correct_option?: string | null;
};

function getDistribution(answers: Array<{ selected_option: string | null; confidence: string | null }>, memberCount: number) {
  const distribution = new Map<string, number>();
  for (const option of [...ANSWER_OPTIONS, '?']) {
    distribution.set(option, 0);
  }

  for (const answer of answers) {
    const option = (answer.selected_option ?? '?').toUpperCase();
    const normalizedOption = ANSWER_OPTIONS.includes(option as (typeof ANSWER_OPTIONS)[number]) ? option : '?';
    distribution.set(normalizedOption, (distribution.get(normalizedOption) ?? 0) + 1);
  }

  const submitted = answers.length;
  distribution.set('?', Math.max(distribution.get('?') ?? 0, Math.max(0, memberCount - submitted)));
  return distribution;
}

export default async function SessionPage({ params, searchParams }: SessionPageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('Session');
  const requestedQuestionIndex =
    typeof searchParams.q === 'string' && searchParams.q.length > 0 ? Math.max(0, Number(searchParams.q) || 0) : undefined;
  const data = await getSessionPageData(
    params.sessionId,
    user,
    searchParams.stage,
    requestedQuestionIndex,
  );

  if (!data?.session || !data.group) {
    notFound();
  }

  const questionGoal = data.questionGoal;
  const currentIndex = Math.max(0, Math.min(data.resolvedQuestionIndex ?? requestedQuestionIndex ?? 0, questionGoal - 1));
  const questions = [...data.questions].sort((left, right) => left.order_index - right.order_index);
  const question = questions.find((item) => item.order_index === currentIndex) ?? questions[currentIndex] ?? questions[0] ?? null;
  const answeredCount = data.answeredCount;
  const memberCount = Math.max(data.members.length, 1);
  const shouldShowCompletion =
    searchParams.stage === 'complete' ||
    (data.session.status === 'completed' && searchParams.stage !== 'review') ||
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
        <SessionStageRefresh sessionId={params.sessionId} expectedStatus="scheduled" />
        <FeedbackBanner
          message={searchParams.feedbackMessage}
          tone={searchParams.feedbackTone}
          feedbackId={searchParams.feedbackId}
        />
        <section className="flex w-full max-w-md flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Play className="ml-1 h-8 w-8" aria-hidden="true" />
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
              <span className="mr-2" aria-hidden="true">{'>'}</span>
              {t('startSession')}
            </SubmitButton>
          </form>
          <Link href={`/groups/${data.group.id}`} prefetch={false} className="button-ghost mt-4 px-4 py-2 text-sm text-slate-500">
            {t('quitSession')}
          </Link>
        </section>
      </main>
    );
  }

  if (shouldShowCompletion) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <FeedbackBanner
          message={searchParams.feedbackMessage}
          tone={searchParams.feedbackTone}
          feedbackId={searchParams.feedbackId}
        />
        <section className="flex w-full max-w-md flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Check className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-8 text-2xl font-extrabold text-white">{t('allAnswersSubmitted')}</h1>
          <p className="mt-3 text-lg font-medium text-slate-400">{t('questionsCompletedValue', { current: questionGoal, total: questionGoal })}</p>
          <Link href={`/sessions/${params.sessionId}?stage=review`} prefetch={false} className="button-primary mt-7 rounded-[7px] px-5 py-2.5 text-sm">
            {t('goToReview')} <span aria-hidden="true">{'>'}</span>
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
    const reviewQuestion = question as ReviewQuestion;
    const questionAnswers = data.currentQuestionAnswers;
    const distribution = getDistribution(questionAnswers, data.members.length);
    const myReviewAnswer = questionAnswers.find((answer) => answer.user_id === user.id) ?? null;
    const canFinish = questions.filter((item) => (item as ReviewQuestion).correct_option).length >= questionGoal;
    const isLastQuestion = currentIndex >= questionGoal - 1;
    const isFirstQuestion = currentIndex <= 0;
    const previousQuestionHref = `/sessions/${params.sessionId}?stage=review&q=${Math.max(0, currentIndex - 1)}`;
    const nextQuestionHref = `/sessions/${params.sessionId}?stage=review&q=${Math.min(questionGoal - 1, currentIndex + 1)}`;

    return (
      <main className="flex flex-1 flex-col">
        <FeedbackBanner
          message={searchParams.feedbackMessage}
          tone={searchParams.feedbackTone}
          feedbackId={searchParams.feedbackId}
        />
        <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-background/95 backdrop-blur">
          <div className="mx-auto flex min-h-16 w-full max-w-[700px] items-center gap-3 px-4 py-3 sm:grid sm:grid-cols-[40px_minmax(0,1fr)_40px] sm:py-0">
            <Link href="/dashboard?view=sessions" prefetch={false} className="inline-flex h-10 w-10 items-center justify-start text-slate-500 hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
            <div className="min-w-0 flex-1 sm:hidden">
              <p className="truncate text-sm font-semibold text-white">{data.session.name ?? data.group.name}</p>
              <p className="text-xs font-medium text-slate-500">{t('reviewShort')}</p>
            </div>
            <p className="hidden min-w-0 flex-1 text-center text-base font-extrabold text-white sm:block sm:text-lg">
              {data.session.name ?? data.group.name} - {t('reviewShort')}
            </p>
            <span aria-hidden="true" className="hidden sm:block" />
          </div>
        </header>

        <section className="mx-auto w-full max-w-[700px] space-y-6 px-4 py-7">
          <div className="flex items-center justify-between text-sm font-bold text-slate-500">
            {isFirstQuestion ? (
              <span className="opacity-40">
                {'<'} {t('previous')}
              </span>
            ) : (
              <Link href={previousQuestionHref} prefetch={false} className="hover:text-white">
                {'<'} {t('previous')}
              </Link>
            )}
            <h1 className="text-lg font-semibold text-white sm:text-2xl sm:font-extrabold">
              <span className="sm:hidden">{currentIndex + 1}/{questionGoal}</span>
              <span className="hidden sm:inline">{t('questionNumber', { number: currentIndex + 1 })}</span>
            </h1>
            {isLastQuestion ? (
              <span className="opacity-40">
                {t('next')} {'>'}
              </span>
            ) : (
              <Link href={nextQuestionHref} prefetch={false} className="hover:text-white">
                {t('next')} {'>'}
              </Link>
            )}
          </div>

          <section className="surface-mockup p-5">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-brand" aria-hidden="true" />
              <h2 className="text-sm font-extrabold text-white">{t('distribution')}</h2>
            </div>
            <div className="mt-3 grid grid-cols-6 gap-1.5 sm:hidden">
              {[...ANSWER_OPTIONS, '?'].map((option) => (
                <div
                  key={option}
                  className={`inline-flex min-h-9 items-center justify-center rounded-[7px] border px-1 text-center text-[11px] font-semibold ${
                    reviewQuestion.correct_option === option
                      ? 'border-brand/35 bg-brand/10 text-brand'
                      : 'border-white/[0.08] bg-[#121b2e] text-slate-400'
                  }`}
                >
                  {option}-{distribution.get(option) ?? 0}
                </div>
              ))}
            </div>
            <div className="mt-8 hidden grid-cols-3 gap-x-2 gap-y-4 min-[420px]:grid-cols-6 sm:grid">
              {[...ANSWER_OPTIONS, '?'].map((option) => (
                <div key={option} className="flex w-full flex-col items-center gap-1 text-center">
                  <span className={reviewQuestion.correct_option === option ? 'text-sm font-extrabold text-brand' : 'text-sm font-bold text-slate-500'}>
                    {option}
                    {reviewQuestion.correct_option === option ? ' *' : ''}
                  </span>
                  <span className="text-xs font-bold text-slate-600">{distribution.get(option) ?? 0}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-white/[0.06] pt-5">
              <ReviewAnswerForm
                key={question.id}
                locale={locale}
                sessionId={params.sessionId}
                questionId={question.id}
                questionIndex={currentIndex}
                nextQuestionIndex={Math.min(questionGoal - 1, currentIndex + 1)}
                isLastQuestion={isLastQuestion}
                initialCorrectOption={reviewQuestion.correct_option as never}
                participantAnswer={myReviewAnswer?.selected_option}
                participantConfidence={myReviewAnswer?.confidence as ConfidenceLevel | null | undefined}
                labels={{
                  correctAnswer: t('correctAnswer'),
                  save: t('saveReview'),
                  update: t('updateReview'),
                  saveAndNext: t('saveAndNextReview'),
                  updateAndNext: t('updateAndNextReview'),
                  savePending: t('saveReviewPending'),
                  reviewStatus: {
                    clearMastery: t('reviewStatus.clearMastery'),
                    overconfidence: t('reviewStatus.overconfidence'),
                    goodProgress: t('reviewStatus.goodProgress'),
                    precisionToImprove: t('reviewStatus.precisionToImprove'),
                    confidenceToBuild: t('reviewStatus.confidenceToBuild'),
                    foundationToBuild: t('reviewStatus.foundationToBuild'),
                  },
                }}
              />
            </div>
          </section>

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
        <SessionStageRefresh sessionId={params.sessionId} expectedStatus={data.session.status} expectedQuestionId={null} />
        <FeedbackBanner
          message={searchParams.feedbackMessage}
          tone={searchParams.feedbackTone}
          feedbackId={searchParams.feedbackId}
        />
        <section className="flex flex-1 items-center justify-center px-4 text-center text-sm font-bold text-slate-500">
          {t('loadingSession')}
        </section>
      </main>
    );
  }

  const myAnswer = data.currentQuestionAnswers.find((answer) => answer.user_id === user.id) ?? null;
  const questionAnswers = data.currentQuestionAnswers;
  const isQuestionExpired =
    Boolean(question.answer_deadline_at) && new Date(question.answer_deadline_at ?? '').getTime() <= Date.now();
  const submittedCount = isQuestionExpired ? memberCount : questionAnswers.length;

  return (
    <main className="flex flex-1 flex-col">
      <FeedbackBanner
        message={searchParams.feedbackMessage}
        tone={searchParams.feedbackTone}
        feedbackId={searchParams.feedbackId}
      />
      <SessionActiveRuntime
        key={question.id}
        advanceAction={advanceSessionStepAction}
        locale={locale}
        sessionId={params.sessionId}
        sessionShareCode={data.session.share_code}
        questionId={question.id}
        questionIndex={currentIndex}
        questionGoal={questionGoal}
        initialAnswer={myAnswer?.selected_option}
        initialConfidence={myAnswer?.confidence as ConfidenceLevel | null | undefined}
        initialSubmittedCount={submittedCount}
        initialMemberCount={memberCount}
        initialAnswerDeadlineAt={question.answer_deadline_at}
        labels={{
          questionUpper: t('questionUpper'),
          confidenceTitle: t('confidenceLevel'),
          confidenceLow: t('confidenceLow'),
          confidenceMedium: t('confidenceMedium'),
          confidenceHigh: t('confidenceHigh'),
          customOptionLabel: t('customOptionLabel'),
          customOptionPlaceholder: t('customOptionPlaceholder'),
          submit: t('submitAnswer'),
          submitPending: t('submitAnswerPending'),
          nextQuestion: t('nextQuestion'),
          nextQuestionPending: t('nextQuestionPending'),
          allAnswersReceived: t('allAnswersSubmitted'),
        }}
      />
    </main>
  );
}
