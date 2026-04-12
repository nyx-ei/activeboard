alter table public.sessions
  add column if not exists question_goal integer not null default 10;

alter table public.sessions
  drop constraint if exists sessions_question_goal_check;

alter table public.sessions
  add constraint sessions_question_goal_check
  check (question_goal between 1 and 500);
