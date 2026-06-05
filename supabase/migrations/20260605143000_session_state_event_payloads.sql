alter table public.session_state_events
  add column if not exists payload jsonb not null default '{}'::jsonb;
