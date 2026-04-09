create table if not exists public.question_classifications (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null unique references public.questions (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  classified_by uuid not null references public.users (id) on delete cascade,
  correct_answer text,
  physician_activity text not null check (
    physician_activity in ('history_taking', 'physical_exam', 'investigation', 'management', 'communication', 'ethics')
  ),
  dimension_of_care text not null check (
    dimension_of_care in ('diagnosis', 'acute_care', 'chronic_care', 'prevention', 'follow_up', 'professionalism')
  ),
  classified_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_question_classifications_session_id
  on public.question_classifications (session_id);

create table if not exists public.personal_reflections (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  error_type text check (
    error_type in ('knowledge_gap', 'misread_question', 'premature_closure', 'confidence_mismatch', 'time_pressure', 'careless_mistake')
  ),
  private_note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (question_id, user_id)
);

create index if not exists idx_personal_reflections_user_id
  on public.personal_reflections (user_id);

create or replace function public.touch_personal_reflection_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists touch_personal_reflection_updated_at_trigger on public.personal_reflections;
create trigger touch_personal_reflection_updated_at_trigger
  before update on public.personal_reflections
  for each row
  execute procedure public.touch_personal_reflection_updated_at();

alter table public.question_classifications enable row level security;
alter table public.personal_reflections enable row level security;

drop policy if exists "Group members can read question classifications" on public.question_classifications;
create policy "Group members can read question classifications"
  on public.question_classifications
  for select
  to authenticated
  using (
    public.is_group_member(
      (
        select s.group_id
        from public.sessions s
        where s.id = session_id
      )
    )
  );

drop policy if exists "Captains can write question classifications" on public.question_classifications;
create policy "Captains can write question classifications"
  on public.question_classifications
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      left join public.group_members gm
        on gm.group_id = s.group_id
       and gm.user_id = auth.uid()
      where s.id = session_id
        and (s.leader_id = auth.uid() or coalesce(gm.is_founder, false))
    )
  )
  with check (
    classified_by = auth.uid()
    and exists (
      select 1
      from public.sessions s
      left join public.group_members gm
        on gm.group_id = s.group_id
       and gm.user_id = auth.uid()
      where s.id = session_id
        and (s.leader_id = auth.uid() or coalesce(gm.is_founder, false))
    )
  );

drop policy if exists "Users can read own reflections" on public.personal_reflections;
create policy "Users can read own reflections"
  on public.personal_reflections
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can write own reflections" on public.personal_reflections;
create policy "Users can write own reflections"
  on public.personal_reflections
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.is_group_member(
      (
        select s.group_id
        from public.questions q
        join public.sessions s on s.id = q.session_id
        where q.id = question_id
      )
    )
  );
