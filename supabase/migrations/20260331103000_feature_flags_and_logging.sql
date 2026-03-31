create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_feature_flags_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_feature_flags_updated_at on public.feature_flags;
create trigger set_feature_flags_updated_at
before update on public.feature_flags
for each row
execute function public.set_feature_flags_updated_at();

insert into public.feature_flags (key, enabled, description)
values
  ('canUseUbiquitousLogging', false, 'Enables structured application event logging.'),
  ('canUseStripeBilling', false, 'Enables Stripe billing flows in the product.'),
  ('canEnforceUserTierGating', false, 'Enforces user-tier based capability gating.')
on conflict (key) do update
set description = excluded.description;

alter table public.feature_flags enable row level security;

drop policy if exists "Authenticated users can read feature flags" on public.feature_flags;
create policy "Authenticated users can read feature flags"
  on public.feature_flags
  for select
  to authenticated
  using (true);

create table if not exists public.app_logs (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  level text not null default 'info',
  feature_flag_key text references public.feature_flags(key) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  session_id uuid references public.sessions(id) on delete set null,
  locale text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint app_logs_level_check check (level in ('info', 'warn', 'error')),
  constraint app_logs_locale_check check (locale in ('en', 'fr') or locale is null)
);

create index if not exists idx_app_logs_event_name on public.app_logs (event_name);
create index if not exists idx_app_logs_user_id on public.app_logs (user_id);
create index if not exists idx_app_logs_group_id on public.app_logs (group_id);
create index if not exists idx_app_logs_session_id on public.app_logs (session_id);
create index if not exists idx_app_logs_created_at on public.app_logs (created_at desc);

alter table public.app_logs enable row level security;

drop policy if exists "Authenticated users can insert app logs" on public.app_logs;
create policy "Authenticated users can insert app logs"
  on public.app_logs
  for insert
  to authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "Users can read their own app logs" on public.app_logs;
create policy "Users can read their own app logs"
  on public.app_logs
  for select
  to authenticated
  using (user_id = auth.uid());
