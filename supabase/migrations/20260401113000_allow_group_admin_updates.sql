drop policy if exists "Group creators can update groups" on public.groups;

create policy "Group admins can update groups"
  on public.groups
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.group_members gm
      where gm.group_id = public.groups.id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.group_members gm
      where gm.group_id = public.groups.id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
  );
