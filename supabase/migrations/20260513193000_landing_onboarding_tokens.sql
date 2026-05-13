create table if not exists public.landing_onboarding_tokens (
  token_hash text primary key,
  email text not null,
  draft jsonb not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists landing_onboarding_tokens_email_idx
  on public.landing_onboarding_tokens (email);

create index if not exists landing_onboarding_tokens_expires_at_idx
  on public.landing_onboarding_tokens (expires_at);

alter table public.landing_onboarding_tokens enable row level security;
