alter table public.sessions replica identity full;
alter table public.questions replica identity full;
alter table public.answers replica identity full;
alter table public.group_members replica identity full;
alter table public.group_weekly_schedules replica identity full;
alter table public.question_classifications replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.sessions;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.questions;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.answers;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.group_members;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.group_weekly_schedules;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.question_classifications;
exception
  when duplicate_object then null;
end $$;
