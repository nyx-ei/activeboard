create or replace view public.group_member_stats
with (security_invoker = true) as
select
  gm.group_id,
  count(*)::bigint as member_count,
  min(case when gm.is_founder then gm.user_id::text end)::uuid as founder_user_id
from public.group_members gm
group by gm.group_id;

grant select on public.group_member_stats to authenticated;
