create table if not exists public.app_policy_settings (
  id text primary key default 'default' check (id = 'default'),
  trial_question_limit integer not null default 100 check (trial_question_limit between 1 and 10000),
  trial_warning_threshold integer not null default 85 check (trial_warning_threshold between 0 and 10000),
  new_trial_min_questions integer not null default 10 check (new_trial_min_questions between 1 and 10000),
  new_trial_max_questions integer not null default 20 check (new_trial_max_questions between 1 and 10000),
  new_trial_unlock_sessions integer not null default 3 check (new_trial_unlock_sessions between 0 and 1000),
  consistent_trial_question_limit integer not null default 40 check (consistent_trial_question_limit between 1 and 10000),
  default_question_goal integer not null default 10 check (default_question_goal between 1 and 10000),
  max_question_goal integer not null default 500 check (max_question_goal between 1 and 10000),
  per_question_timer_default_seconds integer not null default 90 check (per_question_timer_default_seconds between 1 and 86400),
  global_timer_default_seconds integer not null default 600 check (global_timer_default_seconds between 1 and 86400),
  max_timer_seconds integer not null default 3600 check (max_timer_seconds between 1 and 86400),
  minimum_group_members_to_start integer not null default 2 check (minimum_group_members_to_start between 1 and 100),
  completion_min_members integer not null default 2 check (completion_min_members between 1 and 100),
  completion_max_members integer not null default 5 check (completion_max_members between 1 and 100),
  consistent_trial_unlock_condition_en text not null default 'Maintain review completion',
  consistent_trial_unlock_condition_fr text not null default 'Maintenir la revision',
  paid_unlock_condition_en text not null default 'Immediate access',
  paid_unlock_condition_fr text not null default 'Acces immediat',
  high_risk_session_limit_en text not null default 'Suggested smaller sessions',
  high_risk_session_limit_fr text not null default 'Sessions plus courtes suggerees',
  high_risk_condition_en text not null default 'Low completion or poor consistency',
  high_risk_condition_fr text not null default 'Faible completion ou faible regularite',
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint app_policy_settings_trial_warning_lte_limit
    check (trial_warning_threshold <= trial_question_limit),
  constraint app_policy_settings_trial_range_valid
    check (new_trial_min_questions <= new_trial_max_questions),
  constraint app_policy_settings_question_goal_valid
    check (default_question_goal <= max_question_goal),
  constraint app_policy_settings_timer_valid
    check (
      per_question_timer_default_seconds <= max_timer_seconds
      and global_timer_default_seconds <= max_timer_seconds
    ),
  constraint app_policy_settings_completion_range_valid
    check (completion_min_members <= completion_max_members)
);

insert into public.app_policy_settings (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.app_policy_settings_audit_log (
  id uuid primary key default gen_random_uuid(),
  settings_id text not null default 'default',
  changed_by uuid references public.users(id) on delete set null,
  previous_settings jsonb not null,
  next_settings jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.app_policy_settings enable row level security;
alter table public.app_policy_settings_audit_log enable row level security;

drop policy if exists "Authenticated users can read app policy settings" on public.app_policy_settings;
create policy "Authenticated users can read app policy settings"
on public.app_policy_settings
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read app policy audit log" on public.app_policy_settings_audit_log;
create policy "Authenticated users can read app policy audit log"
on public.app_policy_settings_audit_log
for select
to authenticated
using (false);

create or replace function public.activeboard_policy_int(
  setting_name text,
  fallback_value integer
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    case setting_name
      when 'trial_question_limit' then aps.trial_question_limit
      when 'trial_warning_threshold' then aps.trial_warning_threshold
      when 'max_question_goal' then aps.max_question_goal
      when 'default_question_goal' then aps.default_question_goal
      when 'max_timer_seconds' then aps.max_timer_seconds
      when 'minimum_group_members_to_start' then aps.minimum_group_members_to_start
      else null
    end,
    fallback_value
  )
  from public.app_policy_settings aps
  where aps.id = 'default'
  union all
  select fallback_value
  limit 1;
$$;

create or replace function public.compute_user_tier(
  questions_answered_input integer,
  has_valid_payment_method_input boolean,
  subscription_status_input text
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  trial_limit integer := public.activeboard_policy_int('trial_question_limit', 100);
begin
  if subscription_status_input in ('active', 'trialing') then
    return 'active';
  end if;

  if coalesce(questions_answered_input, 0) < trial_limit then
    return 'trial';
  end if;

  if coalesce(has_valid_payment_method_input, false) then
    return 'dormant';
  end if;

  return 'locked';
end;
$$;

create or replace function public.activeboard_user_has_core_access(actor_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        u.subscription_status in ('active', 'trialing')
        or coalesce(u.questions_answered, 0) < public.activeboard_policy_int('trial_question_limit', 100)
      from public.users u
      where u.id = actor_user_id
    ),
    false
  );
$$;

create or replace function public.activeboard_create_session_fast_v3(
  actor_user_id uuid,
  target_group_id uuid,
  session_name text,
  target_scheduled_at timestamptz,
  target_question_goal integer,
  target_timer_mode text,
  target_timer_seconds integer
)
returns table (
  ok boolean,
  message_key text,
  session_id uuid,
  reused boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  member_count integer;
  existing_session_id uuid;
  created_session_id uuid;
  max_question_goal integer := public.activeboard_policy_int('max_question_goal', 500);
  max_timer_seconds integer := public.activeboard_policy_int('max_timer_seconds', 3600);
  minimum_members integer := public.activeboard_policy_int('minimum_group_members_to_start', 2);
begin
  if actor_user_id is null
    or target_group_id is null
    or nullif(trim(session_name), '') is null
    or target_scheduled_at is null
    or target_question_goal is null
    or target_question_goal < 1
    or target_timer_seconds is null
    or target_timer_seconds < 1
    or target_timer_seconds > max_timer_seconds
  then
    return query select false, 'missingFields', null::uuid, false;
    return;
  end if;

  if not public.activeboard_user_has_core_access(actor_user_id) then
    return query select false, 'upgradeRequiredToScheduleSession', null::uuid, false;
    return;
  end if;

  select count(*)::integer
  into member_count
  from public.group_members gm
  where gm.group_id = target_group_id;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = actor_user_id
  ) then
    return query select false, 'notAuthorized', null::uuid, false;
    return;
  end if;

  if coalesce(member_count, 0) < minimum_members then
    return query select false, 'minimumMembersRequired', null::uuid, false;
    return;
  end if;

  select s.id
  into existing_session_id
  from public.sessions s
  where s.group_id = target_group_id
    and s.name = trim(session_name)
    and s.status in ('scheduled', 'active', 'incomplete')
  order by s.scheduled_at desc
  limit 1;

  if existing_session_id is not null then
    return query select true, 'sessionScheduled', existing_session_id, true;
    return;
  end if;

  insert into public.sessions (
    group_id,
    name,
    scheduled_at,
    timer_mode,
    timer_seconds,
    question_goal,
    created_by,
    leader_id,
    status
  )
  values (
    target_group_id,
    trim(session_name),
    target_scheduled_at,
    case when target_timer_mode = 'global' then 'global' else 'per_question' end,
    target_timer_seconds,
    least(greatest(target_question_goal, 1), max_question_goal),
    actor_user_id,
    actor_user_id,
    'scheduled'
  )
  returning id into created_session_id;

  return query select true, 'sessionScheduled', created_session_id, false;
end;
$$;

grant execute on function public.activeboard_create_session_fast_v3(uuid, uuid, text, timestamptz, integer, text, integer) to authenticated;

create or replace function public.activeboard_start_session_fast(
  actor_user_id uuid,
  target_session_id uuid
)
returns table (
  ok boolean,
  message_key text,
  question_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row record;
  started_at_value timestamptz;
  deadline_value timestamptz;
  question_id_value uuid;
begin
  if actor_user_id is null or target_session_id is null then
    return query select false, 'notAuthorized', null::uuid;
    return;
  end if;

  if not public.activeboard_user_has_core_access(actor_user_id) then
    return query select false, 'upgradeRequiredToJoinSession', null::uuid;
    return;
  end if;

  select
    s.id,
    s.group_id,
    s.status,
    s.leader_id,
    s.timer_mode,
    s.timer_seconds,
    s.question_goal,
    s.started_at
  into session_row
  from public.sessions s
  join public.group_members gm
    on gm.group_id = s.group_id
   and gm.user_id = actor_user_id
  where s.id = target_session_id
  limit 1;

  if session_row.id is null then
    return query select false, 'notAuthorized', null::uuid;
    return;
  end if;

  started_at_value := coalesce(session_row.started_at, timezone('utc', now()));
  deadline_value := case
    when session_row.timer_mode = 'global'
      then started_at_value + make_interval(secs => session_row.timer_seconds)
    else timezone('utc', now()) + make_interval(secs => session_row.timer_seconds)
  end;

  if session_row.status in ('scheduled', 'incomplete') then
    update public.sessions
    set
      status = 'active',
      started_at = started_at_value,
      leader_id = coalesce(session_row.leader_id, actor_user_id)
    where id = target_session_id;

    insert into public.questions (
      session_id,
      asked_by,
      options,
      order_index,
      phase,
      launched_at,
      answer_deadline_at
    )
    values (
      target_session_id,
      actor_user_id,
      '["A","B","C","D","E"]'::jsonb,
      0,
      'answering',
      timezone('utc', now()),
      deadline_value
    )
    on conflict (session_id, order_index)
    do update set
      phase = 'answering',
      launched_at = coalesce(public.questions.launched_at, excluded.launched_at),
      answer_deadline_at = coalesce(public.questions.answer_deadline_at, excluded.answer_deadline_at)
    returning id into question_id_value;
  else
    select q.id
    into question_id_value
    from public.questions q
    where q.session_id = target_session_id
      and q.order_index = 0
    limit 1;
  end if;

  return query select true, 'sessionStarted', question_id_value;
end;
$$;

grant execute on function public.activeboard_start_session_fast(uuid, uuid) to authenticated;
