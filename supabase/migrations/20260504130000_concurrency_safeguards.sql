do $$
begin
  if not exists (select 1 from pg_type where typname = 'answer_state') then
    create type public.answer_state as enum ('submitted', 'skipped');
  end if;
end $$;

alter table public.answers
  add column if not exists answer_state public.answer_state not null default 'submitted',
  add column if not exists answer_request_sequence bigint not null default 0,
  add column if not exists answer_request_mode text not null default 'submit';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'answers_request_mode_check'
  ) then
    alter table public.answers
      add constraint answers_request_mode_check
      check (answer_request_mode in ('submit', 'timeout'));
  end if;
end $$;

create index if not exists idx_answers_user_question_sequence
  on public.answers (user_id, question_id, answer_request_sequence desc);

create or replace function public.activeboard_save_session_answer_concurrent(
  target_question_id uuid,
  selected_option_input text,
  confidence_input text,
  request_sequence_input bigint,
  request_mode_input text
)
returns table (
  applied boolean,
  selected_option text,
  confidence text,
  answer_state text,
  request_sequence bigint,
  request_mode text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  normalized_mode text := case
    when request_mode_input = 'timeout' then 'timeout'
    else 'submit'
  end;
  normalized_sequence bigint := greatest(coalesce(request_sequence_input, 0), 0);
begin
  if actor_user_id is null then
    return query
    select false, null::text, null::text, null::text, 0::bigint, normalized_mode;
    return;
  end if;

  insert into public.answers (
    question_id,
    user_id,
    answer_state,
    selected_option,
    confidence,
    answer_request_sequence,
    answer_request_mode,
    answered_at
  )
  values (
    target_question_id,
    actor_user_id,
    case when normalized_mode = 'timeout' then 'skipped'::public.answer_state else 'submitted'::public.answer_state end,
    selected_option_input,
    confidence_input,
    normalized_sequence,
    normalized_mode,
    timezone('utc', now())
  )
  on conflict (question_id, user_id) do update
  set
    answer_state = excluded.answer_state,
    selected_option = excluded.selected_option,
    confidence = excluded.confidence,
    answer_request_sequence = excluded.answer_request_sequence,
    answer_request_mode = excluded.answer_request_mode,
    answered_at = timezone('utc', now())
  where
    (
      excluded.answer_request_mode = 'submit'
      and public.answers.answer_request_mode = 'timeout'
    )
    or (
      excluded.answer_request_mode = 'submit'
      and public.answers.answer_request_mode = 'submit'
      and excluded.answer_request_sequence >= public.answers.answer_request_sequence
    )
    or (
      excluded.answer_request_mode = 'timeout'
      and public.answers.answer_request_mode = 'timeout'
      and excluded.answer_request_sequence >= public.answers.answer_request_sequence
    )
  returning
    true,
    public.answers.selected_option,
    public.answers.confidence,
    public.answers.answer_state::text,
    public.answers.answer_request_sequence,
    public.answers.answer_request_mode
  into applied, selected_option, confidence, answer_state, request_sequence, request_mode;

  if found then
    return next;
    return;
  end if;

  return query
  select
    false,
    a.selected_option,
    a.confidence,
    a.answer_state::text,
    a.answer_request_sequence,
    a.answer_request_mode
  from public.answers a
  where a.question_id = target_question_id
    and a.user_id = actor_user_id;
end;
$$;

create or replace function public.activeboard_transfer_session_captain(
  target_session_id uuid,
  expected_leader_id uuid,
  target_user_id uuid,
  allowed_statuses text[]
)
returns table (
  ok boolean,
  message_key text,
  group_id uuid,
  previous_leader_id uuid,
  current_leader_id uuid,
  state_changed boolean
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  session_row record;
  updated_row record;
  current_leader_id uuid;
begin
  if actor_user_id is null then
    return query
    select false, 'notAuthorized', null::uuid, null::uuid, null::uuid, false;
    return;
  end if;

  select s.id, s.group_id, s.leader_id, s.status
  into session_row
  from public.sessions s
  where s.id = target_session_id;

  if not found then
    return query
    select false, 'notAuthorized', null::uuid, null::uuid, null::uuid, false;
    return;
  end if;

  if not (session_row.status = any(allowed_statuses)) then
    return query
    select false, 'actionFailed', session_row.group_id, session_row.leader_id, session_row.leader_id, false;
    return;
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = session_row.group_id
      and gm.user_id = target_user_id
  ) then
    return query
    select false, 'notAuthorized', session_row.group_id, session_row.leader_id, session_row.leader_id, false;
    return;
  end if;

  update public.sessions s
  set leader_id = target_user_id
  where s.id = target_session_id
    and s.leader_id is not distinct from expected_leader_id
    and s.status = any(allowed_statuses)
    and (
      actor_user_id = expected_leader_id
      or exists (
        select 1
        from public.group_members gm
        where gm.group_id = s.group_id
          and gm.user_id = actor_user_id
          and gm.is_founder = true
      )
    )
  returning s.group_id, expected_leader_id as previous_leader_id, s.leader_id as current_leader_id
  into updated_row;

  if found then
    return query
    select true, null::text, updated_row.group_id, updated_row.previous_leader_id, updated_row.current_leader_id, false;
    return;
  end if;

  select s.leader_id
  into current_leader_id
  from public.sessions s
  where s.id = target_session_id;

  return query
  select false, 'sessionStateChanged', session_row.group_id, null::uuid, current_leader_id, true;
end;
$$;
