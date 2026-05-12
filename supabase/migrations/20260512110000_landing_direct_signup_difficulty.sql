alter table public.groups
  drop constraint if exists groups_max_members_check;

alter table public.groups
  add constraint groups_max_members_check
  check (max_members between 1 and 6);

alter table public.groups
  add column if not exists difficulty_level text not null default 'medium';

alter table public.groups
  drop constraint if exists groups_difficulty_level_check;

alter table public.groups
  add constraint groups_difficulty_level_check
  check (difficulty_level in ('low', 'medium', 'high'));
