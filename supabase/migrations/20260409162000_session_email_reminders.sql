create table if not exists public.session_email_reminders (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  reminder_key text not null check (reminder_key in ('24h', '1h')),
  provider_message_id text,
  sent_at timestamptz not null default timezone('utc', now()),
  unique (session_id, user_id, reminder_key)
);

create index if not exists idx_session_email_reminders_session_id
  on public.session_email_reminders (session_id);

create index if not exists idx_session_email_reminders_user_id
  on public.session_email_reminders (user_id);

alter table public.session_email_reminders enable row level security;

drop policy if exists "No direct reads on session email reminders" on public.session_email_reminders;
create policy "No direct reads on session email reminders"
  on public.session_email_reminders
  for select
  to authenticated
  using (false);
