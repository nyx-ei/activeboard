# Milestone 6 Beta KPIs

The engineering closeout for Milestone 6 now exposes beta validation KPIs directly in Supabase SQL.

Available views:

- `public.beta_session_kpis`
  - Per-session readout: `question_goal`, launched questions, submitted answers, participants, progress rate.
- `public.beta_session_kpi_summary`
  - Global session summary: average questions per completed session, completed sessions, closed sessions, session completion rate.
- `public.beta_returning_users_28d`
  - Rolling 28-day return metric based on users active on at least 2 distinct UTC days.
- `public.beta_device_split_30d`
  - Rolling 30-day event split by `device_type` derived from request user agent in `app_logs`.
- `public.beta_trial_funnel`
  - Funnel buckets for `0_not_started`, `1_84_trial`, `85_99_warning`, `100_plus_locked`, `100_plus_paid`.
- `public.beta_performance_trace_logs_7d`
  - Raw persisted performance traces for the main critical flows over the last 7 days.
- `public.beta_app_velocity_7d`
  - Aggregated app velocity view: sample count, avg, p50, p95, min, and max timings by trace name/group/kind.

Definitions:

- `questions per session`
  - `avg_questions_per_completed_session` from `beta_session_kpi_summary`
- `return rate`
  - `returning_user_rate_28d` from `beta_returning_users_28d`
- `mobile vs. desktop split`
  - `beta_device_split_30d`
- `session completion rate`
  - `session_completion_rate` from `beta_session_kpi_summary`
- `85->100 funnel`
  - `beta_trial_funnel`
- `performance trace export`
  - `beta_performance_trace_logs_7d`
- `app velocity`
  - `beta_app_velocity_7d`

Notes:

- Device split depends on `app_logs` being enabled through the `canUseUbiquitousLogging` feature flag.
- Performance trace export and velocity reporting depend on `canUsePerformanceLogging`.
- These views are intended for internal beta validation and operational review, typically via SQL editor or service-role reads.
