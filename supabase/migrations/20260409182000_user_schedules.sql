create table if not exists public.user_schedules (
  user_id uuid primary key references public.users (id) on delete cascade,
  timezone text not null default 'UTC',
  availability_grid jsonb not null default jsonb_build_object(
    'monday', '[]'::jsonb,
    'tuesday', '[]'::jsonb,
    'wednesday', '[]'::jsonb,
    'thursday', '[]'::jsonb,
    'friday', '[]'::jsonb,
    'saturday', '[]'::jsonb,
    'sunday', '[]'::jsonb
  ),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.touch_user_schedule_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists touch_user_schedule_updated_at_trigger on public.user_schedules;
create trigger touch_user_schedule_updated_at_trigger
  before update on public.user_schedules
  for each row
  execute procedure public.touch_user_schedule_updated_at();

alter table public.user_schedules enable row level security;

drop policy if exists "Users can read own schedule" on public.user_schedules;
create policy "Users can read own schedule"
  on public.user_schedules
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can write own schedule" on public.user_schedules;
create policy "Users can write own schedule"
  on public.user_schedules
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
