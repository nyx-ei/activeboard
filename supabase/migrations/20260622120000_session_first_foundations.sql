alter table public.groups
  add column if not exists group_kind text not null default 'manual'
    check (group_kind in ('manual', 'session_test', 'solidified')),
  add column if not exists solidified_at timestamptz,
  add column if not exists last_session_id uuid references public.sessions(id) on delete set null;

create index if not exists idx_groups_group_kind
  on public.groups (group_kind);

alter table public.sessions
  add column if not exists review_timer_seconds integer
    check (review_timer_seconds is null or review_timer_seconds between 60 and 86400),
  add column if not exists planned_from_session_id uuid references public.sessions(id) on delete set null;

update public.sessions
set review_timer_seconds = least(86400, greatest(60, coalesce(question_goal, 20) * 180))
where review_timer_seconds is null;

alter table public.sessions
  alter column review_timer_seconds set default 3600,
  alter column review_timer_seconds set not null;

create index if not exists idx_sessions_planned_from_session_id
  on public.sessions (planned_from_session_id)
  where planned_from_session_id is not null;

create or replace function public.activeboard_set_review_timer_seconds()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.review_timer_seconds is null then
    new.review_timer_seconds := least(86400, greatest(60, coalesce(new.question_goal, 20) * 180));
  end if;

  return new;
end;
$$;

drop trigger if exists set_review_timer_seconds_before_insert on public.sessions;
create trigger set_review_timer_seconds_before_insert
before insert on public.sessions
for each row
execute function public.activeboard_set_review_timer_seconds();

update public.app_policy_settings
set default_question_goal = 20,
    updated_at = timezone('utc', now())
where id = 'default'
  and default_question_goal = 10;
