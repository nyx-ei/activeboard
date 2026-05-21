create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  invitation_id uuid references public.invitations(id) on delete cascade,
  type text not null check (
    type in (
      'session_scheduled',
      'session_starting_soon',
      'session_started',
      'session_cancelled',
      'group_invite',
      'group_invite_accepted',
      'group_member_added'
    )
  ),
  title_en text not null,
  title_fr text not null,
  body_en text not null,
  body_fr text not null,
  target_path text not null,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, read_at)
  where read_at is null;

create index if not exists idx_notifications_group_user_created
  on public.notifications (group_id, user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users can read their own notifications" on public.notifications;
create policy "Users can read their own notifications"
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can mark their own notifications read" on public.notifications;
create policy "Users can mark their own notifications read"
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
