create or replace view public.analytics_on_the_fly_invite_funnel_30d
with (security_invoker = true) as
select
  date_trunc('day', created_at)::date as event_day,
  group_id,
  session_id,
  count(*) filter (
    where event_name = 'group_invite_sent'
      and metadata ->> 'source' = 'session_on_the_fly_invite'
  )::bigint as invites_created,
  count(*) filter (
    where event_name = 'group_invite_email_sent'
      and metadata ->> 'template_variant' = 'mid_session_check_in'
  )::bigint as invite_emails_sent,
  count(*) filter (
    where event_name = 'group_invite_email_failed'
      and metadata ->> 'template_variant' = 'mid_session_check_in'
  )::bigint as invite_emails_failed,
  count(*) filter (
    where event_name = 'on_the_fly_invite_verification_passed'
  )::bigint as verification_passed,
  count(*) filter (
    where event_name = 'on_the_fly_invite_verification_blocked'
  )::bigint as verification_blocked,
  count(*) filter (
    where event_name = 'on_the_fly_invite_accepted'
  )::bigint as invites_accepted,
  count(*) filter (
    where event_name = 'on_the_fly_invite_declined'
  )::bigint as invites_declined
from public.app_logs
where created_at >= timezone('utc', now()) - interval '30 days'
  and (
    metadata ->> 'source' = 'session_on_the_fly_invite'
    or metadata ->> 'template_variant' = 'mid_session_check_in'
    or event_name in (
      'on_the_fly_invite_verification_passed',
      'on_the_fly_invite_verification_blocked',
      'on_the_fly_invite_accepted',
      'on_the_fly_invite_declined'
    )
  )
group by date_trunc('day', created_at)::date, group_id, session_id;

grant select on public.analytics_on_the_fly_invite_funnel_30d to authenticated;
