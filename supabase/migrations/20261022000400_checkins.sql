-- Physical-activity progress check-ins (spec §6.5). A group ticks these off as
-- they work; nothing is recorded from the room itself.
create table public.group_checkins (
  group_id uuid not null references public.session_groups(id) on delete cascade,
  stage_index int not null,
  item_index int not null,
  done_by uuid not null references public.profiles(id) on delete cascade,
  done_at timestamptz not null default now(),
  primary key (group_id, stage_index, item_index)
);
alter table public.group_checkins enable row level security;
alter table public.group_checkins force row level security;
grant select, insert, delete on public.group_checkins to authenticated;
grant all on public.group_checkins to service_role;

create policy checkins_select on public.group_checkins for select to authenticated
  using (private.is_group_member(group_id) or private.is_group_teacher(group_id));
create policy checkins_insert on public.group_checkins for insert to authenticated
  with check (done_by = auth.uid() and private.is_group_member(group_id));
create policy checkins_delete on public.group_checkins for delete to authenticated
  using (private.is_group_member(group_id));

-- Free-text results recorded during physical activities / evidence capture.
alter table public.submissions add column if not exists note text not null default '';
