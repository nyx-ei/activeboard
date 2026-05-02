create or replace function public.get_session_page_shell(target_session_id uuid)
returns table (
  session_id uuid,
  group_id uuid,
  session_name text,
  scheduled_at timestamptz,
  share_code text,
  started_at timestamptz,
  ended_at timestamptz,
  timer_mode text,
  timer_seconds integer,
  status text,
  meeting_link text,
  leader_id uuid,
  question_goal integer,
  group_name text,
  group_invite_code text,
  is_founder boolean,
  member_count bigint
)
language sql
stable
security invoker
as $$
  select
    s.id as session_id,
    s.group_id,
    s.name as session_name,
    s.scheduled_at,
    s.share_code,
    s.started_at,
    s.ended_at,
    s.timer_mode,
    s.timer_seconds,
    s.status,
    s.meeting_link,
    s.leader_id,
    s.question_goal,
    g.name as group_name,
    g.invite_code as group_invite_code,
    gm.is_founder,
    coalesce(gms.member_count, 0)::bigint as member_count
  from public.sessions s
  join public.group_members gm
    on gm.group_id = s.group_id
   and gm.user_id = auth.uid()
  join public.groups g on g.id = s.group_id
  left join public.group_member_stats gms on gms.group_id = s.group_id
  where s.id = target_session_id
  limit 1;
$$;

grant execute on function public.get_session_page_shell(uuid) to authenticated;
