create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text,
  avatar_url text,
  locale text not null default 'en' check (locale in ('en', 'fr')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  max_members integer not null default 5 check (max_members between 1 and 5),
  created_by uuid references public.users (id) on delete set null,
  invite_code text not null unique check (char_length(invite_code) = 6),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (group_id, user_id)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  scheduled_at timestamptz not null,
  started_at timestamptz,
  ended_at timestamptz,
  timer_seconds integer not null default 60 check (timer_seconds in (30, 45, 60, 90)),
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'completed', 'cancelled')),
  meeting_link text,
  created_by uuid references public.users (id) on delete set null
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  asked_by uuid not null references public.users (id) on delete cascade,
  body text,
  options jsonb not null default '[]'::jsonb,
  correct_option text,
  category_tags text[] default '{}',
  order_index integer not null check (order_index >= 0)
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  selected_option text,
  confidence integer check (confidence between 1 and 5),
  is_correct boolean,
  answered_at timestamptz not null default timezone('utc', now()),
  unique (question_id, user_id)
);

create index if not exists idx_group_members_user_id on public.group_members (user_id);
create index if not exists idx_sessions_group_id on public.sessions (group_id);
create index if not exists idx_sessions_scheduled_at on public.sessions (scheduled_at);
create index if not exists idx_questions_session_id on public.questions (session_id);
create index if not exists idx_answers_question_id on public.answers (question_id);
create index if not exists idx_answers_user_id on public.answers (user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, avatar_url, locale)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    case
      when new.raw_user_meta_data ->> 'locale' in ('en', 'fr') then new.raw_user_meta_data ->> 'locale'
      else 'en'
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

create or replace function public.enforce_group_member_limit()
returns trigger
language plpgsql
as $$
declare
  member_count integer;
  allowed_members integer;
begin
  select count(*), g.max_members
  into member_count, allowed_members
  from public.group_members gm
  join public.groups g on g.id = gm.group_id
  where gm.group_id = new.group_id
  group by g.max_members;

  if member_count is null then
    select max_members into allowed_members from public.groups where id = new.group_id;
    member_count := 0;
  end if;

  if member_count >= allowed_members then
    raise exception 'Group member limit reached';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_group_member_limit_trigger on public.group_members;
create trigger enforce_group_member_limit_trigger
  before insert on public.group_members
  for each row
  execute procedure public.enforce_group_member_limit();

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
  );
$$;

create or replace function public.find_group_by_invite_code(target_invite_code text)
returns table (
  id uuid,
  member_count bigint,
  max_members integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.id,
    count(gm.user_id)::bigint as member_count,
    g.max_members
  from public.groups g
  left join public.group_members gm on gm.group_id = g.id
  where upper(g.invite_code) = upper(target_invite_code)
  group by g.id, g.max_members;
$$;

grant execute on function public.find_group_by_invite_code(text) to authenticated;

alter table public.users enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.sessions enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;

drop policy if exists "Users can read own record" on public.users;
create policy "Users can read own record"
  on public.users
  for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.group_members gm_self
      join public.group_members gm_target on gm_self.group_id = gm_target.group_id
      where gm_self.user_id = auth.uid()
        and gm_target.user_id = public.users.id
    )
  );

drop policy if exists "Users can update own record" on public.users;
create policy "Users can update own record"
  on public.users
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Authenticated users can insert own record" on public.users;
create policy "Authenticated users can insert own record"
  on public.users
  for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "Members can read groups" on public.groups;
create policy "Members can read groups"
  on public.groups
  for select
  to authenticated
  using (public.is_group_member(id) or created_by = auth.uid());

drop policy if exists "Authenticated users can create groups" on public.groups;
create policy "Authenticated users can create groups"
  on public.groups
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Group creators can update groups" on public.groups;
create policy "Group creators can update groups"
  on public.groups
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "Members can read memberships" on public.group_members;
create policy "Members can read memberships"
  on public.group_members
  for select
  to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "Users can join groups as themselves" on public.group_members;
create policy "Users can join groups as themselves"
  on public.group_members
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can leave groups as themselves" on public.group_members;
create policy "Users can leave groups as themselves"
  on public.group_members
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Members can read sessions" on public.sessions;
create policy "Members can read sessions"
  on public.sessions
  for select
  to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "Members can create sessions" on public.sessions;
create policy "Members can create sessions"
  on public.sessions
  for insert
  to authenticated
  with check (public.is_group_member(group_id) and created_by = auth.uid());

drop policy if exists "Session members can update sessions" on public.sessions;
create policy "Session members can update sessions"
  on public.sessions
  for update
  to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

drop policy if exists "Members can read questions" on public.questions;
create policy "Members can read questions"
  on public.questions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = public.questions.session_id
        and public.is_group_member(s.group_id)
    )
  );

drop policy if exists "Members can create questions" on public.questions;
create policy "Members can create questions"
  on public.questions
  for insert
  to authenticated
  with check (
    asked_by = auth.uid()
    and exists (
      select 1
      from public.sessions s
      where s.id = public.questions.session_id
        and public.is_group_member(s.group_id)
    )
  );

drop policy if exists "Members can update questions" on public.questions;
create policy "Members can update questions"
  on public.questions
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = public.questions.session_id
        and public.is_group_member(s.group_id)
    )
  )
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = public.questions.session_id
        and public.is_group_member(s.group_id)
    )
  );

drop policy if exists "Members can read answers" on public.answers;
create policy "Members can read answers"
  on public.answers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.questions q
      join public.sessions s on s.id = q.session_id
      where q.id = public.answers.question_id
        and public.is_group_member(s.group_id)
    )
  );

drop policy if exists "Members can insert own answers" on public.answers;
create policy "Members can insert own answers"
  on public.answers
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.questions q
      join public.sessions s on s.id = q.session_id
      where q.id = public.answers.question_id
        and public.is_group_member(s.group_id)
    )
  );

drop policy if exists "Members can update own answers" on public.answers;
create policy "Members can update own answers"
  on public.answers
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
