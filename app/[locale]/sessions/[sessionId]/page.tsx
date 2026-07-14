import { Check } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { FeedbackBanner } from '@/components/app/feedback-banner';
import { SessionActiveRuntime } from '@/components/session/session-active-runtime';
import { SessionAutoStartRuntime } from '@/components/session/session-auto-start-runtime';
import { SessionConfigureRuntime } from '@/components/session/session-configure-runtime';
import { SessionPeerFeedbackRuntime } from '@/components/session/session-peer-feedback-runtime';
import { SessionPlanNextRuntime } from '@/components/session/session-plan-next-runtime';
import { SessionProgressEntryRuntime } from '@/components/session/session-progress-entry-runtime';
import { SessionQuitButton } from '@/components/session/session-quit-button';
import { SessionReviewRuntime } from '@/components/session/session-review-runtime';
import { SessionStageRefresh } from '@/components/session/session-stage-refresh';
import { SessionTabPresence } from '@/components/session/session-tab-channel';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { requireUser } from '@/lib/auth';
import type { ConfidenceLevel } from '@/lib/demo/confidence';
import { getSessionPageData } from '@/lib/demo/data';
import { getAppPolicySettings } from '@/lib/policy/app-policy';
import { getPlanNextAccess } from '@/lib/session/plan-next-access';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import {
  advanceSessionStepAction,
  takeOverStartResponsibilityAction,
} from './actions';

type SessionPageProps = {
  params: { locale: string; sessionId: string };
  searchParams: {
    feedbackMessage?: string;
    feedbackTone?: string;
    feedbackId?: string;
    feedback?: string;
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
  review_version?: number;
};

async function getReviewPeers(groupId: string, currentUserId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: memberships } = await supabase
    .schema('public')
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId);

  const peerIds = [
    ...new Set(
      (memberships ?? [])
        .map((membership) => membership.user_id)
        .filter(
          (memberId): memberId is string =>
            Boolean(memberId) && memberId !== currentUserId,
        ),
    ),
  ];

  if (peerIds.length === 0) {
    return [];
  }

  const [{ data: profiles }, { data: metrics }] = await Promise.all([
    supabase
    .schema('public')
    .from('users')
    .select(
      'id, email, display_name, avatar_url',
    )
    .in('id', peerIds),
    supabase
      .schema('public')
      .from('candidate_matching_profiles')
      .select(
        'user_id, questions_reviewed, sessions_joined, positive_peer_votes, total_peer_votes',
      )
      .in('user_id', peerIds),
  ]);

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const metricsById = new Map(
    (metrics ?? []).map((metric) => [metric.user_id, metric]),
  );

  return peerIds.map((peerId) => {
    const profile = profileById.get(peerId);

    return {
      id: peerId,
      name: profile?.display_name ?? profile?.email ?? 'ActiveBoard',
      email: profile?.email ?? '',
      avatarUrl: profile?.avatar_url ?? null,
      reliabilityScore: computePeerReliabilityScore(metricsById.get(peerId)),
    };
  });
}

function computePeerReliabilityScore(profile: {
  questions_reviewed?: number | null;
  sessions_joined?: number | null;
  positive_peer_votes?: number | null;
  total_peer_votes?: number | null;
} | null | undefined) {
  const reviewedScore = Math.min((profile?.questions_reviewed ?? 0) / 60, 1) * 35;
  const attendanceScore = Math.min((profile?.sessions_joined ?? 0) / 3, 1) * 35;
  const peerScore =
    (profile?.total_peer_votes ?? 0) > 0
      ? ((profile?.positive_peer_votes ?? 0) /
          Math.max(profile?.total_peer_votes ?? 1, 1)) *
        30
      : 0;

  return Math.round(reviewedScore + attendanceScore + peerScore);
}

async function getConfigureGroup(groupId: string) {
  const supabase = createSupabaseAdminClient();
  const [{ data: group }, { data: memberships }] = await Promise.all([
    supabase
      .schema('public')
      .from('groups')
      .select('id, name, max_members')
      .eq('id', groupId)
      .maybeSingle(),
    supabase
      .schema('public')
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId),
  ]);

  const memberIds = [
    ...new Set(
      (memberships ?? [])
        .map((membership) => membership.user_id)
        .filter((memberId): memberId is string => Boolean(memberId)),
    ),
  ];
  const { data: profiles } =
    memberIds.length > 0
      ? await supabase
          .schema('public')
          .from('users')
          .select('id, email, display_name, avatar_url, phone_number')
          .in('id', memberIds)
      : { data: [] };

  return {
    id: group?.id ?? groupId,
    name: group?.name ?? 'ActiveBoard',
    memberCount: Math.max(memberIds.length, 1),
    maxMembers: group?.max_members ?? 5,
    membersPreview: (profiles ?? []).map((profile) => {
      const label = profile.display_name ?? profile.email ?? 'AB';
      const initials =
        label
          .split(/[\s@._-]+/)
          .map((part) => part.trim()[0])
          .filter(Boolean)
          .slice(0, 2)
          .join('')
          .toUpperCase() || 'AB';

      return {
        id: profile.id,
        initials,
        name: profile.display_name,
        email: profile.email,
        phoneNumber: profile.phone_number,
        avatarUrl: profile.avatar_url,
      };
    }),
  };
}

function canEditScheduledSessionTime(session: {
  status: string | null;
  scheduled_at: string | null;
  meeting_link?: string | null;
}) {
  if (session.status !== 'scheduled') {
    return false;
  }

  if (!session.meeting_link) {
    return true;
  }

  if (!session.scheduled_at) {
    return false;
  }

  return new Date(session.scheduled_at).getTime() - Date.now() > 60 * 60 * 1000;
}

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
  const planNextAccess = await getPlanNextAccess(user.id);

  if (!data?.session || !data.group) {
    notFound();
  }

  const quitConfirmLabels = {
    title: t('quitConfirmTitle'),
    description: t('quitConfirmDescription'),
    cancel: t('quitConfirmCancel'),
    confirm: t('quitConfirmConfirm'),
  };
  const inviteTeammateLabels = {
    button: t('inviteTeammateButton'),
    title: t('inviteTeammateTitle'),
    description: t('inviteTeammateDescription'),
    email: t('inviteTeammateEmail'),
    emailPlaceholder: t('inviteTeammateEmailPlaceholder'),
    send: t('inviteTeammateSend'),
    sending: t('inviteTeammateSending'),
    cancel: t('inviteTeammateCancel'),
    close: t('inviteTeammateClose'),
    success: t('inviteTeammateSuccess'),
    successEmailWarning: t('inviteTeammateSuccessEmailWarning'),
    invalidEmail: t('inviteTeammateInvalidEmail'),
    cannotInviteSelf: t('inviteTeammateCannotInviteSelf'),
    alreadyMember: t('inviteTeammateAlreadyMember'),
    groupFull: t('inviteTeammateGroupFull'),
    reviewInProgress: t('inviteTeammateReviewInProgress'),
    inviteExists: t('inviteTeammateInviteExists'),
    sessionNotActive: t('inviteTeammateSessionNotActive'),
    notAuthorized: t('inviteTeammateNotAuthorized'),
    genericError: t('inviteTeammateGenericError'),
  };

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
  const isPerQuestionMode = data.session.timer_mode === 'per_question';
  const isReview = searchParams.stage === 'review';
  const isFeedback = searchParams.stage === 'feedback';
  const isPlanNext = searchParams.stage === 'plan-next';
  const isProgress = searchParams.stage === 'progress';
  const isConfigure = searchParams.stage === 'configure';
  const isPostAnswerStage = isReview || isFeedback || isPlanNext;
  const reviewedQuestionCount =
    'reviewedQuestionCount' in data &&
    typeof data.reviewedQuestionCount === 'number'
      ? data.reviewedQuestionCount
      : questions.filter((item) => (item as ReviewQuestion).correct_option)
          .length;
  const shouldShowCompletion =
    searchParams.stage === 'complete' ||
    (data.session.status === 'completed' && !isPostAnswerStage) ||
    (data.session.status === 'incomplete' && !isPostAnswerStage) ||
    (data.session.status === 'active' &&
      !isPerQuestionMode &&
      answeredCount >= questionGoal &&
      !isPostAnswerStage);
  const canAdvanceQuestion = data.session.leader_id === user.id;
  const canTakeOverStartResponsibility =
    Boolean(data.membership) &&
    Boolean(data.session.leader_id) &&
    data.session.leader_id !== user.id;
  const canInviteTeammate = Boolean(data.membership);
  const groupMaxMembers =
    typeof (data.group as { max_members?: unknown }).max_members === 'number'
      ? ((data.group as { max_members: number }).max_members ?? 5)
      : 5;
  const inviteTeammateDisabledReason =
    data.members.length >= groupMaxMembers
      ? inviteTeammateLabels.groupFull
      : question?.phase === 'review'
        ? inviteTeammateLabels.reviewInProgress
        : null;
  const progressQuestionQuery =
    typeof currentIndex === 'number' ? `&q=${currentIndex}` : '';
  const progressSessionHref =
    data.session.status === 'scheduled'
      ? canEditScheduledSessionTime(data.session)
        ? `/sessions/${params.sessionId}?stage=configure`
        : `/sessions/${params.sessionId}?q=0`
      : data.session.status === 'incomplete' ||
          data.session.status === 'completed' ||
          question?.phase === 'review'
        ? `/sessions/${params.sessionId}?stage=review&q=${currentIndex}`
        : `/sessions/${params.sessionId}?q=${currentIndex}`;

  if (isConfigure) {
    if (!canEditScheduledSessionTime(data.session)) {
      redirect(`/${locale}/sessions/${params.sessionId}?stage=progress`);
    }

    const [sessionPolicy, configureGroup] = await Promise.all([
      getAppPolicySettings(),
      getConfigureGroup(data.group.id),
    ]);

    return (
      <main className="flex flex-1 flex-col">
        <SessionTabPresence sessionId={params.sessionId} />
        <FeedbackBanner
          message={searchParams.feedbackMessage}
          tone={searchParams.feedbackTone}
          feedbackId={searchParams.feedbackId}
        />
        <SessionConfigureRuntime
          locale={locale}
          groups={[configureGroup]}
          sessionPolicy={sessionPolicy}
          planNextAccess={planNextAccess}
          existingSession={{
            id: params.sessionId,
            groupId: data.group.id,
            name: data.session.name,
            scheduledAt: data.session.scheduled_at ?? new Date().toISOString(),
            questionGoal: questionGoal,
            timerMode: data.session.timer_mode,
            timerSeconds: data.session.timer_seconds,
            meetingLink: data.session.meeting_link ?? null,
          }}
        />
      </main>
    );
  }

  if (isProgress) {
    return (
      <main className="flex flex-1 flex-col">
        <SessionTabPresence sessionId={params.sessionId} />
        <FeedbackBanner
          message={searchParams.feedbackMessage}
          tone={searchParams.feedbackTone}
          feedbackId={searchParams.feedbackId}
        />
        <SessionProgressEntryRuntime
          locale={locale}
          sessionId={params.sessionId}
          sessionTitle={data.session.name ?? data.group.name}
          status={data.session.status}
          sessionHref={progressSessionHref}
          questionGoal={questionGoal}
          timerSeconds={data.session.timer_seconds}
          answeredCount={answeredCount}
          reviewedCount={reviewedQuestionCount}
          scheduledAt={data.session.scheduled_at ?? undefined}
          meetingLink={data.session.meeting_link}
          feedbackSubmitted={searchParams.feedback === 'done'}
        />
      </main>
    );
  }

  if (data.session.status === 'scheduled' && !data.session.meeting_link) {
    redirect(`/${locale}/sessions/${params.sessionId}?stage=configure`);
  }

  if (data.session.status === 'scheduled') {
    return (
      <main className="flex flex-1 flex-col">
        <SessionTabPresence sessionId={params.sessionId} />
        <FeedbackBanner
          message={searchParams.feedbackMessage}
          tone={searchParams.feedbackTone}
          feedbackId={searchParams.feedbackId}
        />
        <SessionAutoStartRuntime
          locale={locale}
          sessionId={params.sessionId}
          backLabel={t('quitSession')}
        />
      </main>
    );
  }

  if (shouldShowCompletion) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <SessionTabPresence sessionId={params.sessionId} />
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
            href={`/sessions/${params.sessionId}?stage=progress${progressQuestionQuery}`}
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
              confirmLabels={quitConfirmLabels}
              redirectTo={`/${locale}/sessions/${params.sessionId}?stage=progress`}
            />
          </div>
        </section>
      </main>
    );
  }

  if (isReview && question) {
    const reviewQuestion = question as ReviewQuestion;

    return (
      <>
        <SessionTabPresence sessionId={params.sessionId} />
        <FeedbackBanner
          message={searchParams.feedbackMessage}
          tone={searchParams.feedbackTone}
          feedbackId={searchParams.feedbackId}
        />
        <SessionReviewRuntime
          locale={locale}
          sessionId={params.sessionId}
          sessionTitle={data.session.name ?? data.group.name}
          questionGoal={questionGoal}
          timerMode={data.session.timer_mode}
          initialQuestionIndex={currentIndex}
          initialReviewedQuestionCount={reviewedQuestionCount}
          initialQuestion={reviewQuestion}
          initialDistribution={data.currentQuestionDistribution}
          initialOwnAnswer={data.currentUserAnswer}
          labels={{
            reviewShort: t('reviewShort'),
            previous: t('previous'),
            next: t('next'),
            questionUpper: t('questionUpper'),
            distribution: t('distribution'),
            skippedAnswer: t('skippedAnswer'),
            finishSession: t('finishSession'),
            finishSessionPending: t('finishSessionPending'),
            correctAnswer: t('correctAnswer'),
            save: t('saveReview'),
            update: t('updateReview'),
            saveAndNext: t('saveAndNextReview'),
            updateAndNext: t('updateAndNextReview'),
            savePending: t('saveReviewPending'),
            saved: t('reviewSaved'),
            quitConfirm: quitConfirmLabels,
            reviewLocked: t('reviewLocked'),
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

  if (isFeedback) {
    const reviewPeers = await getReviewPeers(data.group.id, user.id);

    return (
      <main className="flex flex-1 flex-col">
        <SessionTabPresence sessionId={params.sessionId} />
        <FeedbackBanner
          message={searchParams.feedbackMessage}
          tone={searchParams.feedbackTone}
          feedbackId={searchParams.feedbackId}
        />
        <SessionPeerFeedbackRuntime
          locale={locale}
          sessionId={params.sessionId}
          sessionTitle={data.session.name ?? data.group.name}
          peers={reviewPeers}
          questionsTogether={questionGoal}
        />
      </main>
    );
  }

  if (isPlanNext) {
    const [sessionPolicy, configureGroup] = await Promise.all([
      getAppPolicySettings(),
      getConfigureGroup(data.group.id),
    ]);

    return (
      <main className="flex flex-1 flex-col">
        <SessionTabPresence sessionId={params.sessionId} />
        <FeedbackBanner
          message={searchParams.feedbackMessage}
          tone={searchParams.feedbackTone}
          feedbackId={searchParams.feedbackId}
        />
        <SessionPlanNextRuntime
          locale={locale}
          sessionId={params.sessionId}
          groups={[configureGroup]}
          initialGroupId={data.group.id}
          sessionTitle={data.session.name ?? data.group.name}
          questionGoal={questionGoal}
          timerSeconds={data.session.timer_seconds}
          timerMode={data.session.timer_mode}
          sessionPolicy={sessionPolicy}
          planNextAccess={planNextAccess}
        />
      </main>
    );
  }

  if (!question) {
    return (
      <main className="flex flex-1 flex-col">
        <SessionTabPresence sessionId={params.sessionId} />
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

  const myAnswer = data.currentUserAnswer;
  const isQuestionExpired =
    Boolean(question.answer_deadline_at) &&
    new Date(question.answer_deadline_at ?? '').getTime() <= Date.now();
  const submittedCount = isQuestionExpired
    ? memberCount
    : data.currentQuestionSubmittedCount;

  return (
    <main className="flex flex-1 flex-col">
      <SessionTabPresence sessionId={params.sessionId} />
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
        currentUserId={user.id}
        questionId={question.id}
        questionIndex={currentIndex}
        questionGoal={questionGoal}
        timerMode={data.session.timer_mode}
        timerSeconds={data.session.timer_seconds}
        startedAt={data.session.started_at}
        canAdvanceQuestion={canAdvanceQuestion}
        canTakeOverStartResponsibility={canTakeOverStartResponsibility}
        canInviteTeammate={canInviteTeammate}
        inviteTeammateDisabledReason={inviteTeammateDisabledReason}
        takeOverStartResponsibilityAction={takeOverStartResponsibilityAction}
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
          waitingForCaptainAdvance: t('waitingForCaptainAdvance'),
          allAnswersSubmitted: t('allAnswersSubmitted'),
          questionsCompletedValue: t('questionsCompletedValue', {
            current: questionGoal,
            total: questionGoal,
          }),
          goToReview: t('goToReview'),
          takeOverStartResponsibility: t('takeOverStartResponsibility'),
          takeOverStartResponsibilityPending: t('takeOverStartResponsibilityPending'),
          currentStartResponsible: t('currentStartResponsible'),
          quitSession: t('quitSession'),
          quitPending: t('quitPending'),
          quitConfirm: quitConfirmLabels,
          inviteTeammate: inviteTeammateLabels,
        }}
      />
    </main>
  );
}
