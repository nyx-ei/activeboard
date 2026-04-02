alter table public.sessions
  add column if not exists timer_mode text not null default 'per_question'
  check (timer_mode in ('per_question', 'global'));

create index if not exists idx_sessions_group_id_timer_mode_status
  on public.sessions (group_id, timer_mode, status);
