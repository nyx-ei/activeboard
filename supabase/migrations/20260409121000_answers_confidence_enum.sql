alter table public.answers
  add column if not exists confidence_v2 text check (confidence_v2 in ('low', 'medium', 'high'));

update public.answers
set confidence_v2 = case
  when confidence is null then null
  when confidence <= 1 then 'low'
  when confidence = 2 then 'medium'
  else 'high'
end
where confidence_v2 is null;

alter table public.answers
  drop column if exists confidence;

alter table public.answers
  rename column confidence_v2 to confidence;
