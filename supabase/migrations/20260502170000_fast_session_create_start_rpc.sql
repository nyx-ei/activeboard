create or replace function public.activeboard_create_session_fast(
  actor_user_id uuid,
  target_group_id uuid,
  session_name text,
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
set search_path = public
as $$
declare
  member_count integer;
  existing_session_id uuid;
  created_session_id uuid;
  actor_tier text;
begin
  if actor_user_id is null
    or target_group_id is null
    or nullif(trim(session_name), '') is null
    or target_question_goal is null
    or target_question_goal < 1
    or target_timer_seconds is null
    or target_timer_seconds < 1
    or target_timer_seconds > 3600
  then
    return query select false, 'missingFields', null::uuid, false;
    return;
  end if;

  select u.user_tier::text
  into actor_tier
  from public.users u
  where u.id = actor_user_id;

  if coalesce(actor_tier, 'locked') not in ('trial', 'active') then
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

  if coalesce(member_count, 0) < 2 then
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
    timezone('utc', now()),
    case when target_timer_mode = 'global' then 'global' else 'per_question' end,
    target_timer_seconds,
    least(greatest(target_question_goal, 1), 500),
    actor_user_id,
    actor_user_id,
    'scheduled'
  )
  returning id into created_session_id;

  return query select true, 'sessionScheduled', created_session_id, false;
end;
$$;

grant execute on function public.activeboard_create_session_fast(uuid, uuid, text, integer, text, integer) to authenticated;

create or replace function public.activeboard_create_session_fast_v2(payload jsonb)
returns table (
  ok boolean,
  message_key text,
  session_id uuid,
  reused boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid;
  target_group_id uuid;
  session_name text;
  target_question_goal integer;
  target_timer_mode text;
  target_timer_seconds integer;
begin
  actor_user_id := nullif(payload ->> 'actor_user_id', '')::uuid;
  target_group_id := nullif(payload ->> 'target_group_id', '')::uuid;
  session_name := payload ->> 'session_name';
  target_question_goal := coalesce((payload ->> 'target_question_goal')::integer, 0);
  target_timer_mode := payload ->> 'target_timer_mode';
  target_timer_seconds := coalesce((payload ->> 'target_timer_seconds')::integer, 0);

  return query
  select *
  from public.activeboard_create_session_fast(
    actor_user_id,
    target_group_id,
    session_name,
    target_question_goal,
    target_timer_mode,
    target_timer_seconds
  );
exception
  when invalid_text_representation then
    return query select false, 'missingFields', null::uuid, false;
end;
$$;

grant execute on function public.activeboard_create_session_fast_v2(jsonb) to authenticated;

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
  actor_tier text;
  started_at_value timestamptz;
  deadline_value timestamptz;
  question_id_value uuid;
begin
  if actor_user_id is null or target_session_id is null then
    return query select false, 'notAuthorized', null::uuid;
    return;
  end if;

  select u.user_tier::text
  into actor_tier
  from public.users u
  where u.id = actor_user_id;

  if coalesce(actor_tier, 'locked') not in ('trial', 'active') then
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
