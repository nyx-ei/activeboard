insert into public.feature_flags (key, enabled, description)
values
  ('canUsePerformanceLogging', true, 'Enables persisted structured performance trace logging.')
on conflict (key) do update
set
  enabled = excluded.enabled,
  description = excluded.description;

create view public.beta_performance_trace_logs_7d
with (security_invoker = true) as
select
  al.id,
  al.created_at,
  al.locale,
  al.user_id,
  al.group_id,
  al.session_id,
  al.metadata ->> 'trace_name' as trace_name,
  al.metadata ->> 'trace_group' as trace_group,
  al.metadata ->> 'trace_kind' as trace_kind,
  nullif(al.metadata ->> 'question_id', '') as question_id,
  case
    when jsonb_typeof(al.metadata -> 'question_index') = 'number'
      then (al.metadata ->> 'question_index')::integer
    else null
  end as question_index,
  nullif(al.metadata ->> 'submit_mode', '') as submit_mode,
  case
    when jsonb_typeof(al.metadata -> 'total_ms') = 'number'
      then (al.metadata ->> 'total_ms')::integer
    else null
  end as total_ms,
  al.metadata -> 'steps' as steps
from public.app_logs al
where al.event_name = 'performance_trace_recorded'
  and al.created_at >= timezone('utc', now()) - interval '7 days';

create view public.beta_app_velocity_7d
with (security_invoker = true) as
select
  trace_name,
  trace_group,
  trace_kind,
  count(*)::bigint as sample_count,
  round(avg(total_ms)::numeric, 2) as avg_ms,
  percentile_disc(0.5) within group (order by total_ms) as p50_ms,
  percentile_disc(0.95) within group (order by total_ms) as p95_ms,
  min(total_ms) as min_ms,
  max(total_ms) as max_ms
from public.beta_performance_trace_logs_7d
where total_ms is not null
group by trace_name, trace_group, trace_kind;
