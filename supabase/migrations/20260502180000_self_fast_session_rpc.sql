create or replace function public.activeboard_create_session_self_fast(
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
  from public.activeboard_create_session_fast(
    actor_user_id,
    target_group_id,
    session_name,
    target_question_goal,
    target_timer_mode,
    target_timer_seconds
  );
end;
$$;

grant execute on function public.activeboard_create_session_self_fast(uuid, text, integer, text, integer) to authenticated;

create or replace function public.activeboard_start_session_self_fast(
  target_session_id uuid
)
returns table (
  ok boolean,
  message_key text,
  question_id uuid
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor_user_id uuid := auth.uid();
begin
  if actor_user_id is null then
    return query select false, 'notAuthorized', null::uuid;
    return;
  end if;

  return query
  select *
  from public.activeboard_start_session_fast(actor_user_id, target_session_id);
end;
$$;

grant execute on function public.activeboard_start_session_self_fast(uuid) to authenticated;
