import { NextResponse } from 'next/server';

import type { AppLocale } from '@/i18n/routing';
import { hasEmailEnv } from '@/lib/env';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { sendSessionCalendarInvites } from '@/lib/notifications/calendar-invites';
import { createGroupNotifications } from '@/lib/notifications/in-app';
import { expirePastScheduledSession } from '@/lib/session/expired-sessions';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type RouteContext = {
  params: { sessionId: string };
};

type ScheduleSessionPayload = {
  locale?: string;
  returnTo?: string;
  scheduledAt?: string;
  timerMode?: 'per_question' | 'global';
  timerSeconds?: number;
  meetingLink?: string;
};

const EDIT_LOCK_WINDOW_MS = 60 * 60 * 1000;

function parseScheduledAt(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return date;
}

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function getFeedback(
  locale: AppLocale,
  key: 'invalid' | 'locked' | 'failed' | 'expired',
) {
  if (locale === 'fr') {
    return key === 'invalid'
      ? "Ajoute une heure valide et un lien de réunion."
      : key === 'locked'
        ? "L'heure ne peut plus être modifiée à moins d'une heure du début."
        : key === 'expired'
          ? "Cette séance est expirée. Mets à jour tes disponibilités pour générer une séance de rattrapage."
        : "La séance n'a pas pu être planifiée. Réessaie.";
  }

  return key === 'invalid'
    ? 'Add a valid time and meeting link.'
    : key === 'locked'
      ? 'The session time can no longer be changed less than one hour before it starts.'
      : key === 'expired'
        ? 'This session expired. Update your availability to generate a replacement test session.'
      : 'The session could not be scheduled. Please try again.';
}

export async function POST(request: Request, { params }: RouteContext) {
  const body = (await request
    .json()
    .catch(() => null)) as ScheduleSessionPayload | null;
  const locale = (body?.locale === 'fr' ? 'fr' : 'en') as AppLocale;
  const scheduledAt = parseScheduledAt(body?.scheduledAt);
  const meetingLink = body?.meetingLink?.trim() ?? '';
  const timerMode = body?.timerMode === 'global' ? 'global' : 'per_question';
  const timerSeconds = Number(body?.timerSeconds);
  const isExpired = await expirePastScheduledSession(params.sessionId);

  if (isExpired) {
    return NextResponse.json(
      { ok: false, message: getFeedback(locale, 'expired') },
      { status: 410 },
    );
  }

  if (!scheduledAt || !meetingLink || !Number.isFinite(timerSeconds)) {
    return NextResponse.json(
      { ok: false, message: getFeedback(locale, 'invalid') },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, redirectTo: `/${locale}/auth/login` },
      { status: 401 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: session } = await admin
    .schema('public')
    .from('sessions')
    .select(
      'id, group_id, name, scheduled_at, share_code, status, meeting_link, timer_seconds, leader_id',
    )
    .eq('id', params.sessionId)
    .maybeSingle();

  if (!session || session.status !== 'scheduled') {
    return NextResponse.json(
      { ok: false, message: getFeedback(locale, 'failed') },
      { status: 404 },
    );
  }

  const assignedDate = new Date(session.scheduled_at);
  const isAssignedDay =
    Number.isFinite(assignedDate.getTime()) &&
    isSameLocalDay(scheduledAt, assignedDate);
  if (scheduledAt.getTime() < Date.now() - 5 * 60 * 1000 && !isAssignedDay) {
    return NextResponse.json(
      { ok: false, message: getFeedback(locale, 'invalid') },
      { status: 400 },
    );
  }

  const [{ data: membership }, { data: groupMembers }] = await Promise.all([
    admin
      .schema('public')
      .from('group_members')
      .select('user_id')
      .eq('group_id', session.group_id)
      .eq('user_id', user.id)
      .maybeSingle(),
    admin
      .schema('public')
      .from('group_members')
      .select('user_id')
      .eq('group_id', session.group_id),
  ]);

  if (!membership) {
    return NextResponse.json(
      { ok: false, message: getFeedback(locale, 'failed') },
      { status: 403 },
    );
  }

  if (
    session.meeting_link &&
    new Date(session.scheduled_at).getTime() - Date.now() <=
      EDIT_LOCK_WINDOW_MS
  ) {
    return NextResponse.json(
      { ok: false, message: getFeedback(locale, 'locked') },
      { status: 403 },
    );
  }

  const memberIds = [
    ...new Set(
      (groupMembers ?? [])
        .map((member) => member.user_id)
        .filter((memberId): memberId is string => Boolean(memberId)),
    ),
  ];
  const { data: metrics } =
    memberIds.length > 0
      ? await admin
          .schema('public')
          .from('candidate_matching_profiles')
          .select('user_id, questions_reviewed')
          .in('user_id', memberIds)
      : { data: [] };
  const leaderId =
    (metrics ?? [])
      .slice()
      .sort(
        (left, right) =>
          (right.questions_reviewed ?? 0) - (left.questions_reviewed ?? 0),
      )[0]?.user_id ?? user.id;

  const { data: updatedSession, error } = await admin
    .schema('public')
    .from('sessions')
    .update({
      scheduled_at: scheduledAt.toISOString(),
      meeting_link: meetingLink,
      timer_mode: timerMode,
      timer_seconds: Math.round(timerSeconds),
      leader_id: leaderId,
    })
    .eq('id', params.sessionId)
    .select(
      'id, group_id, name, scheduled_at, share_code, meeting_link, timer_seconds, leader_id',
    )
    .single();

  if (error || !updatedSession) {
    return NextResponse.json(
      { ok: false, message: getFeedback(locale, 'failed') },
      { status: 500 },
    );
  }

  void Promise.allSettled([
    logAppEvent({
      eventName: APP_EVENTS.sessionScheduled,
      locale,
      userId: user.id,
      groupId: updatedSession.group_id,
      sessionId: updatedSession.id,
      metadata: {
        source: 'existing_test_session_schedule',
        scheduled_at: scheduledAt.toISOString(),
        meeting_link_present: true,
        timer_mode: timerMode,
        timer_seconds: Math.round(timerSeconds),
        leader_id: leaderId,
      },
    }),
    createGroupNotifications({
      groupId: updatedSession.group_id,
      sessionId: updatedSession.id,
      actorUserId: user.id,
      type: 'session_scheduled',
      targetPath: `/sessions/${updatedSession.id}?stage=progress`,
      titleEn: 'Session time planned',
      titleFr: 'Horaire de séance planifié',
      bodyEn: `"${updatedSession.name ?? 'Session'}" now has a time and meeting link.`,
      bodyFr: `"${updatedSession.name ?? 'Séance'}" a maintenant une heure et un lien de réunion.`,
    }),
    hasEmailEnv()
      ? Promise.resolve(
          admin
            .schema('public')
            .from('session_calendar_invites')
            .delete()
            .eq('session_id', updatedSession.id),
        )
          .then(() => sendSessionCalendarInvites(updatedSession))
          .catch((inviteError: unknown) => {
            console.error('sendSessionCalendarInvites failed', {
              sessionId: updatedSession.id,
              error:
                inviteError instanceof Error
                  ? inviteError.message
                  : 'Unknown calendar invite error',
            });
          })
      : Promise.resolve(),
  ]);

  return NextResponse.json({
    ok: true,
    sessionId: updatedSession.id,
    redirectTo:
      body?.returnTo && body.returnTo.startsWith(`/${locale}/`)
        ? body.returnTo
        : `/${locale}/sessions/${updatedSession.id}?stage=progress`,
  });
}
