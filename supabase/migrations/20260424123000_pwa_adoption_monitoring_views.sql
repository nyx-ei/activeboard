create or replace view public.beta_pwa_install_funnel_30d
with (security_invoker = true) as
select
  event_name,
  count(*)::bigint as event_count,
  count(distinct user_id)::bigint as user_count
from public.app_logs
where created_at >= timezone('utc', now()) - interval '30 days'
  and event_name in (
    'pwa_install_prompt_shown',
    'pwa_install_accepted',
    'pwa_launched_from_home_screen'
  )
group by event_name;

create or replace view public.beta_session_device_split_30d
with (security_invoker = true) as
select
  coalesce(nullif(metadata ->> 'device_type', ''), 'unknown') as device_type,
  count(*)::bigint as event_count,
  count(distinct user_id)::bigint as user_count
from public.app_logs
where created_at >= timezone('utc', now()) - interval '30 days'
  and event_name in (
    'session_joined_by_code',
    'session_started',
    'question_launched',
    'answer_submitted',
    'answer_revealed',
    'session_ended'
  )
group by coalesce(nullif(metadata ->> 'device_type', ''), 'unknown');

grant select on public.beta_pwa_install_funnel_30d to authenticated;
grant select on public.beta_session_device_split_30d to authenticated;
