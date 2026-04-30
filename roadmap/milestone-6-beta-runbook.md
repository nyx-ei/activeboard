# Milestone 6 Beta Runbook

This runbook is the operational closeout for Milestone 6 after engineering delivery.

## 1. Verify required migrations

Run these checks in the Supabase SQL editor:

```sql
select
  schemaname,
  viewname
from pg_views
where schemaname = 'public'
  and viewname in (
    'dashboard_session_question_counts',
    'dashboard_user_session_answer_counts',
    'dashboard_user_answer_metrics',
    'dashboard_user_answer_daily_counts',
    'beta_session_kpis',
    'beta_session_kpi_summary',
    'beta_returning_users_28d',
    'beta_device_split_30d',
    'beta_trial_funnel',
    'beta_performance_trace_logs_7d',
    'beta_app_velocity_7d'
  )
order by viewname;
```

Expected result: all 11 views are returned.

## 2. Verify or enable `canUseUbiquitousLogging`

Check current value:

```sql
select
  key,
  enabled,
  description,
  updated_at
from public.feature_flags
where key = 'canUseUbiquitousLogging';
```

If the row is missing, recreate it:

```sql
insert into public.feature_flags (key, enabled, description)
values (
  'canUseUbiquitousLogging',
  false,
  'Enables structured application event logging.'
)
on conflict (key) do update
set description = excluded.description
returning key, enabled, updated_at;
```

To enable logging:

```sql
update public.feature_flags
set enabled = true
where key = 'canUseUbiquitousLogging'
returning key, enabled, updated_at;
```

To verify that device metadata is now being captured:

```sql
select
  created_at,
  event_name,
  user_id,
  metadata ->> 'device_type' as device_type,
  metadata ->> 'platform' as platform,
  metadata ->> 'browser' as browser
from public.app_logs
where feature_flag_key = 'canUseUbiquitousLogging'
order by created_at desc
limit 20;
```

Expected result: new rows should start showing `device_type`, `platform`, and `browser`.

## 2b. Verify or enable `canUsePerformanceLogging`

Check current value:

```sql
select
  key,
  enabled,
  description,
  updated_at
from public.feature_flags
where key = 'canUsePerformanceLogging';
```

If the row is missing, recreate it:

```sql
insert into public.feature_flags (key, enabled, description)
values (
  'canUsePerformanceLogging',
  true,
  'Enables persisted structured performance trace logging.'
)
on conflict (key) do update
set enabled = excluded.enabled,
    description = excluded.description
returning key, enabled, updated_at;
```

To verify trace persistence:

```sql
select
  created_at,
  trace_name,
  trace_group,
  trace_kind,
  total_ms
from public.beta_performance_trace_logs_7d
order by created_at desc
limit 20;
```

To verify aggregated app velocity:

```sql
select
  trace_name,
  trace_group,
  trace_kind,
  sample_count,
  avg_ms,
  p50_ms,
  p95_ms,
  max_ms
from public.beta_app_velocity_7d
order by p95_ms desc nulls last;
```

## 3. Beta execution checklist

Use this sequence for the first real beta sessions:

1. Confirm `canUseUbiquitousLogging = true`.
2. Confirm at least one founder account can create a group and invite members.
3. Confirm invitees can join through `/invite/[inviteId]`.
4. Run at least 3 real sessions across 2–3 groups.
5. Ensure at least one session reaches `completed`.
6. Ensure at least one user returns on a different day.
7. Re-run the KPI queries below after the first batch of sessions.
8. Log product feedback separately under `#79`.
9. Export both raw traces and aggregated velocity if navigation or submit latency is reported.

## 4. KPI queries

### 4.1 Questions per session

```sql
select
  session_id,
  group_id,
  status,
  question_goal,
  launched_questions,
  submitted_answers,
  participant_count,
  question_progress_rate,
  scheduled_at
from public.beta_session_kpis
order by scheduled_at desc
limit 50;
```

Summary view:

```sql
select *
from public.beta_session_kpi_summary;
```

What to read:

- `avg_questions_per_completed_session`
- `session_completion_rate`

### 4.2 Return rate

```sql
select *
from public.beta_returning_users_28d;
```

What to read:

- `active_users_28d`
- `returning_users_28d`
- `returning_user_rate_28d`

### 4.3 Mobile vs desktop split

```sql
select
  device_type,
  event_count,
  user_count
from public.beta_device_split_30d
order by user_count desc, event_count desc;
```

Raw sample:

```sql
select
  created_at,
  event_name,
  metadata ->> 'device_type' as device_type,
  metadata ->> 'platform' as platform,
  metadata ->> 'browser' as browser
from public.app_logs
where created_at >= timezone('utc', now()) - interval '30 days'
order by created_at desc
limit 50;
```

### 4.4 Session completion

```sql
select
  total_sessions,
  completed_sessions,
  closed_sessions,
  session_completion_rate
from public.beta_session_kpi_summary;
```

### 4.5 85 -> 100 funnel

```sql
select
  funnel_stage,
  user_count
from public.beta_trial_funnel
order by
  case funnel_stage
    when '0_not_started' then 1
    when '1_84_trial' then 2
    when '85_99_warning' then 3
    when '100_plus_locked' then 4
    when '100_plus_paid' then 5
    else 99
  end;
```

## 5. Operational sanity queries

Recent session events:

```sql
select
  event_name,
  count(*) as event_count
from public.app_logs
where created_at >= timezone('utc', now()) - interval '7 days'
group by event_name
order by event_count desc, event_name asc;
```

Recent groups and sessions:

```sql
select
  g.name as group_name,
  s.id as session_id,
  s.status,
  s.scheduled_at,
  s.question_goal
from public.sessions s
join public.groups g on g.id = s.group_id
order by s.scheduled_at desc
limit 30;
```

Invite flow sanity check:

```sql
select
  status,
  count(*) as invite_count
from public.group_invites
group by status
order by status;
```

## 6. Exit criteria for operational closure

Milestone 6 can be considered operationally closed when:

1. The first real beta batch has run on 2–3 study groups.
2. The KPI queries above return meaningful data.
3. No blocking UX or flow regression is discovered from that batch.
4. Remaining feedback, if any, is small enough to classify as post-milestone follow-up instead of milestone-blocking work.
