#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env.local'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase admin env. Expected NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const TEST_PASSWORD = 'TestActiveboard123!';

const TEST_USERS = [
  {
    key: 'captain',
    email: 'qa.captain1@activeboard.local',
    displayName: 'QA Captain',
    examSession: 'august_september_2026',
    locale: 'fr',
    questionBanks: ['cmc_prep', 'uworld'],
    timezone: 'Africa/Lagos',
    availabilityGrid: {
      monday: [19, 20],
      tuesday: [],
      wednesday: [19, 20],
      thursday: [],
      friday: [18, 19],
      saturday: [10, 11],
      sunday: [],
    },
  },
  {
    key: 'member2',
    email: 'qa.member2@activeboard.local',
    displayName: 'QA Member 2',
    examSession: 'august_september_2026',
    locale: 'fr',
    questionBanks: ['cmc_prep', 'uworld'],
    timezone: 'Africa/Lagos',
    availabilityGrid: {
      monday: [19],
      tuesday: [],
      wednesday: [20],
      thursday: [],
      friday: [18],
      saturday: [10],
      sunday: [],
    },
  },
  {
    key: 'member3',
    email: 'qa.member3@activeboard.local',
    displayName: 'QA Member 3',
    examSession: 'august_september_2026',
    locale: 'fr',
    questionBanks: ['cmc_prep', 'uworld'],
    timezone: 'Africa/Lagos',
    availabilityGrid: {
      monday: [20],
      tuesday: [],
      wednesday: [19],
      thursday: [],
      friday: [18],
      saturday: [11],
      sunday: [],
    },
  },
  {
    key: 'member4',
    email: 'qa.member4@activeboard.local',
    displayName: 'QA Member 4',
    examSession: 'august_september_2026',
    locale: 'fr',
    questionBanks: ['cmc_prep', 'uworld'],
    timezone: 'Africa/Lagos',
    availabilityGrid: {
      monday: [19],
      tuesday: [],
      wednesday: [19, 20],
      thursday: [],
      friday: [],
      saturday: [10, 11],
      sunday: [],
    },
  },
  {
    key: 'observer',
    email: 'qa.observer5@activeboard.local',
    displayName: 'QA Observer',
    examSession: 'planning_ahead',
    locale: 'fr',
    questionBanks: ['cmc_prep'],
    timezone: 'Africa/Lagos',
    availabilityGrid: {
      monday: [],
      tuesday: [18],
      wednesday: [],
      thursday: [18],
      friday: [],
      saturday: [9, 10],
      sunday: [],
    },
  },
];

const TEST_GROUPS = [
  {
    key: 'main',
    name: 'QA Test - Main Group',
    inviteCode: 'QAG001',
    createdBy: 'captain',
    memberships: [
      { userKey: 'captain', isFounder: true },
      { userKey: 'member2', isFounder: false },
      { userKey: 'member3', isFounder: false },
      { userKey: 'member4', isFounder: false },
    ],
    schedules: [
      { weekday: 'monday', start_time: '19:00', end_time: '21:00', question_goal: 20 },
      { weekday: 'wednesday', start_time: '19:00', end_time: '21:00', question_goal: 15 },
    ],
  },
  {
    key: 'side',
    name: 'QA Test - Side Group',
    inviteCode: 'QAG002',
    createdBy: 'observer',
    memberships: [
      { userKey: 'observer', isFounder: true },
      { userKey: 'member4', isFounder: false },
    ],
    schedules: [{ weekday: 'saturday', start_time: '10:00', end_time: '12:00', question_goal: 12 }],
  },
];

const TEST_SESSIONS = [
  {
    key: 'scheduled_main',
    name: 'QA Scheduled Session',
    groupKey: 'main',
    shareCode: 'QAS001',
    leaderKey: 'captain',
    createdBy: 'captain',
    status: 'scheduled',
    timerMode: 'per_question',
    timerSeconds: 75,
    questionGoal: 12,
    scheduledAtOffsetHours: 24,
  },
  {
    key: 'active_main',
    name: 'QA Active Session',
    groupKey: 'main',
    shareCode: 'QAA002',
    leaderKey: 'captain',
    createdBy: 'captain',
    status: 'active',
    timerMode: 'per_question',
    timerSeconds: 90,
    questionGoal: 8,
    scheduledAtOffsetHours: -2,
    startedAtOffsetMinutes: -20,
  },
  {
    key: 'completed_main',
    name: 'QA Completed Session',
    groupKey: 'main',
    shareCode: 'QAC003',
    leaderKey: 'captain',
    createdBy: 'captain',
    status: 'completed',
    timerMode: 'per_question',
    timerSeconds: 60,
    questionGoal: 3,
    scheduledAtOffsetHours: -72,
    startedAtOffsetHours: -71.5,
    endedAtOffsetHours: -71,
  },
  {
    key: 'scheduled_side',
    name: 'QA Side Session',
    groupKey: 'side',
    shareCode: 'QAS004',
    leaderKey: 'observer',
    createdBy: 'observer',
    status: 'scheduled',
    timerMode: 'global',
    timerSeconds: 900,
    questionGoal: 10,
    scheduledAtOffsetHours: 36,
  },
];

function isoFromOffset({ hours = 0, minutes = 0 }) {
  return new Date(Date.now() + hours * 60 * 60 * 1000 + minutes * 60 * 1000).toISOString();
}

async function listAllAuthUsers() {
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw error;
    }
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < 200) {
      break;
    }
    page += 1;
  }
  return users;
}

async function cleanupQaData() {
  const testEmails = TEST_USERS.map((user) => user.email);
  const groupNames = TEST_GROUPS.map((group) => group.name);

  const [{ data: userRows }, { data: groupRows }] = await Promise.all([
    supabase.schema('public').from('users').select('id, email').in('email', testEmails),
    supabase.schema('public').from('groups').select('id, name').in('name', groupNames),
  ]);

  const userIds = (userRows ?? []).map((row) => row.id);
  const groupIds = (groupRows ?? []).map((row) => row.id);

  let sessionIds = [];
  let questionIds = [];

  if (groupIds.length > 0) {
    const { data: sessions } = await supabase.schema('public').from('sessions').select('id').in('group_id', groupIds);
    sessionIds = (sessions ?? []).map((session) => session.id);
  }

  if (sessionIds.length > 0) {
    const { data: questions } = await supabase.schema('public').from('questions').select('id').in('session_id', sessionIds);
    questionIds = (questions ?? []).map((question) => question.id);
  }

  if (questionIds.length > 0) {
    await supabase.schema('public').from('question_classifications').delete().in('question_id', questionIds);
    await supabase.schema('public').from('personal_reflections').delete().in('question_id', questionIds);
    await supabase.schema('public').from('answers').delete().in('question_id', questionIds);
  }

  if (sessionIds.length > 0) {
    await supabase.schema('public').from('session_email_reminders').delete().in('session_id', sessionIds);
    await supabase.schema('public').from('session_calendar_invites').delete().in('session_id', sessionIds);
    await supabase.schema('public').from('questions').delete().in('session_id', sessionIds);
    await supabase.schema('public').from('sessions').delete().in('id', sessionIds);
  }

  if (groupIds.length > 0) {
    await supabase.schema('public').from('group_invites').delete().in('group_id', groupIds);
    await supabase.schema('public').from('group_weekly_schedules').delete().in('group_id', groupIds);
    await supabase.schema('public').from('group_members').delete().in('group_id', groupIds);
    await supabase.schema('public').from('groups').delete().in('id', groupIds);
  }

  if (userIds.length > 0) {
    await supabase.schema('public').from('user_schedules').delete().in('user_id', userIds);
    await supabase.schema('public').from('users').delete().in('id', userIds);
  }

  const authUsers = await listAllAuthUsers();
  const authUsersToDelete = authUsers.filter((user) => testEmails.includes((user.email ?? '').toLowerCase()));
  for (const authUser of authUsersToDelete) {
    await supabase.auth.admin.deleteUser(authUser.id);
  }
}

async function createAuthAndProfileUsers() {
  const userMap = new Map();

  for (const user of TEST_USERS) {
    const { data: createdAuthUser, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: user.displayName,
        locale: user.locale,
        exam_session: user.examSession,
        question_banks: user.questionBanks,
      },
    });

    if (authError || !createdAuthUser?.user?.id) {
      throw authError ?? new Error(`Failed to create auth user for ${user.email}`);
    }

    const userId = createdAuthUser.user.id;

    const { error: profileError } = await supabase.schema('public').from('users').upsert({
      id: userId,
      email: user.email,
      display_name: user.displayName,
      locale: user.locale,
      exam_session: user.examSession,
      question_banks: user.questionBanks,
      user_tier: 'trial',
      subscription_status: 'none',
      questions_answered: 0,
    });

    if (profileError) {
      throw profileError;
    }

    const { error: scheduleError } = await supabase.schema('public').from('user_schedules').upsert({
      user_id: userId,
      timezone: user.timezone,
      availability_grid: user.availabilityGrid,
    });

    if (scheduleError) {
      throw scheduleError;
    }

    userMap.set(user.key, { ...user, id: userId });
  }

  return userMap;
}

async function createGroups(userMap) {
  const groupMap = new Map();

  for (const group of TEST_GROUPS) {
    const creator = userMap.get(group.createdBy);
    const { data: insertedGroup, error: groupError } = await supabase
      .schema('public')
      .from('groups')
      .insert({
        name: group.name,
        invite_code: group.inviteCode,
        created_by: creator.id,
        meeting_link: 'https://meet.google.com/qa-activeboard-room',
      })
      .select('id, name, invite_code')
      .single();

    if (groupError || !insertedGroup) {
      throw groupError ?? new Error(`Failed to create group ${group.name}`);
    }

    const memberships = group.memberships.map((membership) => ({
      group_id: insertedGroup.id,
      user_id: userMap.get(membership.userKey).id,
      is_founder: membership.isFounder,
    }));

    const { error: membershipError } = await supabase.schema('public').from('group_members').insert(memberships);
    if (membershipError) {
      throw membershipError;
    }

    if (group.schedules.length > 0) {
      const { error: scheduleError } = await supabase
        .schema('public')
        .from('group_weekly_schedules')
        .insert(
          group.schedules.map((schedule) => ({
            group_id: insertedGroup.id,
            weekday: schedule.weekday,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            question_goal: schedule.question_goal,
          })),
        );

      if (scheduleError) {
        throw scheduleError;
      }
    }

    groupMap.set(group.key, { ...group, id: insertedGroup.id, inviteCode: insertedGroup.invite_code });
  }

  return groupMap;
}

async function createSessions(groupMap, userMap) {
  const sessionMap = new Map();

  for (const session of TEST_SESSIONS) {
    const { data: insertedSession, error: sessionError } = await supabase
      .schema('public')
      .from('sessions')
      .insert({
        group_id: groupMap.get(session.groupKey).id,
        created_by: userMap.get(session.createdBy).id,
        leader_id: userMap.get(session.leaderKey).id,
        name: session.name,
        share_code: session.shareCode,
        scheduled_at: isoFromOffset({ hours: session.scheduledAtOffsetHours }),
        status: session.status,
        timer_mode: session.timerMode,
        timer_seconds: session.timerSeconds,
        question_goal: session.questionGoal,
        started_at:
          typeof session.startedAtOffsetMinutes === 'number'
            ? isoFromOffset({ minutes: session.startedAtOffsetMinutes })
            : typeof session.startedAtOffsetHours === 'number'
              ? isoFromOffset({ hours: session.startedAtOffsetHours })
              : null,
        ended_at: typeof session.endedAtOffsetHours === 'number' ? isoFromOffset({ hours: session.endedAtOffsetHours }) : null,
      })
      .select('id, name, share_code')
      .single();

    if (sessionError || !insertedSession) {
      throw sessionError ?? new Error(`Failed to create session ${session.name}`);
    }

    sessionMap.set(session.key, { ...session, id: insertedSession.id, shareCode: insertedSession.share_code });
  }

  return sessionMap;
}

async function seedQuestionsAndAnswers(sessionMap, userMap) {
  const activeSession = sessionMap.get('active_main');
  const completedSession = sessionMap.get('completed_main');

  const { data: activeQuestion, error: activeQuestionError } = await supabase
    .schema('public')
    .from('questions')
    .insert({
      session_id: activeSession.id,
      asked_by: userMap.get('captain').id,
      body: 'QA active question: which initial test order is the most appropriate?',
      options: ['A', 'B', 'C', 'D', 'E'],
      order_index: 0,
      phase: 'answering',
      launched_at: isoFromOffset({ minutes: -8 }),
      answer_deadline_at: isoFromOffset({ minutes: 12 }),
    })
    .select('id')
    .single();

  if (activeQuestionError || !activeQuestion) {
    throw activeQuestionError ?? new Error('Failed to create active question');
  }

  const { error: activeAnswersError } = await supabase.schema('public').from('answers').insert([
    {
      question_id: activeQuestion.id,
      user_id: userMap.get('member2').id,
      selected_option: 'A',
      confidence: 'low',
      is_correct: null,
      answered_at: isoFromOffset({ minutes: -6 }),
    },
    {
      question_id: activeQuestion.id,
      user_id: userMap.get('member3').id,
      selected_option: 'C',
      confidence: 'medium',
      is_correct: null,
      answered_at: isoFromOffset({ minutes: -5 }),
    },
  ]);

  if (activeAnswersError) {
    throw activeAnswersError;
  }

  const completedQuestionsPayload = [
    {
      body: 'QA completed question 1',
      order_index: 0,
      correct_option: 'B',
      launched_at: isoFromOffset({ hours: -71.4 }),
      answer_deadline_at: isoFromOffset({ hours: -71.39 }),
    },
    {
      body: 'QA completed question 2',
      order_index: 1,
      correct_option: 'D',
      launched_at: isoFromOffset({ hours: -71.3 }),
      answer_deadline_at: isoFromOffset({ hours: -71.29 }),
    },
    {
      body: 'QA completed question 3',
      order_index: 2,
      correct_option: 'A',
      launched_at: isoFromOffset({ hours: -71.2 }),
      answer_deadline_at: isoFromOffset({ hours: -71.19 }),
    },
  ];

  const { data: completedQuestions, error: completedQuestionsError } = await supabase
    .schema('public')
    .from('questions')
    .insert(
      completedQuestionsPayload.map((question) => ({
        session_id: completedSession.id,
        asked_by: userMap.get('captain').id,
        body: question.body,
        options: ['A', 'B', 'C', 'D', 'E'],
        order_index: question.order_index,
        phase: 'closed',
        launched_at: question.launched_at,
        answer_deadline_at: question.answer_deadline_at,
        correct_option: question.correct_option,
      })),
    )
    .select('id, order_index, correct_option');

  if (completedQuestionsError || !completedQuestions) {
    throw completedQuestionsError ?? new Error('Failed to create completed questions');
  }

  const questionByOrder = new Map(completedQuestions.map((question) => [question.order_index, question]));
  const completedAnswers = [
    { orderIndex: 0, userKey: 'captain', selected: 'B', confidence: 'high', isCorrect: true, hours: -71.38 },
    { orderIndex: 0, userKey: 'member2', selected: 'B', confidence: 'medium', isCorrect: true, hours: -71.37 },
    { orderIndex: 0, userKey: 'member3', selected: 'A', confidence: 'high', isCorrect: false, hours: -71.36 },
    { orderIndex: 0, userKey: 'member4', selected: 'C', confidence: 'low', isCorrect: false, hours: -71.35 },
    { orderIndex: 1, userKey: 'captain', selected: 'D', confidence: 'high', isCorrect: true, hours: -71.28 },
    { orderIndex: 1, userKey: 'member2', selected: 'C', confidence: 'medium', isCorrect: false, hours: -71.27 },
    { orderIndex: 1, userKey: 'member3', selected: 'D', confidence: 'medium', isCorrect: true, hours: -71.26 },
    { orderIndex: 1, userKey: 'member4', selected: 'D', confidence: 'low', isCorrect: true, hours: -71.25 },
    { orderIndex: 2, userKey: 'captain', selected: 'A', confidence: 'medium', isCorrect: true, hours: -71.18 },
    { orderIndex: 2, userKey: 'member2', selected: 'E', confidence: 'low', isCorrect: false, hours: -71.17 },
    { orderIndex: 2, userKey: 'member3', selected: 'A', confidence: 'high', isCorrect: true, hours: -71.16 },
    { orderIndex: 2, userKey: 'member4', selected: 'B', confidence: 'medium', isCorrect: false, hours: -71.15 },
  ];

  const { error: completedAnswersError } = await supabase
    .schema('public')
    .from('answers')
    .insert(
      completedAnswers.map((answer) => ({
        question_id: questionByOrder.get(answer.orderIndex).id,
        user_id: userMap.get(answer.userKey).id,
        selected_option: answer.selected,
        confidence: answer.confidence,
        is_correct: answer.isCorrect,
        answered_at: isoFromOffset({ hours: answer.hours }),
      })),
    );

  if (completedAnswersError) {
    throw completedAnswersError;
  }
}

async function refreshAnalytics() {
  await supabase.rpc('refresh_dashboard_user_profile_analytics');
}

function printSummary(groupMap, sessionMap) {
  console.log('\nQA test data created successfully.\n');
  console.log('Test accounts');
  console.log('-------------');
  for (const user of TEST_USERS) {
    console.log(`- ${user.displayName}: ${user.email}`);
  }
  console.log(`Password: ${TEST_PASSWORD}\n`);

  console.log('Groups');
  console.log('------');
  for (const group of TEST_GROUPS) {
    const createdGroup = groupMap.get(group.key);
    console.log(`- ${createdGroup.name} (invite code: ${createdGroup.inviteCode})`);
  }

  console.log('\nSessions');
  console.log('--------');
  for (const session of TEST_SESSIONS) {
    const createdSession = sessionMap.get(session.key);
    console.log(`- ${createdSession.name} (${createdSession.status}) -> ${createdSession.shareCode}`);
  }
}

async function main() {
  const mode = process.argv[2] ?? 'seed';

  if (mode === 'cleanup') {
    await cleanupQaData();
    console.log('QA test data cleaned up successfully.');
    return;
  }

  await cleanupQaData();
  const userMap = await createAuthAndProfileUsers();
  const groupMap = await createGroups(userMap);
  const sessionMap = await createSessions(groupMap, userMap);
  await seedQuestionsAndAnswers(sessionMap, userMap);
  await refreshAnalytics();
  printSummary(groupMap, sessionMap);
}

main().catch((error) => {
  console.error('QA test data script failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
