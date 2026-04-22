import { ArrowLeft, BarChart3, Check, Play } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { RealtimeRefresh } from '@/components/app/realtime-refresh';
import { ReviewAnswerForm, SessionAnswerForm, SessionHeaderMeta } from '@/components/session/session-flow-client';
import { SubmitButton } from '@/components/ui/submit-button';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import { getUserBillingSnapshot, TRIAL_QUESTION_LIMIT } from '@/lib/billing/user-tier';
import type { ConfidenceLevel } from '@/lib/demo/confidence';
import { getSessionData } from '@/lib/demo/data';
import { ANSWER_OPTIONS } from '@/lib/types/demo';

import {
  finishReviewSessionAction,
  initializeSessionFlowAction,
  advanceSessionStepAction,
  quitIncompleteSessionAction,
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

function TrialProgressPanel({
  current,
  total,
  remaining,
  showWarning,
  isComplete,
  labels,
}: {
  current: number;
  total: number;
  remaining: number;
  showWarning: boolean;
  isComplete: boolean;
  labels: {
    title: string;
    summary: string;
    description: string;
    warning: string;
    complete: string;
  };
}) {
  const progressPercentage = Math.min(100, Math.round((current / Math.max(1, total)) * 100));

  return (
    <section className="mx-auto mb-4 w-full max-w-[560px] rounded-[12px] border border-white/[0.06] bg-[#11192c] px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-bold text-white">{labels.title}</p>
        <p className="text-sm font-extrabold text-white">
          {current} / {total}
        </p>
      </div>
      <p className="mt-2 text-sm text-slate-400">{labels.summary.replace('{current}', String(current)).replace('{total}', String(total))}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-brand" style={{ width: `${progressPercentage}%` }} />
      </div>
      <p className={`mt-3 text-sm ${isComplete || showWarning ? 'font-bold text-amber-300' : 'text-slate-500'}`}>
        {isComplete ? labels.complete : showWarning ? labels.warning.replace('{remaining}', String(remaining)) : labels.description.replace('{remaining}', String(remaining))}
      </p>
    </section>
  );
}

export default async function SessionPage({ params, searchParams }: SessionPageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('Session');
  const dashboardT = await getTranslations('Dashboard');
  const [data, billingSnapshot] = await Promise.all([getSessionData(params.sessionId, user), getUserBillingSnapshot(user.id)]);

  if (!data?.session || !data.group) {
    notFound();
  }

  const questionGoal = data.session.question_goal ?? Math.max(data.questions.length, 10);
  const currentIndex = Math.max(0, Math.min(Number(searchParams.q ?? 0) || 0, questionGoal - 1));
  const questions = [...data.questions].sort((left, right) => left.order_index - right.order_index);
  const question = questions.find((item) => item.order_index === currentIndex) ?? questions[currentIndex] ?? questions[0] ?? null;
  const realtimeTables = [
    { table: 'sessions', filter: `id=eq.${params.sessionId}` },
    { table: 'questions', filter: `session_id=eq.${params.sessionId}` },
    ...(question ? [{ table: 'answers', filter: `question_id=eq.${question.id}` }] : []),
    { table: 'question_classifications', filter: `session_id=eq.${params.sessionId}` },
  ];
  const myAnswers = data.allAnswers.filter((answer) => answer.user_id === user.id);
  const answeredCount = new Set(myAnswers.map((answer) => answer.question_id)).size;
  const memberCount = Math.max(data.members.length, 1);
  const trialProgress = {
    current: Math.min(billingSnapshot?.questions_answered ?? 0, TRIAL_QUESTION_LIMIT),
    total: TRIAL_QUESTION_LIMIT,
    remaining: Math.max(TRIAL_QUESTION_LIMIT - (billingSnapshot?.questions_answered ?? 0), 0),
    showWarning: (billingSnapshot?.questions_answered ?? 0) >= 85 && (billingSnapshot?.questions_answered ?? 0) < TRIAL_QUESTION_LIMIT,
    isComplete: (billingSnapshot?.questions_answered ?? 0) >= TRIAL_QUESTION_LIMIT,
  };
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
        <RealtimeRefresh channelName={`session:${params.sessionId}`} tables={realtimeTables} />
        <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />
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
          <Link href={`/groups/${data.group.id}`} className="button-ghost mt-4 px-4 py-2 text-sm text-slate-500">
            {t('quitSession')}
          </Link>
        </section>
      </main>
    );
  }

  if (shouldShowCompletion) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <RealtimeRefresh channelName={`session:${params.sessionId}`} tables={realtimeTables} />
        <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />
        <section className="flex w-full max-w-md flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Check className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-8 text-2xl font-extrabold text-white">{t('allAnswersSubmitted')}</h1>
          <p className="mt-3 text-lg font-medium text-slate-400">{t('questionsCompletedValue', { current: questionGoal, total: questionGoal })}</p>
          <Link href={`/sessions/${params.sessionId}?stage=review&q=0`} className="button-primary mt-7 rounded-[7px] px-5 py-2.5 text-sm">
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
    const questionAnswers = data.allAnswers.filter((answer) => answer.question_id === question.id);
    const distribution = getDistribution(questionAnswers, data.members.length);
    const myReviewAnswer = questionAnswers.find((answer) => answer.user_id === user.id) ?? null;
    const canFinish = questions.filter((item) => item.correct_option).length >= questionGoal;
    const isLastQuestion = currentIndex >= questionGoal - 1;

    return (
      <main className="flex flex-1 flex-col">
        <RealtimeRefresh channelName={`session:${params.sessionId}`} tables={realtimeTables} />
        <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />
        <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-background/95 backdrop-blur">
          <div className="mx-auto flex min-h-16 w-full max-w-[700px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:h-16 sm:flex-nowrap sm:py-0">
            <Link href={`/groups/${data.group.id}`} className="text-sm font-bold text-slate-500 hover:text-white">
              <span className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {data.group.name}
              </span>
            </Link>
            <p className="min-w-0 flex-1 text-center text-base font-extrabold text-white sm:text-lg">{data.session.name ?? data.group.name} - {t('reviewShort')}</p>
            <p className="text-sm font-bold text-slate-500">Q{currentIndex + 1}/{questionGoal}</p>
          </div>
        </header>

        <section className="mx-auto w-full max-w-[700px] space-y-6 px-4 py-7">
          <div className="flex items-center justify-between text-sm font-bold text-slate-500">
            <Link href={`/sessions/${params.sessionId}?stage=review&q=${Math.max(0, currentIndex - 1)}`} className="hover:text-white">
              {'<'} {t('previous')}
            </Link>
            <h1 className="text-2xl font-extrabold text-white">{t('questionNumber', { number: currentIndex + 1 })}</h1>
            <Link href={`/sessions/${params.sessionId}?stage=review&q=${Math.min(questionGoal - 1, currentIndex + 1)}`} className="hover:text-white">
              {t('next')} {'>'}
            </Link>
          </div>

          <section className="surface-mockup p-5">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-brand" aria-hidden="true" />
              <h2 className="text-sm font-extrabold text-white">{t('distribution')}</h2>
            </div>
            <div className="mt-8 flex items-end justify-center gap-8">
              {[...ANSWER_OPTIONS, '?'].map((option) => (
                <div key={option} className="flex min-w-7 flex-col items-center gap-1 text-center">
                  <span className={question.correct_option === option ? 'text-sm font-extrabold text-brand' : 'text-sm font-bold text-slate-500'}>
                    {option}{question.correct_option === option ? ' *' : ''}
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
                nextQuestionIndex={Math.min(questionGoal - 1, currentIndex + 1)}
                isLastQuestion={isLastQuestion}
                initialCorrectOption={question.correct_option as never}
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
        <RealtimeRefresh channelName={`session:${params.sessionId}`} tables={realtimeTables} />
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
      <RealtimeRefresh channelName={`session:${params.sessionId}`} tables={realtimeTables} />
      <FeedbackBanner message={searchParams.feedbackMessage} tone={searchParams.feedbackTone} />
      <TrialProgressPanel
        current={trialProgress.current}
        total={trialProgress.total}
        remaining={trialProgress.remaining}
        showWarning={trialProgress.showWarning}
        isComplete={trialProgress.isComplete}
        labels={{
          title: dashboardT('trialProgressTitle'),
          summary: dashboardT('trialProgressSummary', { current: '{current}', total: '{total}' }),
          description: dashboardT('trialProgressDescription', { remaining: '{remaining}' }),
          warning: dashboardT('trialProgressWarning', { remaining: '{remaining}' }),
          complete: dashboardT('trialProgressComplete'),
        }}
      />
      <header className="border-b border-white/[0.07]">
        <div className="mx-auto flex min-h-16 w-full max-w-[560px] items-center justify-between gap-3 px-4 py-3 sm:h-16 sm:py-0">
          <Link href={`/groups/${data.group.id}`} className="text-slate-500 hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
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
