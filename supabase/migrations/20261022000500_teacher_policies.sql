-- Teacher interventions that need explicit policies:
--  * restarting a stage clears that stage's readiness taps
--  * starting a lesson whose first stage is collaborative creation
create policy readiness_teacher_all on public.stage_readiness for all to authenticated
  using (private.is_group_teacher(group_id)) with check (private.is_group_teacher(group_id));

create policy artifacts_teacher_insert on public.collaborative_artifacts for insert to authenticated
  with check (private.is_group_teacher(group_id));
