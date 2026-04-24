create index if not exists idx_questions_session_id_launched_at_order_desc
  on public.questions (session_id, launched_at desc, order_index desc)
  where launched_at is not null;

create or replace function public.sync_user_questions_answered()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.users
    set questions_answered = questions_answered + 1
    where id = new.user_id;

    return new;
  elsif tg_op = 'DELETE' then
    update public.users
    set questions_answered = greatest(questions_answered - 1, 0)
    where id = old.user_id;

    return old;
  elsif tg_op = 'UPDATE' then
    if old.user_id is distinct from new.user_id then
      update public.users
      set questions_answered = greatest(questions_answered - 1, 0)
      where id = old.user_id;

      update public.users
      set questions_answered = questions_answered + 1
      where id = new.user_id;
    end if;

    return new;
  end if;

  return null;
end;
$$;
