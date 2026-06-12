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
  actor_tier text;
begin
  if actor_user_id is null
    or target_group_id is null
    or nullif(trim(session_name), '') is null
    or target_scheduled_at is null
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
    target_scheduled_at,
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

grant execute on function public.activeboard_create_session_fast_v3(uuid, uuid, text, timestamptz, integer, text, integer) to authenticated;

create or replace function public.activeboard_create_session_self_fast_v2(
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
  actor_user_id uuid := auth.uid();
begin
  if actor_user_id is null then
    return query select false, 'notAuthorized', null::uuid, false;
    return;
  end if;

  return query
  select *
  from public.activeboard_create_session_fast_v3(
    actor_user_id,
    target_group_id,
    session_name,
    target_scheduled_at,
    target_question_goal,
    target_timer_mode,
    target_timer_seconds
  );
end;
$$;

grant execute on function public.activeboard_create_session_self_fast_v2(uuid, text, timestamptz, integer, text, integer) to authenticated;
