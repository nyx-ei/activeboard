'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { requireUserTierCapability } from '@/lib/billing/gating';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isConfidenceLevel } from '@/lib/demo/confidence';
import {
  ANSWER_OPTIONS,
  DIMENSION_OF_CARE_OPTIONS,
  ERROR_TYPE_OPTIONS,
  PHYSICIAN_ACTIVITY_OPTIONS,
} from '@/lib/types/demo';
import { withFeedback } from '@/lib/utils';

function getGlobalDeadline(startedAt: string | null, timerSeconds: number) {
  const startedAtMs = startedAt ? new Date(startedAt).getTime() : Date.now();
  return new Date(startedAtMs + timerSeconds * 1000);
}

async function getCurrentAuthUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

export async function startSessionAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const sessionId = formData.get('sessionId') as string;
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  const { data: session } = await supabase
    .schema('public')
    .from('sessions')
    .select('id, group_id, started_at, leader_id, status, timer_mode, timer_seconds')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) {
    redirect(withFeedback(`/${locale}/dashboard`, 'error', t('notAuthorized')));
  }
  const safeSession = session;

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('is_founder')
    .eq('group_id', safeSession.group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || (!membership.is_founder && safeSession.leader_id !== user.id)) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('notAuthorized')));
  }

  await requireUserTierCapability({
    userId: user.id,
    capability: 'canBeCaptain',
    locale,
    redirectTo: `/${locale}/sessions/${sessionId}`,
    feedbackKey: 'upgradeRequiredToLeadSession',
  });

  if (safeSession.status !== 'scheduled') {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('actionFailed')));
  }

  const { count: memberCount } = await supabase
    .schema('public')
    .from('group_members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', safeSession.group_id);

  if ((memberCount ?? 0) < 2) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('minimumMembers')));
  }

  await supabase
    .schema('public')
    .from('sessions')
    .update({
      status: 'active',
      started_at: safeSession.started_at ?? new Date().toISOString(),
    })
    .eq('id', sessionId);

  await logAppEvent({
    eventName: APP_EVENTS.sessionStarted,
    locale,
    userId: user.id,
    groupId: safeSession.group_id,
    sessionId,
    metadata: {
      member_count: memberCount ?? 0,
    },
  });

  revalidatePath(`/${locale}/sessions/${sessionId}`);
  redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'success', t('sessionStarted')));
}

export async function launchQuestionAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const sessionId = formData.get('sessionId') as string;
  const questionBody = ((formData.get('questionBody') as string | null) ?? '').trim();
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  const { data: session } = await supabase
    .schema('public')
    .from('sessions')
    .select('id, group_id, timer_seconds, timer_mode, started_at, leader_id, status')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) {
    redirect(withFeedback(`/${locale}/dashboard`, 'error', t('notAuthorized')));
  }
  const safeSession = session;

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('is_founder')
    .eq('group_id', safeSession.group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || (!membership.is_founder && safeSession.leader_id !== user.id)) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('notAuthorized')));
  }

  if (safeSession.status !== 'active') {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('actionFailed')));
  }

  const { data: activeQuestion } = await supabase
    .schema('public')
    .from('questions')
    .select('id')
    .eq('session_id', sessionId)
    .eq('phase', 'answering')
    .maybeSingle();

  if (activeQuestion) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('questionActive')));
  }

  await supabase
    .schema('public')
    .from('questions')
    .update({ phase: 'closed' })
    .eq('session_id', sessionId)
    .eq('phase', 'review');

  const { data: latestQuestion } = await supabase
    .schema('public')
    .from('questions')
    .select('order_index')
    .eq('session_id', sessionId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  const launchedAt = new Date();
  const answerDeadlineAt =
    safeSession.timer_mode === 'global'
      ? getGlobalDeadline(safeSession.started_at, safeSession.timer_seconds)
      : new Date(launchedAt.getTime() + safeSession.timer_seconds * 1000);

  if (safeSession.timer_mode === 'global' && answerDeadlineAt.getTime() <= Date.now()) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('actionFailed')));
  }

  await supabase.schema('public').from('questions').insert({
    session_id: sessionId,
    asked_by: user.id,
    body: questionBody || null,
    options: ANSWER_OPTIONS,
    order_index: (latestQuestion?.order_index ?? -1) + 1,
    phase: 'answering',
    launched_at: launchedAt.toISOString(),
    answer_deadline_at: answerDeadlineAt.toISOString(),
  });

  await supabase
    .schema('public')
    .from('sessions')
    .update({
      status: 'active',
      started_at: new Date().toISOString(),
      leader_id: safeSession.leader_id ?? user.id,
    })
    .eq('id', sessionId);

  await logAppEvent({
    eventName: APP_EVENTS.questionLaunched,
    locale,
    userId: user.id,
    groupId: safeSession.group_id,
    sessionId,
    metadata: {
      order_index: (latestQuestion?.order_index ?? -1) + 1,
      timer_seconds: safeSession.timer_seconds,
      timer_mode: safeSession.timer_mode,
      has_body: Boolean(questionBody),
    },
  });

  revalidatePath(`/${locale}/sessions/${sessionId}`);
  redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'success', t('questionLaunched')));
}

export async function submitAnswerAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const sessionId = formData.get('sessionId') as string;
  const questionId = formData.get('questionId') as string;
  const selectedOption = (formData.get('selectedOption') as string | null)?.toUpperCase() ?? null;
  const confidenceValue = formData.get('confidence');
  const confidence =
    typeof confidenceValue === 'string' && isConfidenceLevel(confidenceValue) ? confidenceValue : null;
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  const { data: question } = await supabase
    .schema('public')
    .from('questions')
    .select('answer_deadline_at, phase')
    .eq('id', questionId)
    .maybeSingle();

  if (!question) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('notAuthorized')));
  }
  const safeQuestion = question;

  if (safeQuestion.phase !== 'answering') {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('questionClosed')));
  }

  if (safeQuestion.answer_deadline_at && new Date(safeQuestion.answer_deadline_at).getTime() < Date.now()) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('answerWindowClosed')));
  }

  await supabase.schema('public').from('answers').upsert(
    {
      question_id: questionId,
      user_id: user.id,
      selected_option: selectedOption,
      confidence,
    },
    { onConflict: 'question_id,user_id' },
  );

  await logAppEvent({
    eventName: APP_EVENTS.answerSubmitted,
    locale,
    userId: user.id,
    sessionId,
    metadata: {
      question_id: questionId,
      selected_option: selectedOption,
      confidence,
    },
  });

  revalidatePath(`/${locale}/sessions/${sessionId}`);
  redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'success', t('answerSubmitted')));
}

export async function revealAnswerAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const sessionId = formData.get('sessionId') as string;
  const questionId = formData.get('questionId') as string;
  const correctOption = (formData.get('correctOption') as string | null)?.toUpperCase() ?? '';
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  const { data: question } = await supabase
    .schema('public')
    .from('questions')
    .select('session_id, asked_by')
    .eq('id', questionId)
    .maybeSingle();

  if (!question) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('notAuthorized')));
  }
  const safeQuestion = question;

  const { data: session } = await supabase
    .schema('public')
    .from('sessions')
    .select('group_id, leader_id, status')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('notAuthorized')));
  }
  const safeSession = session;

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('is_founder')
    .eq('group_id', safeSession.group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (
    !membership ||
    (!membership.is_founder &&
      safeSession.leader_id !== user.id &&
      safeQuestion.asked_by !== user.id)
  ) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('notAuthorized')));
  }

  if (safeSession.status !== 'active') {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('actionFailed')));
  }

  if (!ANSWER_OPTIONS.includes(correctOption as (typeof ANSWER_OPTIONS)[number])) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('missingFields')));
  }

  await supabase
    .schema('public')
    .from('questions')
    .update({
      correct_option: correctOption,
      phase: 'review',
    })
    .eq('id', questionId);

  const { data: answers } = await supabase
    .schema('public')
    .from('answers')
    .select('id, selected_option')
    .eq('question_id', questionId);

  await Promise.all(
    (answers ?? []).map((answer) =>
      supabase
        .schema('public')
        .from('answers')
        .update({
          is_correct: (answer.selected_option ?? '').toUpperCase() === correctOption,
        })
        .eq('id', answer.id),
    ),
  );

  await logAppEvent({
    eventName: APP_EVENTS.answerRevealed,
    locale,
    userId: user.id,
    groupId: safeSession.group_id,
    sessionId,
    metadata: {
      question_id: questionId,
      correct_option: correctOption,
      answer_count: answers?.length ?? 0,
    },
  });

  revalidatePath(`/${locale}/sessions/${sessionId}`);
  redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'success', t('answerRevealed')));
}

export async function classifyQuestionAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const sessionId = formData.get('sessionId') as string;
  const questionId = formData.get('questionId') as string;
  const physicianActivity = (formData.get('physicianActivity') as string | null) ?? '';
  const dimensionOfCare = (formData.get('dimensionOfCare') as string | null) ?? '';
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  const { data: question } = await supabase
    .schema('public')
    .from('questions')
    .select('id, session_id, correct_option')
    .eq('id', questionId)
    .maybeSingle();

  if (!question || question.session_id !== sessionId) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('notAuthorized')));
  }

  const { data: session } = await supabase
    .schema('public')
    .from('sessions')
    .select('group_id, leader_id, status')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('notAuthorized')));
  }

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('is_founder')
    .eq('group_id', session.group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || (!membership.is_founder && session.leader_id !== user.id)) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('notAuthorized')));
  }

  if (session.status !== 'active') {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('actionFailed')));
  }

  if (
    !PHYSICIAN_ACTIVITY_OPTIONS.includes(physicianActivity as (typeof PHYSICIAN_ACTIVITY_OPTIONS)[number]) ||
    !DIMENSION_OF_CARE_OPTIONS.includes(dimensionOfCare as (typeof DIMENSION_OF_CARE_OPTIONS)[number])
  ) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('missingFields')));
  }

  await supabase.schema('public').from('question_classifications').upsert(
    {
      question_id: questionId,
      session_id: sessionId,
      classified_by: user.id,
      correct_answer: question.correct_option,
      physician_activity: physicianActivity as (typeof PHYSICIAN_ACTIVITY_OPTIONS)[number],
      dimension_of_care: dimensionOfCare as (typeof DIMENSION_OF_CARE_OPTIONS)[number],
    },
    { onConflict: 'question_id' },
  );

  await logAppEvent({
    eventName: APP_EVENTS.questionClassified,
    locale,
    userId: user.id,
    groupId: session.group_id,
    sessionId,
    metadata: {
      question_id: questionId,
      physician_activity: physicianActivity,
      dimension_of_care: dimensionOfCare,
    },
  });

  revalidatePath(`/${locale}/sessions/${sessionId}`);
  redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'success', t('actionSucceeded')));
}

export async function savePersonalReflectionAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const sessionId = formData.get('sessionId') as string;
  const questionId = formData.get('questionId') as string;
  const errorTypeValue = (formData.get('errorType') as string | null) ?? '';
  const privateNote = ((formData.get('privateNote') as string | null) ?? '').trim();
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  const { data: question } = await supabase
    .schema('public')
    .from('questions')
    .select('id, session_id, phase')
    .eq('id', questionId)
    .maybeSingle();

  if (!question || question.session_id !== sessionId) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('notAuthorized')));
  }

  if (question.phase !== 'review' && question.phase !== 'closed') {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('actionFailed')));
  }

  if (
    errorTypeValue &&
    !ERROR_TYPE_OPTIONS.includes(errorTypeValue as (typeof ERROR_TYPE_OPTIONS)[number])
  ) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('missingFields')));
  }

  await supabase.schema('public').from('personal_reflections').upsert(
    {
      question_id: questionId,
      user_id: user.id,
      error_type: errorTypeValue ? (errorTypeValue as (typeof ERROR_TYPE_OPTIONS)[number]) : null,
      private_note: privateNote || null,
    },
    { onConflict: 'question_id,user_id' },
  );

  await logAppEvent({
    eventName: APP_EVENTS.personalReflectionSaved,
    locale,
    userId: user.id,
    sessionId,
    metadata: {
      question_id: questionId,
      error_type: errorTypeValue || null,
      has_note: Boolean(privateNote),
    },
  });

  revalidatePath(`/${locale}/sessions/${sessionId}`);
  redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'success', t('actionSucceeded')));
}

export async function passLeaderAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const sessionId = formData.get('sessionId') as string;
  const nextLeaderId = formData.get('nextLeaderId') as string;
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  const { data: session } = await supabase
    .schema('public')
    .from('sessions')
    .select('group_id, leader_id, status')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) {
    redirect(withFeedback(`/${locale}/dashboard`, 'error', t('notAuthorized')));
  }

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('is_founder')
    .eq('group_id', session.group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || (!membership.is_founder && session.leader_id !== user.id)) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('notAuthorized')));
  }

  if (session.status !== 'active') {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('actionFailed')));
  }

  const { data: targetMembership } = await supabase
    .schema('public')
    .from('group_members')
    .select('user_id')
    .eq('group_id', session.group_id)
    .eq('user_id', nextLeaderId)
    .maybeSingle();

  if (!targetMembership) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('notAuthorized')));
  }

  await supabase
    .schema('public')
    .from('sessions')
    .update({ leader_id: nextLeaderId })
    .eq('id', sessionId);

  await logAppEvent({
    eventName: APP_EVENTS.leaderPassed,
    locale,
    userId: user.id,
    groupId: session.group_id,
    sessionId,
    metadata: {
      next_leader_id: nextLeaderId,
      previous_leader_id: session.leader_id,
    },
  });

  revalidatePath(`/${locale}/sessions/${sessionId}`);
  redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'success', t('leaderPassed')));
}

export async function endSessionAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const sessionId = formData.get('sessionId') as string;
  const t = await getTranslations({ locale, namespace: 'Feedback' });
  const { supabase, user } = await getCurrentAuthUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  const { data: session } = await supabase
    .schema('public')
    .from('sessions')
    .select('group_id, leader_id, status')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) {
    redirect(withFeedback(`/${locale}/dashboard`, 'error', t('notAuthorized')));
  }

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('is_founder')
    .eq('group_id', session.group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || (!membership.is_founder && session.leader_id !== user.id)) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('notAuthorized')));
  }

  if (session.status !== 'active') {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('actionFailed')));
  }

  await supabase
    .schema('public')
    .from('questions')
    .update({ phase: 'closed' })
    .eq('session_id', sessionId)
    .in('phase', ['answering', 'review']);

  await supabase
    .schema('public')
    .from('sessions')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  await logAppEvent({
    eventName: APP_EVENTS.sessionEnded,
    locale,
    userId: user.id,
    groupId: session.group_id,
    sessionId,
    metadata: {
      ended_by: user.id,
    },
  });

  revalidatePath(`/${locale}/sessions/${sessionId}`);
  redirect(withFeedback(`/${locale}/sessions/${sessionId}/summary`, 'success', t('sessionCompleted')));
}
