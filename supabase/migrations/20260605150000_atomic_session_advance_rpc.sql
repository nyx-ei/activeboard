create or replace function public.activeboard_advance_session_question(
  target_session_id uuid,
  actor_user_id uuid,
  current_question_index integer
)
returns table (
  ok boolean,
  code text,
  question_id uuid,
  question_index integer,
  answer_deadline_at timestamptz,
  session_status text
)
language plpgsql
set search_path = public
as $$
declare
  session_row record;
  next_index integer;
  started_at_value timestamptz;
  now_value timestamptz := timezone('utc', now());
  deadline_value timestamptz;
  next_question_id uuid;
  next_question_deadline timestamptz;
begin
  if target_session_id is null
    or actor_user_id is null
    or current_question_index is null
    or current_question_index < 0 then
    return query select false, 'invalidPayload', null::uuid, null::integer, null::timestamptz, null::text;
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
  for update of s;

  if session_row.id is null then
    return query select false, 'notAuthorized', null::uuid, null::integer, null::timestamptz, null::text;
    return;
  end if;

  if session_row.leader_id is distinct from actor_user_id then
    return query select false, 'captainOnlyAction', null::uuid, null::integer, null::timestamptz, session_row.status::text;
    return;
  end if;

  if session_row.status is distinct from 'active'
    or current_question_index >= session_row.question_goal then
    return query select false, 'invalidSessionState', null::uuid, null::integer, null::timestamptz, session_row.status::text;
    return;
  end if;

  next_index := current_question_index + 1;

  if next_index >= session_row.question_goal then
    update public.sessions
    set status = 'incomplete'
    where id = target_session_id;

    return query select true, 'sessionCompleted', null::uuid, next_index, null::timestamptz, 'incomplete'::text;
    return;
  end if;

  started_at_value := coalesce(session_row.started_at, now_value);
  deadline_value := case
    when session_row.timer_mode = 'global'
      then started_at_value + make_interval(secs => session_row.timer_seconds)
    else now_value + make_interval(secs => session_row.timer_seconds)
  end;

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
    next_index,
    'answering',
    now_value,
    deadline_value
  )
  on conflict (session_id, order_index)
  do update set
    phase = 'answering',
    launched_at = coalesce(public.questions.launched_at, excluded.launched_at),
    answer_deadline_at = coalesce(public.questions.answer_deadline_at, excluded.answer_deadline_at)
  returning id, answer_deadline_at
  into next_question_id, next_question_deadline;

  return query
    select
      true,
      'questionAdvanced',
      next_question_id,
      next_index,
      coalesce(next_question_deadline, deadline_value),
      session_row.status::text;
end;
$$;

grant execute on function public.activeboard_advance_session_question(uuid, uuid, integer) to authenticated;
