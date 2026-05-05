alter table public.questions
  add column if not exists review_version bigint not null default 0;

create or replace function public.activeboard_save_review_snapshot(
  target_session_id uuid,
  target_question_id uuid,
  correct_option_input text
)
returns table (
  question_id uuid,
  review_version bigint,
  answer_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  question_row record;
  normalized_correct_option text := upper(correct_option_input);
  updated_review_version bigint;
  updated_answer_count bigint;
begin
  if actor_user_id is null then
    return;
  end if;

  select
    q.id,
    q.session_id,
    q.correct_option,
    q.review_version,
    q.asked_by,
    s.group_id,
    s.leader_id
  into question_row
  from public.questions q
  join public.sessions s on s.id = q.session_id
  where q.id = target_question_id
    and q.session_id = target_session_id;

  if not found then
    return;
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = question_row.group_id
      and gm.user_id = actor_user_id
  ) then
    return;
  end if;

  if question_row.correct_option is not null then
    if upper(question_row.correct_option) <> normalized_correct_option then
      return;
    end if;

    select count(*)::bigint
    into updated_answer_count
    from public.answers a
    where a.question_id = target_question_id
      and a.answer_state = 'submitted';

    return query
    select target_question_id, question_row.review_version, updated_answer_count;
    return;
  end if;

  update public.questions q
  set
    correct_option = normalized_correct_option,
    phase = 'review',
    review_version = q.review_version + 1
  where q.id = target_question_id
    and q.session_id = target_session_id
  returning q.review_version
  into updated_review_version;

  update public.answers a
  set is_correct = upper(coalesce(a.selected_option, '')) = normalized_correct_option
  where a.question_id = target_question_id
    and a.answer_state = 'submitted';

  get diagnostics updated_answer_count = row_count;

  return query
  select target_question_id, updated_review_version, updated_answer_count;
end;
$$;

create or replace function public.activeboard_get_review_question_snapshot(
  target_session_id uuid,
  target_question_index integer
)
returns table (
  question jsonb,
  distribution jsonb,
  own_answer jsonb,
  reviewed_question_count bigint,
  review_version bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := auth.uid();
  session_row record;
  clamped_index integer;
  member_count bigint;
begin
  if actor_user_id is null then
    return;
  end if;

  select s.id, s.group_id, s.question_goal
  into session_row
  from public.sessions s
  where s.id = target_session_id;

  if not found then
    return;
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = session_row.group_id
      and gm.user_id = actor_user_id
  ) then
    return;
  end if;

  select count(*)::bigint
  into member_count
  from public.group_members gm
  where gm.group_id = session_row.group_id;

  clamped_index := greatest(
    0,
    least(target_question_index, greatest(session_row.question_goal - 1, 0))
  );

  return query
  select
    jsonb_build_object(
      'id', q.id,
      'body', q.body,
      'options', q.options,
      'order_index', q.order_index,
      'phase', q.phase,
      'launched_at', q.launched_at,
      'answer_deadline_at', q.answer_deadline_at,
      'correct_option', q.correct_option,
      'review_version', q.review_version
    ) as question,
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
      where a.question_id = q.id
    ) as distribution,
    (
      select jsonb_build_object(
        'answer_state', own.answer_state,
        'selected_option', own.selected_option,
        'confidence', own.confidence,
        'is_correct', own.is_correct,
        'answered_at', own.answered_at
      )
      from public.answers own
      where own.question_id = q.id
        and own.user_id = actor_user_id
      limit 1
    ) as own_answer,
    (
      select count(*)::bigint
      from public.questions reviewed
      where reviewed.session_id = target_session_id
        and reviewed.correct_option is not null
    ) as reviewed_question_count,
    q.review_version
  from public.questions q
  where q.session_id = target_session_id
    and q.order_index = clamped_index;
end;
$$;
