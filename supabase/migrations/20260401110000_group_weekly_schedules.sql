create table if not exists public.group_weekly_schedules (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  weekday text not null check (weekday in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  start_time time not null,
  end_time time not null,
  question_goal integer not null default 50 check (question_goal > 0 and question_goal <= 500),
  created_at timestamptz not null default timezone('utc', now()),
  constraint group_weekly_schedules_time_order check (end_time > start_time)
);

create index if not exists idx_group_weekly_schedules_group_id on public.group_weekly_schedules (group_id);

alter table public.group_weekly_schedules enable row level security;

drop policy if exists "Members can read weekly schedules" on public.group_weekly_schedules;
create policy "Members can read weekly schedules"
  on public.group_weekly_schedules
  for select
  to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "Group admins can manage weekly schedules" on public.group_weekly_schedules;
create policy "Group admins can manage weekly schedules"
  on public.group_weekly_schedules
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.group_members gm
      where gm.group_id = public.group_weekly_schedules.group_id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.group_members gm
      where gm.group_id = public.group_weekly_schedules.group_id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
  );
