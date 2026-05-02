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
