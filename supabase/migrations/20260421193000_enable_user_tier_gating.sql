insert into public.feature_flags (key, enabled, description)
values (
  'canEnforceUserTierGating',
  true,
  'Enforces user-tier based capability gating.'
)
on conflict (key) do update
set enabled = true;

create or replace function public.current_user_can_run_core_flows()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_tier_value() in ('trial', 'active'), true)
$$;
