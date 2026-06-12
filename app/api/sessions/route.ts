import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { getUserTierCapabilities } from '@/lib/billing/user-tier';
import { hasEmailEnv } from '@/lib/env';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { sendSessionCalendarInvites } from '@/lib/notifications/calendar-invites';
import { createGroupNotifications } from '@/lib/notifications/in-app';
import { createPerfTracker } from '@/lib/observability/perf';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type CreateSessionPayload = {
  locale?: string;
  groupId?: string;
  returnTo?: string;
  sessionName?: string;
  scheduledAt?: string;
  questionGoal?: number;
  timerMode?: 'per_question' | 'global';
  timerSeconds?: number;
};

function groupDashboardPath(locale: AppLocale, groupId: string) {
  return `/${locale}/dashboard?groupId=${encodeURIComponent(groupId)}`;
}

function getStaticSessionScheduledFeedback(locale: AppLocale) {
  return locale === 'fr' ? 'Session programmée.' : 'Session scheduled.';
}

type FastCreateSessionResult = {
  ok: boolean | null;
  message_key: string | null;
  session_id: string | null;
  reused: boolean | null;
};

async function notifySessionScheduled({
  groupId,
  sessionId,
  sessionName,
  actorUserId,
}: {
  groupId: string;
  sessionId: string;
  sessionName: string;
  actorUserId?: string | null;
}) {
  await createGroupNotifications({
    groupId,
    sessionId,
    actorUserId,
    type: 'session_scheduled',
    targetPath: `/sessions/${sessionId}`,
    titleEn: 'Session scheduled',
    titleFr: 'Session programmée',
    bodyEn: `"${sessionName}" is ready for your group.`,
    bodyFr: `"${sessionName}" est prête pour ton groupe.`,
  });
}

export async function POST(request: Request) {
  const body = (await request
    .json()
    .catch(() => null)) as CreateSessionPayload | null;
  const locale = (body?.locale === 'fr' ? 'fr' : 'en') as AppLocale;
  const groupId = body?.groupId ?? '';
  const returnTo = body?.returnTo ?? '';
  const sessionName = body?.sessionName?.trim() ?? '';
  const scheduledAt = parseScheduledAt(body?.scheduledAt);
  const questionGoal = Number(body?.questionGoal);
  const timerMode = body?.timerMode === 'global' ? 'global' : 'per_question';
  const timerSeconds = Number(body?.timerSeconds);
  const sessionsPath =
    groupId && returnTo === groupDashboardPath(locale, groupId)
      ? returnTo
      : `/${locale}/dashboard`;
  const perf = createPerfTracker(`createSessionRoute:${groupId}`, {
    minDurationMs: 250,
    metadata: {
      trace_group: 'sessions',
      trace_kind: 'create_session',
    },
  });
  let feedbackTranslations: Awaited<ReturnType<typeof getTranslations>> | null =
    null;
  const getFeedback = async (key: string) => {
    feedbackTranslations ??= await getTranslations({
      locale,
      namespace: 'Feedback',
    });
    return feedbackTranslations(key);
  };

  if (
    !groupId ||
    !sessionName ||
    !scheduledAt ||
    !Number.isFinite(questionGoal) ||
    questionGoal < 1 ||
    !Number.isFinite(timerSeconds) ||
    timerSeconds < 1 ||
    timerSeconds > 3600
  ) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('missingFields') },
      { status: 400 },
    );
  }

  perf.setContext({ groupId, locale });

  const supabase = createSupabaseServerClient();
  const { data: fastRows, error: fastError } = await (
    supabase.schema('public') as unknown as {
      rpc: (
        fn: 'activeboard_create_session_self_fast_v2',
        args: {
          target_group_id: string;
          session_name: string;
          target_scheduled_at: string;
          target_question_goal: number;
          target_timer_mode: string;
          target_timer_seconds: number;
        },
      ) => Promise<{
        data: FastCreateSessionResult[] | null;
        error: { code?: string; message?: string } | null;
      }>;
    }
  ).rpc('activeboard_create_session_self_fast_v2', {
    target_group_id: groupId,
    session_name: sessionName,
    target_scheduled_at: scheduledAt.toISOString(),
    target_question_goal: Math.min(Math.round(questionGoal), 500),
    target_timer_mode: timerMode,
    target_timer_seconds: timerSeconds,
  });
  const fastResult = fastRows?.[0] ?? null;
  if (!fastError && fastResult) {
    perf.step('fast_rpc_completed');

    if (!fastResult.ok || !fastResult.session_id) {
      return NextResponse.json(
        {
          ok: false,
          message: await getFeedback(fastResult.message_key ?? 'actionFailed'),
        },
        {
          status:
            fastResult.message_key === 'notAuthorized' ||
            fastResult.message_key?.startsWith('upgradeRequired')
              ? 403
              : 400,
        },
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!fastResult.reused) {
      void notifySessionScheduled({
        groupId,
        sessionId: fastResult.session_id,
        sessionName,
        actorUserId: user?.id,
      });
    }

    perf.done({
      sessionId: fastResult.session_id,
      fastPath: true,
      reused: Boolean(fastResult.reused),
    });

    return NextResponse.json({
      ok: true,
      sessionId: fastResult.session_id,
      redirectTo: groupDashboardPath(locale, groupId),
      calendarInvitesDispatchUrl: `/api/sessions/${fastResult.session_id}/calendar-invites`,
      message: getStaticSessionScheduledFeedback(locale),
      reused: Boolean(fastResult.reused),
    });
  }

  if (fastError) {
    perf.step(`fast_rpc_unavailable:${fastError.code ?? 'unknown'}`);
    console.warn(
      'activeboard_create_session_self_fast_v2 failed; using fallback',
      {
        code: fastError.code,
        message: fastError.message,
      },
    );
  }

  const admin = createSupabaseAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  perf.step('auth_loaded');

  if (!user) {
    return NextResponse.json(
      { ok: false, redirectTo: `/${locale}/auth/login` },
      { status: 401 },
    );
  }
  perf.setContext({ userId: user.id, groupId, locale });

  const [userTierResult, groupMembersResult, existingResult] =
    await Promise.all([
      admin
        .schema('public')
        .from('users')
        .select('user_tier')
        .eq('id', user.id)
        .maybeSingle(),
      admin
        .schema('public')
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .limit(10),
      admin
        .schema('public')
        .from('sessions')
        .select('id')
        .eq('group_id', groupId)
        .eq('name', sessionName)
        .in('status', ['scheduled', 'active', 'incomplete'])
        .order('scheduled_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  perf.step('guards_loaded');

  const groupMembers = groupMembersResult.data ?? [];
  const isMember = groupMembers.some((member) => member.user_id === user.id);

  if (!isMember) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('notAuthorized') },
      { status: 403 },
    );
  }

  const userTier = userTierResult.data?.user_tier ?? 'locked';
  if (!getUserTierCapabilities(userTier).canCreateSession) {
    return NextResponse.json(
      {
        ok: false,
        message: await getFeedback('upgradeRequiredToScheduleSession'),
      },
      { status: 403 },
    );
  }

  if (groupMembers.length < 2) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('minimumMembersRequired') },
      { status: 400 },
    );
  }

  if (existingResult.data?.id) {
    return NextResponse.json({
      ok: true,
      redirectTo: groupDashboardPath(locale, groupId),
      calendarInvitesDispatchUrl: `/api/sessions/${existingResult.data.id}/calendar-invites`,
      message: getStaticSessionScheduledFeedback(locale),
      reused: true,
    });
  }

  const { data: createdSession, error } = await admin
    .schema('public')
    .from('sessions')
    .insert({
      group_id: groupId,
      name: sessionName,
      scheduled_at: scheduledAt.toISOString(),
      timer_mode: timerMode,
      timer_seconds: timerSeconds,
      question_goal: Math.min(Math.round(questionGoal), 500),
      created_by: user.id,
      leader_id: user.id,
      status: 'scheduled',
    })
    .select(
      'id, group_id, name, scheduled_at, share_code, meeting_link, timer_seconds',
    )
    .single();
  perf.step('session_inserted');

  if (error || !createdSession) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('actionFailed') },
      { status: 500 },
    );
  }

  void Promise.allSettled([
    logAppEvent({
      eventName: APP_EVENTS.sessionScheduled,
      locale,
      userId: user.id,
      groupId,
      sessionId: createdSession.id,
      metadata: {
        source:
          sessionsPath === groupDashboardPath(locale, groupId)
            ? 'group_page_session_modal'
            : 'dashboard_sessions_modal',
        session_name: sessionName,
        question_goal: questionGoal,
        timer_seconds: timerSeconds,
        timer_mode: timerMode,
        scheduled_at: scheduledAt.toISOString(),
        share_code: createdSession.share_code,
      },
    }),
    hasEmailEnv()
      ? sendSessionCalendarInvites(createdSession).catch((inviteError) => {
          console.error('sendSessionCalendarInvites failed', {
            sessionId: createdSession.id,
            groupId,
            error:
              inviteError instanceof Error
                ? inviteError.message
                : 'Unknown calendar invite error',
          });
        })
      : Promise.resolve(),
    notifySessionScheduled({
      groupId,
      sessionId: createdSession.id,
      sessionName,
      actorUserId: user.id,
    }),
  ]);
  perf.step('deferred_side_effects_started');
  perf.done({ sessionId: createdSession.id });

  return NextResponse.json({
    ok: true,
    sessionId: createdSession.id,
    redirectTo: groupDashboardPath(locale, groupId),
    calendarInvitesDispatchUrl: `/api/sessions/${createdSession.id}/calendar-invites`,
    message: getStaticSessionScheduledFeedback(locale),
  });
}

function parseScheduledAt(value: string | undefined) {
  if (!value) {
    return new Date();
  }

  const date = new Date(value);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getTime() < Date.now() - 5 * 60 * 1000
  ) {
    return null;
  }

  return date;
}
