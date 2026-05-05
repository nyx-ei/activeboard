do $$
begin
  if not exists (select 1 from pg_type where typname = 'answer_state') then
    create type public.answer_state as enum ('submitted', 'skipped');
  end if;
end $$;

alter table public.answers
  add column if not exists answer_state public.answer_state not null default 'submitted';

update public.users u
set questions_answered = coalesce(source.answer_count, 0)
from (
  select user_id, count(*)::integer as answer_count
  from public.answers
  where answer_state = 'submitted'
  group by user_id
) source
where source.user_id = u.id;

update public.users
set questions_answered = 0
where id not in (
  select distinct user_id
  from public.answers
  where answer_state = 'submitted'
);

alter table public.answers
  add constraint answers_skipped_state_shape
  check (
    answer_state = 'submitted'
    or (
      answer_state = 'skipped'
      and selected_option is null
      and confidence is null
    )
  ) not valid;

create index if not exists idx_answers_user_id_state_answered_at
  on public.answers (user_id, answer_state, answered_at);

create or replace function public.sync_user_questions_answered()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.answer_state = 'submitted' then
      update public.users
      set questions_answered = questions_answered + 1
      where id = new.user_id;
    end if;

    return new;
  elsif tg_op = 'DELETE' then
    if old.answer_state = 'submitted' then
      update public.users
      set questions_answered = greatest(questions_answered - 1, 0)
      where id = old.user_id;
    end if;

    return old;
  elsif tg_op = 'UPDATE' then
    if old.user_id is distinct from new.user_id then
      if old.answer_state = 'submitted' then
        update public.users
        set questions_answered = greatest(questions_answered - 1, 0)
        where id = old.user_id;
      end if;

      if new.answer_state = 'submitted' then
        update public.users
        set questions_answered = questions_answered + 1
        where id = new.user_id;
      end if;
    elsif old.answer_state is distinct from new.answer_state then
      if old.answer_state = 'submitted' then
        update public.users
        set questions_answered = greatest(questions_answered - 1, 0)
        where id = old.user_id;
      end if;

      if new.answer_state = 'submitted' then
        update public.users
        set questions_answered = questions_answered + 1
        where id = new.user_id;
      end if;
    end if;

    return new;
  end if;

  return null;
end;
$$;

create or replace view public.dashboard_user_session_answer_counts
with (security_invoker = true) as
select
  a.user_id,
  q.session_id,
  count(*) filter (where a.answer_state = 'submitted')::bigint as answered_question_count
from public.answers a
join public.questions q on q.id = a.question_id
group by a.user_id, q.session_id;

create or replace view public.dashboard_user_answer_metrics
with (security_invoker = true) as
select
  a.user_id,
  count(*) filter (where a.answer_state = 'submitted')::bigint as answered_count,
  count(*) filter (where a.answer_state = 'submitted' and a.is_correct is true)::bigint as correct_count,
  count(*) filter (where a.answer_state = 'submitted' and a.is_correct is false)::bigint as incorrect_count,
  avg(
    case
      when a.answer_state <> 'submitted' then null
      when a.confidence = 'low' then 1
      when a.confidence = 'medium' then 2
      when a.confidence = 'high' then 3
      else null
    end
  )::numeric as average_confidence_score
from public.answers a
group by a.user_id;

create or replace view public.dashboard_user_answer_daily_counts
with (security_invoker = true) as
select
  a.user_id,
  timezone('utc', a.answered_at)::date as answered_on,
  count(*) filter (where a.answer_state = 'submitted')::bigint as answer_count
from public.answers a
group by a.user_id, timezone('utc', a.answered_at)::date;

drop materialized view if exists public.dashboard_user_session_confidence_breakdown;
create materialized view public.dashboard_user_session_confidence_breakdown as
select
  a.user_id,
  s.id as session_id,
  coalesce(nullif(trim(s.name), ''), g.name, 'Session') as session_name,
  s.scheduled_at,
  count(*) filter (where a.confidence = 'low')::int as low_count,
  count(*) filter (where a.confidence = 'medium')::int as medium_count,
  count(*) filter (where a.confidence = 'high')::int as high_count
from public.answers a
join public.questions q on q.id = a.question_id
join public.sessions s on s.id = q.session_id
left join public.groups g on g.id = s.group_id
where a.answer_state = 'submitted'
  and a.confidence in ('low', 'medium', 'high')
group by a.user_id, s.id, coalesce(nullif(trim(s.name), ''), g.name, 'Session'), s.scheduled_at;

create unique index if not exists idx_dashboard_user_session_confidence_breakdown_user_session
  on public.dashboard_user_session_confidence_breakdown (user_id, session_id);

create index if not exists idx_dashboard_user_session_confidence_breakdown_user_scheduled_at
  on public.dashboard_user_session_confidence_breakdown (user_id, scheduled_at desc);

grant select on public.dashboard_user_session_confidence_breakdown to authenticated;
