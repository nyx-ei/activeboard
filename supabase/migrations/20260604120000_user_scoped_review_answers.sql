alter table public.answers
  add column if not exists review_correct_option text,
  add column if not exists reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'answers_review_correct_option_check'
  ) then
    alter table public.answers
      add constraint answers_review_correct_option_check
      check (
        review_correct_option is null
        or review_correct_option in ('A', 'B', 'C', 'D', 'E')
      );
  end if;
end $$;

create index if not exists idx_answers_user_reviewed
  on public.answers (user_id, reviewed_at desc)
  where review_correct_option is not null;

create index if not exists idx_answers_question_user_review
  on public.answers (question_id, user_id, review_correct_option);

drop function if exists public.activeboard_save_review_snapshot(uuid, uuid, text);

create or replace function public.activeboard_save_review_snapshot(
  target_session_id uuid,
  target_question_id uuid,
  correct_option_input text
)
returns table (
  question_id uuid,
  correct_option text,
  review_version integer,
  reviewed_question_count bigint
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  normalized_correct_option text := upper(trim(correct_option_input));
  target_group_id uuid;
  updated_question record;
begin
  if actor_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if normalized_correct_option not in ('A', 'B', 'C', 'D', 'E') then
    raise exception 'invalid_correct_option';
  end if;

  select s.group_id
  into target_group_id
  from public.sessions s
  where s.id = target_session_id;

  if target_group_id is null or not public.is_group_member(target_group_id) then
    raise exception 'not_authorized';
  end if;

  if not exists (
    select 1
    from public.questions q
    where q.id = target_question_id
      and q.session_id = target_session_id
  ) then
    raise exception 'question_not_found';
  end if;

  update public.questions q
  set
    phase = 'review',
    review_version = coalesce(q.review_version, 0) + 1
  where q.id = target_question_id
    and q.session_id = target_session_id
  returning q.id, q.review_version
  into updated_question;

  update public.answers a
  set
    review_correct_option = normalized_correct_option,
    reviewed_at = timezone('utc', now()),
    is_correct = case
      when a.answer_state = 'submitted' and a.selected_option is not null
        then upper(a.selected_option) = normalized_correct_option
      else null
    end
  where a.question_id = target_question_id
    and a.user_id = actor_user_id;

  if not found then
    insert into public.answers (
      question_id,
      user_id,
      answer_state,
      selected_option,
      confidence,
      review_correct_option,
      reviewed_at,
      is_correct,
      answered_at
    )
    values (
      target_question_id,
      actor_user_id,
      'skipped'::public.answer_state,
      null,
      null,
      normalized_correct_option,
      timezone('utc', now()),
      null,
      timezone('utc', now())
    )
    on conflict (question_id, user_id) do update
    set
      review_correct_option = excluded.review_correct_option,
      reviewed_at = excluded.reviewed_at,
      is_correct = case
        when public.answers.answer_state = 'submitted'
          and public.answers.selected_option is not null
          then upper(public.answers.selected_option) = excluded.review_correct_option
        else null
      end;
  end if;

  return query
  select
    updated_question.id,
    normalized_correct_option,
    coalesce(updated_question.review_version, 0),
    (
      select count(*)
      from public.answers a
      join public.questions q on q.id = a.question_id
      where q.session_id = target_session_id
        and a.user_id = actor_user_id
        and a.review_correct_option is not null
    );
end;
$$;

drop function if exists public.activeboard_get_review_question_snapshot(uuid, integer);

create or replace function public.activeboard_get_review_question_snapshot(
  target_session_id uuid,
  target_question_id uuid
)
returns table (
  question jsonb,
  distribution jsonb,
  own_answer jsonb,
  review_version integer,
  reviewed_question_count bigint
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  target_group_id uuid;
  member_count bigint;
  target_question record;
  current_user_answer record;
begin
  if actor_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select s.group_id
  into target_group_id
  from public.sessions s
  where s.id = target_session_id;

  if target_group_id is null or not public.is_group_member(target_group_id) then
    raise exception 'not_authorized';
  end if;

  select count(*)::bigint
  into member_count
  from public.group_members gm
  where gm.group_id = target_group_id;

  select q.*
  into target_question
  from public.questions q
  where q.id = target_question_id
    and q.session_id = target_session_id;

  if not found then
    raise exception 'question_not_found';
  end if;

  select a.*
  into current_user_answer
  from public.answers a
  where a.question_id = target_question_id
    and a.user_id = actor_user_id;

  return query
  select
    jsonb_build_object(
      'id', target_question.id,
      'body', target_question.body,
      'options', target_question.options,
      'order_index', target_question.order_index,
      'phase', target_question.phase,
      'launched_at', target_question.launched_at,
      'answer_deadline_at', target_question.answer_deadline_at,
      'correct_option', current_user_answer.review_correct_option,
      'review_version', target_question.review_version
    ),
    (
      select jsonb_build_object(
        'A', count(*) filter (where a.answer_state = 'submitted' and upper(coalesce(a.selected_option, '')) = 'A'),
        'B', count(*) filter (where a.answer_state = 'submitted' and upper(coalesce(a.selected_option, '')) = 'B'),
        'C', count(*) filter (where a.answer_state = 'submitted' and upper(coalesce(a.selected_option, '')) = 'C'),
        'D', count(*) filter (where a.answer_state = 'submitted' and upper(coalesce(a.selected_option, '')) = 'D'),
        'E', count(*) filter (where a.answer_state = 'submitted' and upper(coalesce(a.selected_option, '')) = 'E'),
        'blank', count(*) filter (
          where a.answer_state = 'submitted'
            and upper(coalesce(a.selected_option, '')) not in ('A', 'B', 'C', 'D', 'E')
        ),
        'skipped',
          count(*) filter (where a.answer_state = 'skipped')
          + greatest(member_count - count(*), 0)
      )
      from public.answers a
      where a.question_id = target_question_id
    ),
    case
      when current_user_answer.id is null then null::jsonb
      else jsonb_build_object(
        'answer_state', current_user_answer.answer_state,
        'selected_option', current_user_answer.selected_option,
        'confidence', current_user_answer.confidence,
        'is_correct', current_user_answer.is_correct,
        'answered_at', current_user_answer.answered_at
      )
    end,
    coalesce(target_question.review_version, 0),
    (
      select count(*)
      from public.answers a
      join public.questions q on q.id = a.question_id
      where q.session_id = target_session_id
        and a.user_id = actor_user_id
        and a.review_correct_option is not null
    );
end;
$$;
