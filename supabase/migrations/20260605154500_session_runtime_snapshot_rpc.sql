create or replace function public.activeboard_get_session_runtime(
  target_session_id uuid,
  target_question_id uuid default null
)
returns table (
  ok boolean,
  session_status text,
  question_id uuid,
  question_index integer,
  question_phase text,
  answer_deadline_at timestamptz,
  submitted_count bigint,
  member_count bigint
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  session_row record;
  question_row record;
begin
  if actor_user_id is null or target_session_id is null then
    return query
    select false, null::text, null::uuid, null::integer, null::text, null::timestamptz, 0::bigint, 0::bigint;
    return;
  end if;

  select
    s.id,
    s.status,
    s.group_id,
    (
      select count(*)::bigint
      from public.group_members all_members
      where all_members.group_id = s.group_id
    ) as member_count
  into session_row
  from public.sessions s
  join public.group_members gm
    on gm.group_id = s.group_id
   and gm.user_id = actor_user_id
  where s.id = target_session_id
  limit 1;

  if session_row.id is null then
    return query
    select false, null::text, null::uuid, null::integer, null::text, null::timestamptz, 0::bigint, 0::bigint;
    return;
  end if;

  if target_question_id is not null then
    select q.id, q.order_index, q.phase, q.answer_deadline_at
    into question_row
    from public.questions q
    where q.id = target_question_id
      and q.session_id = target_session_id
    limit 1;
  else
    select q.id, q.order_index, q.phase, q.answer_deadline_at
    into question_row
    from public.questions q
    where q.session_id = target_session_id
      and q.launched_at is not null
    order by q.order_index desc
    limit 1;
  end if;

  return query
  select
    true,
    session_row.status::text,
    question_row.id,
    question_row.order_index,
    question_row.phase::text,
    question_row.answer_deadline_at,
    case
      when question_row.id is null then 0::bigint
      else (
        select count(*)::bigint
        from public.answers a
        where a.question_id = question_row.id
      )
    end,
    coalesce(session_row.member_count, 0::bigint);
end;
$$;

grant execute on function public.activeboard_get_session_runtime(uuid, uuid) to authenticated;
