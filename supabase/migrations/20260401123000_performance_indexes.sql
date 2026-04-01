create index if not exists idx_group_members_group_id_role
  on public.group_members (group_id, role);

create index if not exists idx_group_invites_group_id_status
  on public.group_invites (group_id, status);

create index if not exists idx_group_invites_invitee_user_id_status
  on public.group_invites (invitee_user_id, status);

create index if not exists idx_group_invites_invitee_email_status
  on public.group_invites (invitee_email, status);

create index if not exists idx_sessions_group_id_status_scheduled_at
  on public.sessions (group_id, status, scheduled_at);

create index if not exists idx_questions_session_id_order_index
  on public.questions (session_id, order_index);

create index if not exists idx_answers_question_id_user_id
  on public.answers (question_id, user_id);

create index if not exists idx_group_weekly_schedules_group_id_weekday_start
  on public.group_weekly_schedules (group_id, weekday, start_time);
