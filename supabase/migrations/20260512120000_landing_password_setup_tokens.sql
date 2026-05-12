create table if not exists public.password_setup_tokens (
  token_hash text primary key,
  user_id uuid not null,
  email text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_setup_tokens_user_id_idx
  on public.password_setup_tokens (user_id);

create index if not exists password_setup_tokens_expires_at_idx
  on public.password_setup_tokens (expires_at);

alter table public.password_setup_tokens enable row level security;
