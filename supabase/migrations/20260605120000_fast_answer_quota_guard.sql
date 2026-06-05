drop function if exists public.activeboard_save_session_answer_concurrent(
  uuid,
  text,
  text,
  bigint,
  text
);

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
  existing_answer public.answers%rowtype;
  billing_row record;
begin
  if actor_user_id is null then
    return query
    select false, null::text, null::text, null::text, 0::bigint, normalized_mode;
    return;
  end if;

  select a.*
  into existing_answer
  from public.answers a
  where a.question_id = target_question_id
    and a.user_id = actor_user_id;

  if normalized_mode = 'submit'
    and (
      existing_answer.id is null
      or existing_answer.answer_state is distinct from 'submitted'::public.answer_state
    )
  then
    select
      u.questions_answered,
      u.subscription_status
    into billing_row
    from public.users u
    where u.id = actor_user_id
    for update;

    if not found
      or (
        coalesce(billing_row.questions_answered, 0) >= 100
        and coalesce(billing_row.subscription_status, 'none') not in ('active', 'trialing')
      )
    then
      raise exception 'upgrade_required_to_join_session';
    end if;
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
