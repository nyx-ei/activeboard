import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';

import type { AppLocale } from '@/i18n/routing';
import { deriveUserTier, getUserTierCapabilities } from '@/lib/billing/user-tier';
import { hasEmailEnv } from '@/lib/env';
import { APP_EVENTS } from '@/lib/logging/events';
import { logAppEvent } from '@/lib/logging/logger';
import { sendSessionCalendarInvites } from '@/lib/notifications/calendar-invites';
import { createGroupNotifications } from '@/lib/notifications/in-app';
import { createPerfTracker } from '@/lib/observability/perf';
import { getAppPolicySettings } from '@/lib/policy/app-policy';
import {
  getPlanNextAccess,
  hasPaidAccess,
} from '@/lib/session/plan-next-access';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateInviteCode } from '@/lib/utils';

type CreateSessionPayload = {
  locale?: string;
  groupId?: string;
  returnTo?: string;
  sessionName?: string;
  scheduledAt?: string;
  questionGoal?: number;
  timerMode?: 'per_question' | 'global';
  timerSeconds?: number;
  meetingLink?: string;
  forceCreate?: boolean;
  continuitySessionId?: string;
  participantUserIds?: unknown;
};

function groupDashboardPath(locale: AppLocale, groupId: string) {
  return `/${locale}/dashboard?groupId=${encodeURIComponent(groupId)}`;
}

function getStaticSessionScheduledFeedback(locale: AppLocale) {
  return locale === 'fr' ? 'Session programmée.' : 'Session scheduled.';
}

function getCreateSessionApiValidationFeedback(
  locale: AppLocale,
  reason:
    | 'missing_session_context'
    | 'missing_session_name'
    | 'invalid_scheduled_at'
    | 'invalid_question_goal'
    | 'invalid_timer',
  maximum?: number,
) {
  if (locale === 'fr') {
    switch (reason) {
      case 'missing_session_context':
        return 'Choisis un pool ou au moins 2 participants avant de creer une session.';
      case 'missing_session_name':
        return 'Ajoute un nom de session.';
      case 'invalid_scheduled_at':
        return 'Choisis une date et une heure valides.';
      case 'invalid_question_goal':
        return `Le nombre de questions doit etre compris entre 1 et ${maximum ?? 'le maximum autorise'}.`;
      case 'invalid_timer':
        return `Le minuteur doit etre compris entre 1 et ${maximum ?? 'le maximum autorise'} secondes.`;
    }
  }

  switch (reason) {
    case 'missing_session_context':
      return 'Choose a pool or at least 2 participants before creating a session.';
    case 'missing_session_name':
      return 'Add a session name.';
    case 'invalid_scheduled_at':
      return 'Choose a valid date and time.';
    case 'invalid_question_goal':
      return `Number of questions must be between 1 and ${maximum ?? 'the maximum allowed'}.`;
    case 'invalid_timer':
      return `Timer must be between 1 and ${maximum ?? 'the maximum allowed'} seconds.`;
  }
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
  const participantUserIds = parseParticipantUserIds(body?.participantUserIds);
  const returnTo = body?.returnTo ?? '';
  const sessionName = body?.sessionName?.trim() ?? '';
  const scheduledAt = parseScheduledAt(body?.scheduledAt);
  const questionGoal = Number(body?.questionGoal);
  const timerMode = body?.timerMode === 'global' ? 'global' : 'per_question';
  const timerSeconds = Number(body?.timerSeconds);
  const meetingLink = body?.meetingLink?.trim() ?? '';
  const forceCreate = body?.forceCreate === true;
  const continuitySessionId = body?.continuitySessionId ?? '';
  const policy = await getAppPolicySettings();
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

  const validationMessage =
    !groupId && participantUserIds.length === 0
      ? getCreateSessionApiValidationFeedback(
          locale,
          'missing_session_context',
        )
      : !sessionName
        ? getCreateSessionApiValidationFeedback(
            locale,
            'missing_session_name',
          )
        : !scheduledAt
          ? getCreateSessionApiValidationFeedback(
              locale,
              'invalid_scheduled_at',
            )
          : !Number.isFinite(questionGoal) ||
              questionGoal < 1 ||
              questionGoal > policy.maxQuestionGoal
            ? getCreateSessionApiValidationFeedback(
                locale,
                'invalid_question_goal',
                policy.maxQuestionGoal,
              )
            : !Number.isFinite(timerSeconds) ||
                timerSeconds < 1 ||
                timerSeconds > policy.maxTimerSeconds
              ? getCreateSessionApiValidationFeedback(
                  locale,
                  'invalid_timer',
                  policy.maxTimerSeconds,
                )
              : null;

  if (validationMessage) {
    return NextResponse.json(
      { ok: false, message: validationMessage },
      { status: 400 },
    );
  }
  if (!scheduledAt) {
    return NextResponse.json(
      {
        ok: false,
        message: getCreateSessionApiValidationFeedback(
          locale,
          'invalid_scheduled_at',
        ),
      },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();

  if (participantUserIds.length > 0) {
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

    const memberUserIds = [
      ...new Set([user.id, ...participantUserIds].filter(Boolean)),
    ];
    perf.setContext({ userId: user.id, locale });

    if (memberUserIds.length < policy.minimumGroupMembersToStart) {
      return NextResponse.json(
        { ok: false, message: await getFeedback('minimumMembersRequired') },
        { status: 400 },
      );
    }

    const [
      userTierResult,
      usersResult,
      selectedGroupMembersResult,
      selectedGroupResult,
      planAccess,
    ] = await Promise.all([
        admin
          .schema('public')
          .from('users')
          .select(
            'questions_answered, has_valid_payment_method, subscription_status',
          )
          .eq('id', user.id)
          .maybeSingle(),
        admin
          .schema('public')
          .from('users')
          .select('id, has_valid_payment_method, subscription_status, user_tier')
          .in('id', memberUserIds),
        groupId
          ? admin
              .schema('public')
              .from('group_members')
              .select('user_id')
              .eq('group_id', groupId)
              .in('user_id', memberUserIds)
          : Promise.resolve({ data: [] }),
        groupId
          ? admin
              .schema('public')
              .from('groups')
              .select('name')
              .eq('id', groupId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        getPlanNextAccess(user.id, policy),
      ]);
    perf.step('session_first_guards_loaded');

    const userTier = userTierResult.data
      ? deriveUserTier({
          questionsAnswered: userTierResult.data.questions_answered ?? 0,
          hasValidPaymentMethod:
            userTierResult.data.has_valid_payment_method ?? false,
          subscriptionStatus: userTierResult.data.subscription_status ?? 'none',
          policy,
        })
      : 'locked';
    if (!getUserTierCapabilities(userTier).canCreateSession) {
      return NextResponse.json(
        {
          ok: false,
          message: await getFeedback('upgradeRequiredToScheduleSession'),
        },
        { status: 403 },
      );
    }

    if ((usersResult.data ?? []).length !== memberUserIds.length) {
      return NextResponse.json(
        { ok: false, message: await getFeedback('actionFailed') },
        { status: 400 },
      );
    }

    const selectedGroupMemberIds = new Set(
      (selectedGroupMembersResult.data ?? [])
        .map((member) => member.user_id)
        .filter((memberId): memberId is string => Boolean(memberId)),
    );
    const externalCandidateIds = memberUserIds.filter(
      (memberUserId) => !selectedGroupMemberIds.has(memberUserId),
    );

    if (externalCandidateIds.length > 0 && !planAccess.canInviteCandidates) {
      return NextResponse.json(
        { ok: false, message: await getFeedback('notAuthorized') },
        { status: 403 },
      );
    }

    if (externalCandidateIds.length > 0) {
      const paidUserIds = new Set(
        (usersResult.data ?? [])
          .filter((candidate) => hasPaidAccess(candidate))
          .map((candidate) => candidate.id),
      );
      const hasUnpaidExternalCandidate = externalCandidateIds.some(
        (candidateId) => !paidUserIds.has(candidateId),
      );

      if (hasUnpaidExternalCandidate) {
        return NextResponse.json(
          { ok: false, message: await getFeedback('notAuthorized') },
          { status: 403 },
        );
      }
    }

    const inviteCode = await createUniqueInviteCode(admin);
    const { data: createdGroup, error: groupError } = await admin
      .schema('public')
      .from('groups')
      .insert({
        name: getSessionFirstGroupName(
          locale,
          selectedGroupResult.data?.name,
          scheduledAt,
        ),
        invite_code: inviteCode,
        created_by: user.id,
        difficulty_level: 'medium',
        group_kind: 'session_test',
        max_members: Math.max(
          memberUserIds.length,
          policy.minimumGroupMembersToStart,
        ),
      })
      .select('id')
      .single();

    if (groupError || !createdGroup?.id) {
      return NextResponse.json(
        { ok: false, message: await getFeedback('actionFailed') },
        { status: 500 },
      );
    }
    perf.step('session_first_group_created');

    const { error: membersError } = await admin
      .schema('public')
      .from('group_members')
      .upsert(
        memberUserIds.map((memberUserId) => ({
          group_id: createdGroup.id,
          user_id: memberUserId,
          is_founder: memberUserId === user.id,
        })),
        { onConflict: 'group_id,user_id' },
      );

    if (membersError) {
      return NextResponse.json(
        { ok: false, message: await getFeedback('actionFailed') },
        { status: 500 },
      );
    }
    perf.step('session_first_members_saved');

    const { data: createdSession, error: sessionError } = await admin
      .schema('public')
      .from('sessions')
      .insert({
        group_id: createdGroup.id,
        name: sessionName,
        scheduled_at: scheduledAt.toISOString(),
        meeting_link: meetingLink || null,
        timer_mode: timerMode,
        timer_seconds: timerSeconds,
        question_goal: Math.min(
          Math.round(questionGoal),
          policy.maxQuestionGoal,
        ),
        created_by: user.id,
        leader_id: user.id,
        status: 'scheduled',
      })
      .select(
        'id, group_id, name, scheduled_at, share_code, meeting_link, timer_seconds',
      )
      .single();

    if (sessionError || !createdSession) {
      return NextResponse.json(
        { ok: false, message: await getFeedback('actionFailed') },
        { status: 500 },
      );
    }
    perf.step('session_first_session_created');

    void admin
      .schema('public')
      .from('groups')
      .update({ last_session_id: createdSession.id })
      .eq('id', createdGroup.id);

    void Promise.allSettled([
      logAppEvent({
        eventName: APP_EVENTS.sessionScheduled,
        locale,
        userId: user.id,
        groupId: createdGroup.id,
        sessionId: createdSession.id,
        metadata: {
          source: 'session_first_dashboard_modal',
          session_name: sessionName,
          participant_count: memberUserIds.length,
          question_goal: questionGoal,
          timer_seconds: timerSeconds,
          timer_mode: timerMode,
          scheduled_at: scheduledAt.toISOString(),
          share_code: createdSession.share_code,
          meeting_link_present: Boolean(meetingLink),
        },
      }),
      hasEmailEnv()
        ? sendSessionCalendarInvites(createdSession).catch((inviteError) => {
            console.error('sendSessionCalendarInvites failed', {
              sessionId: createdSession.id,
              groupId: createdGroup.id,
              error:
                inviteError instanceof Error
                  ? inviteError.message
                  : 'Unknown calendar invite error',
            });
          })
        : Promise.resolve(),
      notifySessionScheduled({
        groupId: createdGroup.id,
        sessionId: createdSession.id,
        sessionName,
        actorUserId: user.id,
      }),
    ]);

    perf.done({
      sessionId: createdSession.id,
      groupId: createdGroup.id,
      sessionFirst: true,
    });

    return NextResponse.json({
      ok: true,
      sessionId: createdSession.id,
      redirectTo: groupDashboardPath(locale, createdGroup.id),
      calendarInvitesDispatchUrl: `/api/sessions/${createdSession.id}/calendar-invites`,
      message: getStaticSessionScheduledFeedback(locale),
    });
  }

  perf.setContext({ groupId, locale });

  const { data: fastRows, error: fastError } = forceCreate
    ? { data: null, error: null }
    : await (
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
        target_question_goal: Math.min(
          Math.round(questionGoal),
          policy.maxQuestionGoal,
        ),
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
      if (meetingLink) {
        void createSupabaseAdminClient()
          .schema('public')
          .from('sessions')
          .update({ meeting_link: meetingLink })
          .eq('id', fastResult.session_id);
      }

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

  const [
    userTierResult,
    groupMembersResult,
    existingResult,
    continuitySessionResult,
  ] = await Promise.all([
      admin
        .schema('public')
        .from('users')
        .select('questions_answered, has_valid_payment_method, subscription_status')
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
      continuitySessionId
        ? admin
            .schema('public')
            .from('sessions')
            .select('id')
            .eq('id', continuitySessionId)
            .eq('group_id', groupId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
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

  const userTier = userTierResult.data
    ? deriveUserTier({
        questionsAnswered: userTierResult.data.questions_answered ?? 0,
        hasValidPaymentMethod:
          userTierResult.data.has_valid_payment_method ?? false,
        subscriptionStatus: userTierResult.data.subscription_status ?? 'none',
        policy,
      })
    : 'locked';
  const isContinuityPlan = Boolean(continuitySessionResult.data?.id);
  if (
    !getUserTierCapabilities(userTier).canCreateSession &&
    !isContinuityPlan
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: await getFeedback('upgradeRequiredToScheduleSession'),
      },
      { status: 403 },
    );
  }

  if (groupMembers.length < policy.minimumGroupMembersToStart) {
    return NextResponse.json(
      { ok: false, message: await getFeedback('minimumMembersRequired') },
      { status: 400 },
    );
  }

  if (!forceCreate && existingResult.data?.id) {
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
      meeting_link: meetingLink || null,
      timer_mode: timerMode,
      timer_seconds: timerSeconds,
      question_goal: Math.min(Math.round(questionGoal), policy.maxQuestionGoal),
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
        meeting_link_present: Boolean(meetingLink),
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

function parseParticipantUserIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            item,
          ),
        ),
    ),
  ];
}

function getSessionFirstGroupName(
  locale: AppLocale,
  poolName: string | null | undefined,
  scheduledAt: Date,
) {
  const baseName =
    poolName?.trim() || (locale === 'fr' ? 'Séance test' : 'Test session');
  const dateLabel = new Intl.DateTimeFormat(
    locale === 'fr' ? 'fr-CA' : 'en-CA',
    {
      day: '2-digit',
      month: 'short',
    },
  )
    .format(scheduledAt)
    .replace('.', '');
  const name = `${baseName} · ${dateLabel}`;

  return name.length > 80 ? name.slice(0, 80).trim() : name;
}

async function createUniqueInviteCode(
  admin: ReturnType<typeof createSupabaseAdminClient>,
) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generateInviteCode();
    const { data: existing } = await admin
      .schema('public')
      .from('groups')
      .select('id')
      .eq('invite_code', candidate)
      .maybeSingle();

    if (!existing) {
      return candidate;
    }
  }

  throw new Error('Unable to generate a unique invite code');
}
