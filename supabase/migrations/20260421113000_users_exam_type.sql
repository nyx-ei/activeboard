alter table public.users
  add column if not exists exam_type text;

alter table public.users
  drop constraint if exists users_exam_type_check;

alter table public.users
  add constraint users_exam_type_check
  check (exam_type is null or exam_type in ('mccqe1', 'usmle', 'plab', 'other'));
