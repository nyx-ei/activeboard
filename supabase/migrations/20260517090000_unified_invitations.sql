do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'invitation_source'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.invitation_source as enum (
      'onboarding',
      'dashboard',
      'on_the_fly'
    );
  end if;
end $$;

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  group_invite_id uuid not null unique references public.group_invites (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  invited_by uuid not null references public.users (id) on delete cascade,
  invited_email text not null,
  invited_user_id uuid references public.users (id) on delete set null,
  source public.invitation_source not null default 'dashboard',
  session_id uuid references public.sessions (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz,
  expires_at timestamptz not null default (timezone('utc', now()) + interval '7 days')
);

create index if not exists idx_invitations_invited_email_expires_at
  on public.invitations (invited_email, expires_at);

create index if not exists idx_invitations_group_id_status
  on public.invitations (group_id, status);

create index if not exists idx_invitations_session_id
  on public.invitations (session_id)
  where session_id is not null;

insert into public.invitations (
  group_invite_id,
  group_id,
  invited_by,
  invited_email,
  invited_user_id,
  source,
  session_id,
  status,
  created_at,
  responded_at,
  expires_at
)
select
  gi.id,
  gi.group_id,
  gi.invited_by,
  gi.invitee_email,
  gi.invitee_user_id,
  case
    when gi.invited_during_session_id is not null then 'on_the_fly'::public.invitation_source
    else 'dashboard'::public.invitation_source
  end,
  gi.invited_during_session_id,
  gi.status,
  gi.created_at,
  gi.responded_at,
  gi.created_at + interval '7 days'
from public.group_invites gi
on conflict (group_invite_id) do update
set
  group_id = excluded.group_id,
  invited_by = excluded.invited_by,
  invited_email = excluded.invited_email,
  invited_user_id = excluded.invited_user_id,
  session_id = excluded.session_id,
  status = excluded.status,
  responded_at = excluded.responded_at,
  expires_at = excluded.expires_at,
  source = case
    when excluded.session_id is not null then 'on_the_fly'::public.invitation_source
    else public.invitations.source
  end;

create or replace function public.sync_group_invite_to_invitation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.invitations (
    group_invite_id,
    group_id,
    invited_by,
    invited_email,
    invited_user_id,
    source,
    session_id,
    status,
    created_at,
    responded_at,
    expires_at
  )
  values (
    new.id,
    new.group_id,
    new.invited_by,
    new.invitee_email,
    new.invitee_user_id,
    case
      when new.invited_during_session_id is not null then 'on_the_fly'::public.invitation_source
      else 'dashboard'::public.invitation_source
    end,
    new.invited_during_session_id,
    new.status,
    new.created_at,
    new.responded_at,
    coalesce(new.created_at, timezone('utc', now())) + interval '7 days'
  )
  on conflict (group_invite_id) do update
  set
    group_id = excluded.group_id,
    invited_by = excluded.invited_by,
    invited_email = excluded.invited_email,
    invited_user_id = excluded.invited_user_id,
    source = case
      when excluded.session_id is not null then 'on_the_fly'::public.invitation_source
      else public.invitations.source
    end,
    session_id = excluded.session_id,
    status = excluded.status,
    created_at = excluded.created_at,
    responded_at = excluded.responded_at;

  return new;
end;
$$;

drop trigger if exists sync_group_invite_to_invitation on public.group_invites;
create trigger sync_group_invite_to_invitation
after insert or update on public.group_invites
for each row
execute function public.sync_group_invite_to_invitation();

alter table public.invitations enable row level security;

drop policy if exists "Group admins can create unified invitations" on public.invitations;
create policy "Group admins can create unified invitations"
  on public.invitations
  for insert
  to authenticated
  with check (
    invited_by = auth.uid()
    and public.is_group_admin(group_id)
  );

drop policy if exists "Participants can read related unified invitations" on public.invitations;
create policy "Participants can read related unified invitations"
  on public.invitations
  for select
  to authenticated
  using (
    public.is_group_member(group_id)
    or invited_user_id = auth.uid()
    or lower(invited_email) = lower(coalesce((select email from public.users where id = auth.uid()), ''))
  );

drop policy if exists "Invitees can update unified invitations" on public.invitations;
create policy "Invitees can update unified invitations"
  on public.invitations
  for update
  to authenticated
  using (
    invited_user_id = auth.uid()
    or lower(invited_email) = lower(coalesce((select email from public.users where id = auth.uid()), ''))
  )
  with check (
    invited_user_id = auth.uid()
    or lower(invited_email) = lower(coalesce((select email from public.users where id = auth.uid()), ''))
  );
