'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ANSWER_OPTIONS } from '@/lib/types/demo';
import { withFeedback } from '@/lib/utils';

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
    .select('id, group_id, started_at, leader_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) {
    redirect(withFeedback(`/${locale}/dashboard`, 'error', t('notAuthorized')));
  }
  const safeSession = session;

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('role')
    .eq('group_id', safeSession.group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || (membership.role !== 'admin' && safeSession.leader_id !== user.id)) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('notAuthorized')));
  }

  await supabase
    .schema('public')
    .from('sessions')
    .update({
      status: 'active',
      started_at: safeSession.started_at ?? new Date().toISOString(),
    })
    .eq('id', sessionId);

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

  if (!questionBody) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('missingFields')));
  }

  const { data: session } = await supabase
    .schema('public')
    .from('sessions')
    .select('id, group_id, timer_seconds, leader_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) {
    redirect(withFeedback(`/${locale}/dashboard`, 'error', t('notAuthorized')));
  }
  const safeSession = session;

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('role')
    .eq('group_id', safeSession.group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || (membership.role !== 'admin' && safeSession.leader_id !== user.id)) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('notAuthorized')));
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

  const { data: latestQuestion } = await supabase
    .schema('public')
    .from('questions')
    .select('order_index')
    .eq('session_id', sessionId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  const launchedAt = new Date();
  const answerDeadlineAt = new Date(launchedAt.getTime() + safeSession.timer_seconds * 1000);

  await supabase.schema('public').from('questions').insert({
    session_id: sessionId,
    asked_by: user.id,
    body: questionBody,
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

  revalidatePath(`/${locale}/sessions/${sessionId}`);
  redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'success', t('questionLaunched')));
}

export async function submitAnswerAction(formData: FormData) {
  const locale = formData.get('locale') as AppLocale;
  const sessionId = formData.get('sessionId') as string;
  const questionId = formData.get('questionId') as string;
  const selectedOption = (formData.get('selectedOption') as string | null)?.toUpperCase() ?? null;
  const confidence = Number(formData.get('confidence'));
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
      confidence: Number.isFinite(confidence) ? confidence : null,
    },
    { onConflict: 'question_id,user_id' },
  );

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
    .select('group_id, leader_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('notAuthorized')));
  }
  const safeSession = session;

  const { data: membership } = await supabase
    .schema('public')
    .from('group_members')
    .select('role')
    .eq('group_id', safeSession.group_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (
    !membership ||
    (membership.role !== 'admin' &&
      safeSession.leader_id !== user.id &&
      safeQuestion.asked_by !== user.id)
  ) {
    redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'error', t('notAuthorized')));
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

  revalidatePath(`/${locale}/sessions/${sessionId}`);
  redirect(withFeedback(`/${locale}/sessions/${sessionId}`, 'success', t('answerRevealed')));
}
