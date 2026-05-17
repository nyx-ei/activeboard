alter table public.groups
  add column if not exists max_members integer not null default 5;

alter table public.groups
  alter column max_members set default 5;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'groups_max_members_check'
      and conrelid = 'public.groups'::regclass
  ) then
    alter table public.groups
      add constraint groups_max_members_check
      check (max_members between 1 and 6);
  end if;
end $$;

create or replace view public.group_seat_availability
with (security_invoker = true) as
select
  g.id as group_id,
  g.max_members,
  count(gm.user_id)::bigint as confirmed_member_count,
  greatest(g.max_members - count(gm.user_id), 0)::integer as seats_available
from public.groups g
left join public.group_members gm on gm.group_id = g.id
group by g.id, g.max_members;

grant select on public.group_seat_availability to authenticated;
