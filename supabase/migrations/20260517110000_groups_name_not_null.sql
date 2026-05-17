update public.groups
set name = id::text
where name is null
  or btrim(name) = '';

alter table public.groups
  alter column name set not null;
