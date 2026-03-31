create or replace function public.compute_user_tier(
  has_valid_payment_method_input boolean,
  subscription_status_input text
)
returns text
language plpgsql
immutable
as $$
begin
  if coalesce(has_valid_payment_method_input, false) = false then
    return 'visitor';
  end if;

  if subscription_status_input in ('active', 'trialing') then
    return 'certified_active';
  end if;

  return 'certified_inactive';
end;
$$;

alter table public.users
  add column if not exists user_tier text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_default_payment_method_id text,
  add column if not exists has_valid_payment_method boolean not null default false,
  add column if not exists subscription_status text not null default 'none',
  add column if not exists subscription_current_period_ends_at timestamptz,
  add column if not exists billing_updated_at timestamptz not null default timezone('utc', now());

update public.users
set user_tier = public.compute_user_tier(has_valid_payment_method, subscription_status)
where user_tier is null;

alter table public.users
  alter column user_tier set default 'visitor';

alter table public.users
  alter column user_tier set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_user_tier_check'
  ) then
    alter table public.users
      add constraint users_user_tier_check
      check (user_tier in ('visitor', 'certified_inactive', 'certified_active'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_subscription_status_check'
  ) then
    alter table public.users
      add constraint users_subscription_status_check
      check (
        subscription_status in (
          'none',
          'trialing',
          'active',
          'past_due',
          'canceled',
          'unpaid',
          'incomplete',
          'incomplete_expired',
          'paused'
        )
      );
  end if;
end $$;

create unique index if not exists idx_users_stripe_customer_id
  on public.users (stripe_customer_id)
  where stripe_customer_id is not null;

create or replace function public.sync_user_tier_from_billing_fields()
returns trigger
language plpgsql
as $$
begin
  new.user_tier := public.compute_user_tier(new.has_valid_payment_method, new.subscription_status);
  new.billing_updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists sync_user_tier_from_billing_fields on public.users;
create trigger sync_user_tier_from_billing_fields
before insert or update of has_valid_payment_method, subscription_status
on public.users
for each row
execute function public.sync_user_tier_from_billing_fields();
