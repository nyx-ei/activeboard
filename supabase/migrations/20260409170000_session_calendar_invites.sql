create table if not exists public.session_calendar_invites (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  provider_message_id text,
  sent_at timestamptz not null default timezone('utc', now()),
  unique (session_id, user_id)
);

create index if not exists idx_session_calendar_invites_session_id
  on public.session_calendar_invites (session_id);

create index if not exists idx_session_calendar_invites_user_id
  on public.session_calendar_invites (user_id);

alter table public.session_calendar_invites enable row level security;

drop policy if exists "No direct reads on session calendar invites" on public.session_calendar_invites;
create policy "No direct reads on session calendar invites"
  on public.session_calendar_invites
  for select
  to authenticated
  using (false);
