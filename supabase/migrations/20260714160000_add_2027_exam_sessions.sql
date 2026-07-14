alter table public.users
  drop constraint if exists users_exam_session_check;

alter table public.users
  add constraint users_exam_session_check
  check (
    exam_session is null
    or exam_session in (
      'april_may_2026',
      'august_september_2026',
      'october_2026',
      'april_may_2027',
      'august_september_2027',
      'october_2027',
      'planning_ahead'
    )
  );
