alter table public.users
  drop constraint if exists users_exam_type_check;

update public.users
set exam_type = 'mccqe_en'
where exam_type = 'mccqe1';

alter table public.users
  add constraint users_exam_type_check
  check (
    exam_type is null
    or exam_type in ('mccqe_fr', 'mccqe_en', 'usmle', 'plab', 'other')
  );
