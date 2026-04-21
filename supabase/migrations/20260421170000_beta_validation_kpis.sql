create or replace view public.beta_session_kpis
with (security_invoker = true) as
with question_counts as (
  select
    q.session_id,
    count(*)::bigint as launched_questions
  from public.questions q
  group by q.session_id
),
answer_counts as (
  select
    q.session_id,
    count(a.id)::bigint as submitted_answers,
    count(distinct a.user_id)::bigint as participant_count
  from public.questions q
  left join public.answers a on a.question_id = q.id
  group by q.session_id
)
select
  s.id as session_id,
  s.group_id,
  s.status,
  s.scheduled_at,
  s.question_goal,
  coalesce(qc.launched_questions, 0::bigint) as launched_questions,
  coalesce(ac.submitted_answers, 0::bigint) as submitted_answers,
  coalesce(ac.participant_count, 0::bigint) as participant_count,
  round(
    (
      least(coalesce(qc.launched_questions, 0::bigint), s.question_goal)::numeric
      / nullif(s.question_goal::numeric, 0)
    ) * 100,
    2
  ) as question_progress_rate
from public.sessions s
left join question_counts qc on qc.session_id = s.id
left join answer_counts ac on ac.session_id = s.id;

create or replace view public.beta_session_kpi_summary
with (security_invoker = true) as
select
  count(*)::bigint as total_sessions,
  count(*) filter (where status = 'completed')::bigint as completed_sessions,
  count(*) filter (where status in ('completed', 'incomplete', 'cancelled'))::bigint as closed_sessions,
  round(avg(launched_questions::numeric) filter (where status = 'completed'), 2) as avg_questions_per_completed_session,
  round(
    (
      count(*) filter (where status = 'completed')::numeric
      / nullif(count(*) filter (where status in ('completed', 'incomplete', 'cancelled'))::numeric, 0)
    ) * 100,
    2
  ) as session_completion_rate
from public.beta_session_kpis;

create or replace view public.beta_returning_users_28d
with (security_invoker = true) as
with active_users as (
  select
    a.user_id,
    count(distinct timezone('utc', a.answered_at)::date)::bigint as active_days
  from public.answers a
  where a.answered_at >= timezone('utc', now()) - interval '28 days'
  group by a.user_id
)
select
  count(*)::bigint as active_users_28d,
  count(*) filter (where active_days >= 2)::bigint as returning_users_28d,
  round(
    (
      count(*) filter (where active_days >= 2)::numeric
      / nullif(count(*)::numeric, 0)
    ) * 100,
    2
  ) as returning_user_rate_28d
from active_users;

create or replace view public.beta_device_split_30d
with (security_invoker = true) as
select
  coalesce(nullif(al.metadata ->> 'device_type', ''), 'unknown') as device_type,
  count(*)::bigint as event_count,
  count(distinct al.user_id)::bigint as user_count
from public.app_logs al
where al.created_at >= timezone('utc', now()) - interval '30 days'
group by coalesce(nullif(al.metadata ->> 'device_type', ''), 'unknown');

create or replace view public.beta_trial_funnel
with (security_invoker = true) as
select
  case
    when u.questions_answered >= 100 and u.user_tier = 'active' then '100_plus_paid'
    when u.questions_answered >= 100 then '100_plus_locked'
    when u.questions_answered between 85 and 99 then '85_99_warning'
    when u.questions_answered between 1 and 84 then '1_84_trial'
    else '0_not_started'
  end as funnel_stage,
  count(*)::bigint as user_count
from public.users u
group by
  case
    when u.questions_answered >= 100 and u.user_tier = 'active' then '100_plus_paid'
    when u.questions_answered >= 100 then '100_plus_locked'
    when u.questions_answered between 85 and 99 then '85_99_warning'
    when u.questions_answered between 1 and 84 then '1_84_trial'
    else '0_not_started'
  end;

grant select on public.beta_session_kpis to authenticated;
grant select on public.beta_session_kpi_summary to authenticated;
grant select on public.beta_returning_users_28d to authenticated;
grant select on public.beta_device_split_30d to authenticated;
grant select on public.beta_trial_funnel to authenticated;
