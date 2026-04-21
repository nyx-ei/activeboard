create index if not exists idx_answers_user_id_answered_at
  on public.answers (user_id, answered_at);

create or replace view public.dashboard_session_question_counts
with (security_invoker = true) as
select
  q.session_id,
  count(*)::bigint as question_count
from public.questions q
group by q.session_id;

create or replace view public.dashboard_user_session_answer_counts
with (security_invoker = true) as
select
  a.user_id,
  q.session_id,
  count(*)::bigint as answered_question_count
from public.answers a
join public.questions q on q.id = a.question_id
group by a.user_id, q.session_id;

create or replace view public.dashboard_user_answer_metrics
with (security_invoker = true) as
select
  a.user_id,
  count(*)::bigint as answered_count,
  count(*) filter (where a.is_correct is true)::bigint as correct_count,
  count(*) filter (where a.is_correct is false)::bigint as incorrect_count,
  avg(
    case a.confidence
      when 'low' then 1
      when 'medium' then 2
      when 'high' then 3
      else null
    end
  )::numeric as average_confidence_score
from public.answers a
group by a.user_id;

create or replace view public.dashboard_user_answer_daily_counts
with (security_invoker = true) as
select
  a.user_id,
  timezone('utc', a.answered_at)::date as answered_on,
  count(*)::bigint as answer_count
from public.answers a
group by a.user_id, timezone('utc', a.answered_at)::date;

grant select on public.dashboard_session_question_counts to authenticated;
grant select on public.dashboard_user_session_answer_counts to authenticated;
grant select on public.dashboard_user_answer_metrics to authenticated;
grant select on public.dashboard_user_answer_daily_counts to authenticated;
