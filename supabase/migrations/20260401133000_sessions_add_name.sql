alter table public.sessions
  add column if not exists name text;

create index if not exists idx_sessions_group_id_scheduled_at_name
  on public.sessions (group_id, scheduled_at desc);
