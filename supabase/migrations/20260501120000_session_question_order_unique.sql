create unique index if not exists idx_questions_session_id_order_index_unique
  on public.questions (session_id, order_index);
