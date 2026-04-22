create materialized view public.dashboard_user_profile_analytics as
with physician_activity_options(category, position) as (
  values
    ('history_taking'::text, 1),
    ('physical_exam'::text, 2),
    ('investigation'::text, 3),
    ('management'::text, 4),
    ('communication'::text, 5),
    ('ethics'::text, 6)
),
dimension_of_care_options(category, position) as (
  values
    ('diagnosis'::text, 1),
    ('acute_care'::text, 2),
    ('chronic_care'::text, 3),
    ('prevention'::text, 4),
    ('follow_up'::text, 5),
    ('professionalism'::text, 6)
),
confidence_options(confidence, position) as (
  values
    ('low'::text, 1),
    ('medium'::text, 2),
    ('high'::text, 3)
),
error_type_options(error_type, position) as (
  values
    ('knowledge_gap'::text, 1),
    ('misread_question'::text, 2),
    ('premature_closure'::text, 3),
    ('confidence_mismatch'::text, 4),
    ('time_pressure'::text, 5),
    ('careless_mistake'::text, 6)
),
answer_context as (
  select
    a.user_id,
    a.question_id,
    a.answered_at,
    coalesce(a.is_correct, false) as is_correct,
    a.confidence::text as confidence,
    qc.physician_activity::text as physician_activity,
    qc.dimension_of_care::text as dimension_of_care,
    pr.error_type::text as error_type,
    s.scheduled_at
  from public.answers a
  left join public.questions q on q.id = a.question_id
  left join public.question_classifications qc on qc.question_id = a.question_id
  left join public.personal_reflections pr
    on pr.question_id = a.question_id
   and pr.user_id = a.user_id
  left join public.sessions s on s.id = q.session_id
),
daily_counts as (
  select
    a.user_id,
    timezone('utc', a.answered_at)::date as answered_on,
    count(*)::int as answer_count
  from public.answers a
  group by a.user_id, timezone('utc', a.answered_at)::date
),
daily_user_max as (
  select
    user_id,
    max(answer_count)::int as max_count
  from daily_counts
  group by user_id
),
heatmap_days as (
  select
    u.id as user_id,
    gs.day::date as answered_on
  from public.users u
  cross join lateral generate_series(
    timezone('utc', now())::date - interval '111 days',
    timezone('utc', now())::date,
    interval '1 day'
  ) as gs(day)
),
heatmap_rows as (
  select
    hd.user_id,
    jsonb_build_object(
      'date', to_char(hd.answered_on, 'YYYY-MM-DD'),
      'count', coalesce(dc.answer_count, 0),
      'intensity',
        case
          when coalesce(dc.answer_count, 0) = 0 or coalesce(dum.max_count, 0) = 0 then 0
          when dc.answer_count::numeric / dum.max_count >= 0.75 then 4
          when dc.answer_count::numeric / dum.max_count >= 0.5 then 3
          when dc.answer_count::numeric / dum.max_count >= 0.25 then 2
          else 1
        end
    ) as row_json,
    hd.answered_on
  from heatmap_days hd
  left join daily_counts dc
    on dc.user_id = hd.user_id
   and dc.answered_on = hd.answered_on
  left join daily_user_max dum on dum.user_id = hd.user_id
),
heatmap_agg as (
  select
    user_id,
    jsonb_agg(row_json order by answered_on) as heatmap_data
  from heatmap_rows
  group by user_id
),
physician_activity_agg as (
  select
    u.id as user_id,
    jsonb_agg(
      jsonb_build_object(
        'category', pao.category,
        'total', coalesce(stats.total, 0),
        'correct', coalesce(stats.correct, 0),
        'accuracy',
          case
            when coalesce(stats.total, 0) > 0 then round((stats.correct::numeric / stats.total) * 100)::int
            else 0
          end
      )
      order by pao.position
    ) as physician_activity_accuracy
  from public.users u
  cross join physician_activity_options pao
  left join (
    select
      user_id,
      physician_activity as category,
      count(*)::int as total,
      count(*) filter (where is_correct)::int as correct
    from answer_context
    where physician_activity is not null
    group by user_id, physician_activity
  ) stats
    on stats.user_id = u.id
   and stats.category = pao.category
  group by u.id
),
dimension_of_care_agg as (
  select
    u.id as user_id,
    jsonb_agg(
      jsonb_build_object(
        'category', dco.category,
        'total', coalesce(stats.total, 0),
        'correct', coalesce(stats.correct, 0),
        'accuracy',
          case
            when coalesce(stats.total, 0) > 0 then round((stats.correct::numeric / stats.total) * 100)::int
            else 0
          end
      )
      order by dco.position
    ) as dimension_of_care_accuracy
  from public.users u
  cross join dimension_of_care_options dco
  left join (
    select
      user_id,
      dimension_of_care as category,
      count(*)::int as total,
      count(*) filter (where is_correct)::int as correct
    from answer_context
    where dimension_of_care is not null
    group by user_id, dimension_of_care
  ) stats
    on stats.user_id = u.id
   and stats.category = dco.category
  group by u.id
),
blueprint_grid_agg as (
  select
    u.id as user_id,
    jsonb_agg(
      jsonb_build_object(
        'physicianActivity', pao.category,
        'dimensionOfCare', dco.category,
        'total', coalesce(stats.total, 0),
        'correct', coalesce(stats.correct, 0),
        'accuracy',
          case
            when coalesce(stats.total, 0) > 0 then round((stats.correct::numeric / stats.total) * 100)::int
            else null
          end
      )
      order by pao.position, dco.position
    ) as blueprint_grid
  from public.users u
  cross join physician_activity_options pao
  cross join dimension_of_care_options dco
  left join (
    select
      user_id,
      physician_activity,
      dimension_of_care,
      count(*)::int as total,
      count(*) filter (where is_correct)::int as correct
    from answer_context
    where physician_activity is not null
      and dimension_of_care is not null
    group by user_id, physician_activity, dimension_of_care
  ) stats
    on stats.user_id = u.id
   and stats.physician_activity = pao.category
   and stats.dimension_of_care = dco.category
  group by u.id
),
confidence_agg as (
  select
    u.id as user_id,
    jsonb_agg(
      jsonb_build_object(
        'confidence', coo.confidence,
        'total', coalesce(stats.total, 0),
        'correct', coalesce(stats.correct, 0),
        'accuracy',
          case
            when coalesce(stats.total, 0) > 0 then round((stats.correct::numeric / stats.total) * 100)::int
            else 0
          end
      )
      order by coo.position
    ) as confidence_calibration
  from public.users u
  cross join confidence_options coo
  left join (
    select
      user_id,
      confidence,
      count(*)::int as total,
      count(*) filter (where is_correct)::int as correct
    from answer_context
    where confidence is not null
    group by user_id, confidence
  ) stats
    on stats.user_id = u.id
   and stats.confidence = coo.confidence
  group by u.id
),
error_type_agg as (
  select
    user_id,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'errorType', error_type,
          'count', total
        )
        order by total desc, position
      ),
      '[]'::jsonb
    ) as error_type_breakdown
  from (
    select
      stats.user_id,
      eto.error_type,
      eto.position,
      stats.total
    from error_type_options eto
    join (
      select
        user_id,
        error_type,
        count(*)::int as total
      from answer_context
      where error_type is not null
      group by user_id, error_type
    ) stats on stats.error_type = eto.error_type
  ) ordered
  group by user_id
),
weekly_base as (
  select
    user_id,
    to_char(
      date_trunc('week', coalesce(scheduled_at, answered_at at time zone 'utc')),
      'YYYY-MM-DD'
    ) as label,
    count(*)::int as total,
    count(*) filter (where is_correct)::int as correct
  from answer_context
  group by user_id, date_trunc('week', coalesce(scheduled_at, answered_at at time zone 'utc'))
),
weekly_ranked as (
  select
    user_id,
    label,
    total,
    correct,
    row_number() over (partition by user_id order by label desc) as rank_desc
  from weekly_base
),
weekly_trend_agg as (
  select
    user_id,
    jsonb_agg(
      jsonb_build_object(
        'label', label,
        'total', total,
        'accuracy',
          case
            when total > 0 then round((correct::numeric / total) * 100)::int
            else null
          end
      )
      order by label
    ) as weekly_trend
  from weekly_ranked
  where rank_desc <= 8
  group by user_id
)
select
  u.id as user_id,
  coalesce(heatmap_agg.heatmap_data, '[]'::jsonb) as heatmap_data,
  coalesce(physician_activity_agg.physician_activity_accuracy, '[]'::jsonb) as physician_activity_accuracy,
  coalesce(dimension_of_care_agg.dimension_of_care_accuracy, '[]'::jsonb) as dimension_of_care_accuracy,
  coalesce(blueprint_grid_agg.blueprint_grid, '[]'::jsonb) as blueprint_grid,
  coalesce(confidence_agg.confidence_calibration, '[]'::jsonb) as confidence_calibration,
  coalesce(error_type_agg.error_type_breakdown, '[]'::jsonb) as error_type_breakdown,
  coalesce(weekly_trend_agg.weekly_trend, '[]'::jsonb) as weekly_trend
from public.users u
left join heatmap_agg on heatmap_agg.user_id = u.id
left join physician_activity_agg on physician_activity_agg.user_id = u.id
left join dimension_of_care_agg on dimension_of_care_agg.user_id = u.id
left join blueprint_grid_agg on blueprint_grid_agg.user_id = u.id
left join confidence_agg on confidence_agg.user_id = u.id
left join error_type_agg on error_type_agg.user_id = u.id
left join weekly_trend_agg on weekly_trend_agg.user_id = u.id;

create unique index if not exists idx_dashboard_user_profile_analytics_user_id
  on public.dashboard_user_profile_analytics (user_id);

grant select on public.dashboard_user_profile_analytics to authenticated;

create or replace function public.refresh_dashboard_user_profile_analytics()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.dashboard_user_profile_analytics;
end;
$$;
