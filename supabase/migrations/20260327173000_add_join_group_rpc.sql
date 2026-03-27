create or replace function public.find_group_by_invite_code(target_invite_code text)
returns table (
  id uuid,
  member_count bigint,
  max_members integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.id,
    count(gm.user_id)::bigint as member_count,
    g.max_members
  from public.groups g
  left join public.group_members gm on gm.group_id = g.id
  where upper(g.invite_code) = upper(target_invite_code)
  group by g.id, g.max_members;
$$;

grant execute on function public.find_group_by_invite_code(text) to authenticated;
