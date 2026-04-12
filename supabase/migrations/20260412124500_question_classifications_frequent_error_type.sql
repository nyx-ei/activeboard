alter table public.question_classifications
  add column if not exists frequent_error_type text;

alter table public.question_classifications
  drop constraint if exists question_classifications_frequent_error_type_check;

alter table public.question_classifications
  add constraint question_classifications_frequent_error_type_check
  check (
    frequent_error_type is null
    or frequent_error_type in (
      'knowledge_gap',
      'misread_question',
      'premature_closure',
      'confidence_mismatch',
      'time_pressure',
      'careless_mistake'
    )
  );
