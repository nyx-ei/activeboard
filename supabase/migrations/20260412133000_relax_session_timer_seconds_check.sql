alter table public.sessions
  drop constraint if exists sessions_timer_seconds_check;

alter table public.sessions
  add constraint sessions_timer_seconds_check
  check (timer_seconds between 1 and 3600);
