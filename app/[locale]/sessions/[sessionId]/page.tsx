import { Check } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { SessionActiveRuntime } from '@/components/session/session-active-runtime';
import { SessionQuitButton } from '@/components/session/session-quit-button';
import { SessionReviewRuntime } from '@/components/session/session-review-runtime';
import { SessionStageRefresh } from '@/components/session/session-stage-refresh';
import { SessionStartRuntime } from '@/components/session/session-start-runtime';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import type { ConfidenceLevel } from '@/lib/demo/confidence';
import { getSessionPageData } from '@/lib/demo/data';

import { advanceSessionStepAction } from './actions';

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

export default async function SessionPage({
  params,
  searchParams,
}: SessionPageProps) {
  const locale = params.locale as AppLocale;
  const user = await requireUser(locale);
  const t = await getTranslations('Session');
  const requestedQuestionIndex =
    typeof searchParams.q === 'string' && searchParams.q.length > 0
      ? Math.max(0, Number(searchParams.q) || 0)
      : undefined;
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
  const currentIndex = Math.max(
    0,
    Math.min(
      data.resolvedQuestionIndex ?? requestedQuestionIndex ?? 0,
      questionGoal - 1,
    ),
  );
  const questions = [...data.questions].sort(
    (left, right) => left.order_index - right.order_index,
  );
  const question =
    questions.find((item) => item.order_index === currentIndex) ??
    questions[currentIndex] ??
    questions[0] ??
    null;
  const answeredCount = data.answeredCount;
  const memberCount = Math.max(data.members.length, 1);
  const shouldShowCompletion =
    searchParams.stage === 'complete' ||
    (data.session.status === 'completed' && searchParams.stage !== 'review') ||
    (data.session.status === 'incomplete' && searchParams.stage !== 'review') ||
    (data.session.status === 'active' &&
      answeredCount >= questionGoal &&
      searchParams.stage !== 'review');
  const isReview = searchParams.stage === 'review';

  if (data.session.status === 'scheduled') {
    const timerLabel =
      data.session.timer_mode === 'global'
        ? `${data.session.timer_seconds}s ${t('globalShort')}`
        : `${data.session.timer_seconds}s ${t('perQuestionShort')}`;

    return (
      <main className="flex flex-1 flex-col">
        <FeedbackBanner
          message={searchParams.feedbackMessage}
          tone={searchParams.feedbackTone}
          feedbackId={searchParams.feedbackId}
        />
        <SessionStartRuntime
          advanceAction={advanceSessionStepAction}
          locale={locale}
          sessionId={params.sessionId}
          sessionTitle={data.session.name ?? data.group.name}
          sessionShareCode={data.session.share_code}
          sessionShareLabel={t('shareCodeLabel', {
            code: data.session.share_code,
          })}
          timerLabel={timerLabel}
          timerMode={data.session.timer_mode}
          timerSeconds={data.session.timer_seconds}
          questionGoal={questionGoal}
          memberCount={memberCount}
          labels={{
            questionsUnit: t('questionsUnit'),
            startSession: t('startSession'),
            startSessionPending: t('startSessionPending'),
            quitSession: t('quitSession'),
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
            allAnswersSubmitted: t('allAnswersSubmitted'),
            questionsCompletedValue: t('questionsCompletedValue', {
              current: questionGoal,
              total: questionGoal,
            }),
            goToReview: t('goToReview'),
            quitPending: t('quitPending'),
          }}
        />
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
          <div className="bg-brand/10 flex h-16 w-16 items-center justify-center rounded-full text-brand">
            <Check className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-8 text-2xl font-extrabold text-white">
            {t('allAnswersSubmitted')}
          </h1>
          <p className="mt-3 text-lg font-medium text-slate-400">
            {t('questionsCompletedValue', {
              current: questionGoal,
              total: questionGoal,
            })}
          </p>
          <Link
            href={`/sessions/${params.sessionId}?stage=review`}
            prefetch={false}
            className="button-primary mt-7 rounded-[7px] px-5 py-2.5 text-sm"
          >
            {t('goToReview')} <span aria-hidden="true">{'>'}</span>
          </Link>
          <div className="mt-4">
            <SessionQuitButton
              locale={locale}
              sessionId={params.sessionId}
              label={t('quitSession')}
              pendingLabel={t('quitPending')}
            />
          </div>
        </section>
      </main>
    );
  }

  if (isReview && question) {
    const reviewQuestion = question as ReviewQuestion;
    const questionAnswers = data.currentQuestionAnswers;
    const reviewedQuestionCount =
      'reviewedQuestionCount' in data &&
      typeof data.reviewedQuestionCount === 'number'
        ? data.reviewedQuestionCount
        : questions.filter((item) => (item as ReviewQuestion).correct_option)
            .length;

    return (
      <>
        <FeedbackBanner
          message={searchParams.feedbackMessage}
          tone={searchParams.feedbackTone}
          feedbackId={searchParams.feedbackId}
        />
        <SessionReviewRuntime
          locale={locale}
          sessionId={params.sessionId}
          sessionTitle={data.session.name ?? data.group.name}
          userId={user.id}
          questionGoal={questionGoal}
          memberCount={data.members.length}
          initialQuestionIndex={currentIndex}
          initialReviewedQuestionCount={reviewedQuestionCount}
          initialQuestion={reviewQuestion}
          initialAnswers={questionAnswers}
          labels={{
            reviewShort: t('reviewShort'),
            previous: t('previous'),
            next: t('next'),
            questionUpper: t('questionUpper'),
            distribution: t('distribution'),
            finishSession: t('finishSession'),
            finishSessionPending: t('finishSessionPending'),
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
      </>
    );
  }

  if (!question) {
    return (
      <main className="flex flex-1 flex-col">
        <SessionStageRefresh
          sessionId={params.sessionId}
          expectedStatus={data.session.status}
          expectedQuestionId={null}
        />
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

  const myAnswer =
    data.currentQuestionAnswers.find((answer) => answer.user_id === user.id) ??
    null;
  const questionAnswers = data.currentQuestionAnswers;
  const isQuestionExpired =
    Boolean(question.answer_deadline_at) &&
    new Date(question.answer_deadline_at ?? '').getTime() <= Date.now();
  const submittedCount = isQuestionExpired
    ? memberCount
    : questionAnswers.length;

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
        timerMode={data.session.timer_mode}
        timerSeconds={data.session.timer_seconds}
        startedAt={data.session.started_at}
        initialAnswer={myAnswer?.selected_option}
        initialConfidence={
          myAnswer?.confidence as ConfidenceLevel | null | undefined
        }
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
          allAnswersSubmitted: t('allAnswersSubmitted'),
          questionsCompletedValue: t('questionsCompletedValue', {
            current: questionGoal,
            total: questionGoal,
          }),
          goToReview: t('goToReview'),
          quitSession: t('quitSession'),
          quitPending: t('quitPending'),
        }}
      />
    </main>
  );
}
