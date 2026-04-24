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
  s.question_goal,
  coalesce(dsqc.question_count, 0)::bigint as question_count,
  coalesce(duac.answered_question_count, 0)::bigint as answered_question_count
from public.group_members gm
join public.sessions s on s.group_id = gm.group_id
left join public.dashboard_session_question_counts dsqc on dsqc.session_id = s.id
left join public.dashboard_user_session_answer_counts duac
  on duac.session_id = s.id
 and duac.user_id = gm.user_id;

grant select on public.dashboard_user_sessions to authenticated;
