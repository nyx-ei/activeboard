alter table public.group_members
  add column if not exists invited_during_session_id uuid
  references public.sessions (id) on delete set null;

create index if not exists idx_group_members_invited_during_session_id
  on public.group_members (invited_during_session_id);
