alter table public.group_members
  add column if not exists is_founder boolean not null default false;

update public.group_members gm
set is_founder = true
from public.groups g
where g.id = gm.group_id
  and g.created_by = gm.user_id;

update public.group_members
set is_founder = true
where role = 'admin';

create or replace function public.is_group_founder(target_group_id uuid)
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
      and gm.is_founder = true
  );
$$;

create or replace function public.is_group_admin(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_group_founder(target_group_id);
$$;

drop policy if exists "Group admins can manage weekly schedules" on public.group_weekly_schedules;
create policy "Group admins can manage weekly schedules"
  on public.group_weekly_schedules
  for all
  to authenticated
  using (public.is_group_founder(group_id))
  with check (public.is_group_founder(group_id));

drop policy if exists "Group admins can update groups" on public.groups;
create policy "Group admins can update groups"
  on public.groups
  for update
  to authenticated
  using (public.is_group_founder(id))
  with check (public.is_group_founder(id));

drop index if exists idx_group_members_group_id_role;
create index if not exists idx_group_members_group_id_is_founder
  on public.group_members (group_id, is_founder);

alter table public.group_members
  drop column if exists role;
