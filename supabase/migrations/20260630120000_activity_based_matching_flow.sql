alter table public.users
  add column if not exists phone_number text;

create table if not exists public.session_member_activity (
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  attendance_status text not null default 'present'
    check (attendance_status in ('present', 'absent', 'late')),
  participated_in_review boolean not null default false,
  planned_next_session boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (session_id, user_id)
);

create table if not exists public.session_peer_feedback (
  session_id uuid not null references public.sessions(id) on delete cascade,
  reviewer_user_id uuid not null references public.users(id) on delete cascade,
  subject_user_id uuid not null references public.users(id) on delete cascade,
  will_study_again boolean not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (session_id, reviewer_user_id, subject_user_id),
  check (reviewer_user_id <> subject_user_id)
);

alter table public.session_member_activity enable row level security;
alter table public.session_peer_feedback enable row level security;

drop policy if exists "Users can read own session activity" on public.session_member_activity;
create policy "Users can read own session activity"
on public.session_member_activity
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can write own peer feedback" on public.session_peer_feedback;
create policy "Users can write own peer feedback"
on public.session_peer_feedback
for insert
to authenticated
with check (auth.uid() = reviewer_user_id);

drop policy if exists "Users can update own peer feedback" on public.session_peer_feedback;
create policy "Users can update own peer feedback"
on public.session_peer_feedback
for update
to authenticated
using (auth.uid() = reviewer_user_id)
with check (auth.uid() = reviewer_user_id);

drop policy if exists "Users can read own peer feedback" on public.session_peer_feedback;
create policy "Users can read own peer feedback"
on public.session_peer_feedback
for select
to authenticated
using (auth.uid() = reviewer_user_id or auth.uid() = subject_user_id);

create index if not exists idx_session_member_activity_user
  on public.session_member_activity (user_id, updated_at desc);

create index if not exists idx_session_peer_feedback_subject
  on public.session_peer_feedback (subject_user_id, will_study_again);

create or replace view public.candidate_matching_profiles as
with session_members as (
  select
    gm.user_id,
    s.id as session_id,
    s.status,
    s.scheduled_at,
    s.ended_at
  from public.group_members gm
  join public.sessions s on s.group_id = gm.group_id
  where s.status <> 'cancelled'
),
question_counts as (
  select
    a.user_id,
    count(distinct a.question_id) filter (where a.answer_state = 'submitted') as questions_completed,
    count(distinct a.question_id) filter (where a.review_correct_option is not null) as questions_reviewed
  from public.answers a
  group by a.user_id
),
review_sessions as (
  select
    a.user_id,
    q.session_id,
    count(*) filter (where a.review_correct_option is not null) as reviewed_count
  from public.answers a
  join public.questions q on q.id = a.question_id
  group by a.user_id, q.session_id
),
activity as (
  select
    sm.user_id,
    count(distinct sm.session_id) filter (where sm.status in ('active', 'incomplete', 'completed')) as sessions_joined,
    count(distinct sm.session_id) filter (where sm.status = 'completed') as completed_sessions,
    count(distinct rs.session_id) filter (where rs.reviewed_count > 0) as review_completed_sessions,
    count(distinct next_s.id) as next_sessions_planned
  from session_members sm
  left join review_sessions rs
    on rs.user_id = sm.user_id
   and rs.session_id = sm.session_id
  left join public.sessions next_s
    on next_s.created_by = sm.user_id
   and next_s.status = 'scheduled'
   and next_s.scheduled_at >= coalesce(sm.ended_at, sm.scheduled_at)
  group by sm.user_id
),
peer_scores as (
  select
    subject_user_id as user_id,
    count(*) filter (where will_study_again) as positive_peer_votes,
    count(*) as total_peer_votes
  from public.session_peer_feedback
  group by subject_user_id
)
select
  u.id as user_id,
  u.email,
  u.display_name,
  u.avatar_url,
  u.phone_number,
  u.locale as language,
  u.exam_type,
  u.exam_session,
  u.has_valid_payment_method,
  u.subscription_status,
  u.user_tier,
  coalesce(qc.questions_completed, 0)::int as questions_completed,
  coalesce(qc.questions_reviewed, 0)::int as questions_reviewed,
  coalesce(a.sessions_joined, 0)::int as sessions_joined,
  coalesce(a.completed_sessions, 0)::int as completed_sessions,
  coalesce(a.review_completed_sessions, 0)::int as review_completed_sessions,
  coalesce(a.next_sessions_planned, 0)::int as next_sessions_planned,
  coalesce(ps.positive_peer_votes, 0)::int as positive_peer_votes,
  coalesce(ps.total_peer_votes, 0)::int as total_peer_votes,
  case
    when coalesce(a.completed_sessions, 0) >= 3
      and coalesce(a.review_completed_sessions, 0) >= 3
      and coalesce(a.next_sessions_planned, 0) >= 1
      and coalesce(ps.positive_peer_votes, 0) >= greatest(1, coalesce(ps.total_peer_votes, 0) * 0.6)
      then 'stable_priority'
    when coalesce(a.completed_sessions, 0) >= 2
      and coalesce(a.review_completed_sessions, 0) >= 2
      and coalesce(ps.positive_peer_votes, 0) >= 1
      then 'reliable'
    when coalesce(a.sessions_joined, 0) >= 1
      and coalesce(qc.questions_completed, 0) > 0
      and coalesce(qc.questions_reviewed, 0) > 0
      then 'active'
    else 'starting'
  end as candidate_classification
from public.users u
left join question_counts qc on qc.user_id = u.id
left join activity a on a.user_id = u.id
left join peer_scores ps on ps.user_id = u.id;

grant select on public.candidate_matching_profiles to authenticated;
