create table if not exists public.session_state_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  event_type text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint session_state_events_event_type_check check (
    event_type in (
      'answer_submitted',
      'answer_timed_out',
      'question_advanced',
      'session_completed'
    )
  )
);

create index if not exists idx_session_state_events_session_created
  on public.session_state_events (session_id, created_at desc);

alter table public.session_state_events enable row level security;
alter table public.session_state_events replica identity full;

drop policy if exists "Members can read session state events" on public.session_state_events;
create policy "Members can read session state events"
  on public.session_state_events
  for select
  to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "Members can insert session state events" on public.session_state_events;
create policy "Members can insert session state events"
  on public.session_state_events
  for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and public.is_group_member(group_id)
  );

do $$
begin
  alter publication supabase_realtime add table public.session_state_events;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'answers'
  ) then
    alter publication supabase_realtime drop table public.answers;
  end if;
exception
  when undefined_object then null;
end $$;
