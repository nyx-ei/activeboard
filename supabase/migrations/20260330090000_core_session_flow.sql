create or replace function public.generate_session_share_code()
returns text
language sql
as $$
  select upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
$$;

alter table public.sessions
  add column if not exists share_code text;

update public.sessions
set share_code = public.generate_session_share_code()
where share_code is null;

alter table public.sessions
  alter column share_code set default public.generate_session_share_code();

alter table public.sessions
  alter column share_code set not null;

drop index if exists idx_sessions_share_code;
create unique index if not exists idx_sessions_share_code on public.sessions (share_code);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sessions_share_code_length_check'
  ) then
    alter table public.sessions
      add constraint sessions_share_code_length_check check (char_length(share_code) = 6);
  end if;
end $$;
