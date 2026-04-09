create or replace function public.is_feature_flag_enabled(target_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select ff.enabled
      from public.feature_flags ff
      where ff.key = target_key
    ),
    false
  );
$$;

create or replace function public.current_user_tier_value()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.user_tier::text
  from public.users u
  where u.id = auth.uid();
$$;

create or replace function public.current_user_can_run_core_flows()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.is_feature_flag_enabled('canEnforceUserTierGating') then true
    else coalesce(public.current_user_tier_value() in ('trial', 'active'), true)
  end;
$$;

drop policy if exists "Authenticated users can create groups" on public.groups;
create policy "Authenticated users can create groups"
  on public.groups
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.current_user_can_run_core_flows()
  );

drop policy if exists "Users can join groups as themselves" on public.group_members;
create policy "Users can join groups as themselves"
  on public.group_members
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.current_user_can_run_core_flows()
  );

drop policy if exists "Group admins can create invites" on public.group_invites;
create policy "Group admins can create invites"
  on public.group_invites
  for insert
  to authenticated
  with check (
    invited_by = auth.uid()
    and public.is_group_founder(group_id)
    and public.current_user_can_run_core_flows()
  );

drop policy if exists "Members can create sessions" on public.sessions;
create policy "Members can create sessions"
  on public.sessions
  for insert
  to authenticated
  with check (
    public.is_group_member(group_id)
    and created_by = auth.uid()
    and public.current_user_can_run_core_flows()
  );
