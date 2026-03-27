drop policy if exists "Members can read groups" on public.groups;

create policy "Members can read groups"
  on public.groups
  for select
  to authenticated
  using (public.is_group_member(id) or created_by = auth.uid());
