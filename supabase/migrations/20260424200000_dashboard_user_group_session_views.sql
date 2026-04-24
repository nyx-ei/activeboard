create or replace view public.dashboard_user_groups
with (security_invoker = true) as
select
  gm.user_id,
  gm.group_id,
  gm.is_founder,
  g.name,
  coalesce(gms.member_count, 0)::bigint as member_count
from public.group_members gm
join public.groups g on g.id = gm.group_id
left join public.group_member_stats gms on gms.group_id = gm.group_id;

create or replace view public.dashboard_user_sessions
with (security_invoker = true) as
select
  gm.user_id,
  s.id,
  s.group_id,
  s.name,
  s.scheduled_at,
  s.share_code,
  s.status,
  s.timer_mode,
  s.timer_seconds,
  s.leader_id,
  s.question_goal
from public.group_members gm
join public.sessions s on s.group_id = gm.group_id;

grant select on public.dashboard_user_groups to authenticated;
grant select on public.dashboard_user_sessions to authenticated;
