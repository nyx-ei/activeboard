create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  invited_by uuid not null references public.users (id) on delete cascade,
  invitee_email text not null,
  invitee_user_id uuid references public.users (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz
);

create unique index if not exists idx_group_invites_unique_pending
  on public.group_invites (group_id, invitee_email)
  where status = 'pending';

alter table public.sessions
  add column if not exists leader_id uuid references public.users (id) on delete set null;

alter table public.questions
  add column if not exists phase text not null default 'draft' check (phase in ('draft', 'answering', 'review', 'closed'));

alter table public.questions
  add column if not exists launched_at timestamptz;

alter table public.questions
  add column if not exists answer_deadline_at timestamptz;

alter table public.group_invites enable row level security;

create or replace function public.is_group_admin(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
      and gm.role = 'admin'
  );
$$;

drop policy if exists "Group admins can create invites" on public.group_invites;
create policy "Group admins can create invites"
  on public.group_invites
  for insert
  to authenticated
  with check (
    invited_by = auth.uid()
    and public.is_group_admin(group_id)
  );

drop policy if exists "Participants can read related invites" on public.group_invites;
create policy "Participants can read related invites"
  on public.group_invites
  for select
  to authenticated
  using (
    public.is_group_member(group_id)
    or invitee_user_id = auth.uid()
    or lower(invitee_email) = lower(coalesce((select email from public.users where id = auth.uid()), ''))
  );

drop policy if exists "Invitees can update their invites" on public.group_invites;
create policy "Invitees can update their invites"
  on public.group_invites
  for update
  to authenticated
  using (
    invitee_user_id = auth.uid()
    or lower(invitee_email) = lower(coalesce((select email from public.users where id = auth.uid()), ''))
  )
  with check (
    invitee_user_id = auth.uid()
    or lower(invitee_email) = lower(coalesce((select email from public.users where id = auth.uid()), ''))
  );

drop policy if exists "Group admins can update sessions" on public.sessions;
create policy "Group admins can update sessions"
  on public.sessions
  for update
  to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));
