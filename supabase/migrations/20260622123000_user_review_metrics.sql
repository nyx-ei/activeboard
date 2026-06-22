create table if not exists public.user_review_metrics (
  user_id uuid primary key references public.users(id) on delete cascade,
  reviewed_question_count integer not null default 0 check (reviewed_question_count >= 0),
  total_review_seconds integer not null default 0 check (total_review_seconds >= 0),
  average_review_seconds numeric generated always as (
    case
      when reviewed_question_count = 0 then null
      else round(total_review_seconds::numeric / reviewed_question_count, 2)
    end
  ) stored,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.user_review_metrics enable row level security;

drop policy if exists "Users can read own review metrics" on public.user_review_metrics;
create policy "Users can read own review metrics"
on public.user_review_metrics
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.activeboard_record_review_duration(
  target_user_id uuid,
  duration_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_duration integer := least(3600, greatest(1, coalesce(duration_seconds, 1)));
begin
  insert into public.user_review_metrics (
    user_id,
    reviewed_question_count,
    total_review_seconds,
    updated_at
  )
  values (
    target_user_id,
    1,
    safe_duration,
    timezone('utc', now())
  )
  on conflict (user_id) do update
  set reviewed_question_count = public.user_review_metrics.reviewed_question_count + 1,
      total_review_seconds = public.user_review_metrics.total_review_seconds + safe_duration,
      updated_at = timezone('utc', now());
end;
$$;

grant execute on function public.activeboard_record_review_duration(uuid, integer) to authenticated;

