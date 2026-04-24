create or replace view public.session_runtime_access
with (security_invoker = true) as
select
  gm.user_id,
  s.id as session_id,
  s.group_id,
  s.status,
  s.leader_id,
  s.timer_mode,
  s.timer_seconds,
  s.question_goal,
  s.started_at,
  gm.is_founder,
  coalesce(gms.member_count, 0)::bigint as member_count
from public.group_members gm
join public.sessions s on s.group_id = gm.group_id
left join public.group_member_stats gms on gms.group_id = gm.group_id;

grant select on public.session_runtime_access to authenticated;
