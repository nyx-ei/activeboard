create materialized view public.dashboard_user_session_confidence_breakdown as
select
  a.user_id,
  s.id as session_id,
  coalesce(nullif(trim(s.name), ''), g.name, 'Session') as session_name,
  s.scheduled_at,
  count(*) filter (where a.confidence = 'low')::int as low_count,
  count(*) filter (where a.confidence = 'medium')::int as medium_count,
  count(*) filter (where a.confidence = 'high')::int as high_count
from public.answers a
join public.questions q on q.id = a.question_id
join public.sessions s on s.id = q.session_id
left join public.groups g on g.id = s.group_id
where a.confidence in ('low', 'medium', 'high')
group by a.user_id, s.id, coalesce(nullif(trim(s.name), ''), g.name, 'Session'), s.scheduled_at;

create unique index if not exists idx_dashboard_user_session_confidence_breakdown_user_session
  on public.dashboard_user_session_confidence_breakdown (user_id, session_id);

create index if not exists idx_dashboard_user_session_confidence_breakdown_user_scheduled_at
  on public.dashboard_user_session_confidence_breakdown (user_id, scheduled_at desc);

grant select on public.dashboard_user_session_confidence_breakdown to authenticated;

create or replace function public.refresh_dashboard_user_profile_analytics()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.dashboard_user_profile_analytics;
  refresh materialized view public.dashboard_user_session_confidence_breakdown;
end;
$$;
