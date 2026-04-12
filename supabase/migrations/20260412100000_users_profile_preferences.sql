alter table public.users
  add column if not exists exam_session text,
  add column if not exists question_banks text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_exam_session_check'
  ) then
    alter table public.users
      add constraint users_exam_session_check
      check (
        exam_session is null
        or exam_session in ('april_may_2026', 'august_september_2026', 'october_2026', 'planning_ahead')
      );
  end if;
end $$;
