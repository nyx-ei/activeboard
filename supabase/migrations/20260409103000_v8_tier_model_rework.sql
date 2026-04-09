alter table public.users
  add column if not exists questions_answered integer not null default 0;

update public.users
set questions_answered = source.answer_count
from (
  select user_id, count(*)::integer as answer_count
  from public.answers
  group by user_id
) as source
where public.users.id = source.user_id;

update public.users
set questions_answered = 0
where questions_answered is null;

create or replace function public.compute_user_tier(
  questions_answered_input integer,
  has_valid_payment_method_input boolean,
  subscription_status_input text
)
returns text
language plpgsql
immutable
as $$
begin
  if coalesce(questions_answered_input, 0) < 100 then
    return 'trial';
  end if;

  if subscription_status_input in ('active', 'trialing') then
    return 'active';
  end if;

  if coalesce(has_valid_payment_method_input, false) = true then
    return 'dormant';
  end if;

  return 'locked';
end;
$$;

alter table public.users
  alter column user_tier set default 'trial';

alter table public.users
  drop constraint if exists users_user_tier_check;

update public.users
set user_tier = public.compute_user_tier(questions_answered, has_valid_payment_method, subscription_status);

alter table public.users
  add constraint users_user_tier_check
  check (user_tier in ('trial', 'locked', 'active', 'dormant'));

create or replace function public.sync_user_tier_from_progress_and_billing_fields()
returns trigger
language plpgsql
as $$
begin
  new.user_tier := public.compute_user_tier(
    new.questions_answered,
    new.has_valid_payment_method,
    new.subscription_status
  );
  new.billing_updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists sync_user_tier_from_billing_fields on public.users;
drop trigger if exists sync_user_tier_from_progress_and_billing_fields on public.users;

create trigger sync_user_tier_from_progress_and_billing_fields
before insert or update of questions_answered, has_valid_payment_method, subscription_status
on public.users
for each row
execute function public.sync_user_tier_from_progress_and_billing_fields();

create or replace function public.sync_user_questions_answered()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.users
    set questions_answered = (
      select count(*)::integer
      from public.answers
      where user_id = new.user_id
    )
    where id = new.user_id;

    return new;
  elsif tg_op = 'DELETE' then
    update public.users
    set questions_answered = (
      select count(*)::integer
      from public.answers
      where user_id = old.user_id
    )
    where id = old.user_id;

    return old;
  elsif tg_op = 'UPDATE' then
    if old.user_id is distinct from new.user_id then
      update public.users
      set questions_answered = (
        select count(*)::integer
        from public.answers
        where user_id = old.user_id
      )
      where id = old.user_id;
    end if;

    update public.users
    set questions_answered = (
      select count(*)::integer
      from public.answers
      where user_id = new.user_id
    )
    where id = new.user_id;

    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists sync_user_questions_answered on public.answers;

create trigger sync_user_questions_answered
after insert or delete or update of user_id
on public.answers
for each row
execute function public.sync_user_questions_answered();
