-- ===========================================================================
-- Row-level security
-- Helper predicates are SECURITY DEFINER so policies can consult membership
-- tables without recursive RLS evaluation. They only ever answer questions
-- about the *current* user (auth.uid()).
-- ===========================================================================

create or replace function private.is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'teacher')
$$;

create or replace function private.is_class_teacher(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from classes where id = p_class and teacher_id = auth.uid())
$$;

create or replace function private.is_class_member(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from class_memberships where class_id = p_class and student_id = auth.uid())
$$;

-- Teacher of any class the student is enrolled in.
create or replace function private.teaches_student(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from class_memberships m join classes c on c.id = m.class_id
    where m.student_id = p_student and c.teacher_id = auth.uid())
$$;

-- Current user and p_user share at least one class (as teacher or student).
create or replace function private.shares_class(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from class_memberships a join class_memberships b on a.class_id = b.class_id
    where a.student_id = auth.uid() and b.student_id = p_user)
  or exists (
    select 1 from class_memberships m join classes c on c.id = m.class_id
    where (c.teacher_id = auth.uid() and m.student_id = p_user)
       or (c.teacher_id = p_user and m.student_id = auth.uid()))
$$;

create or replace function private.is_session_teacher(p_session uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from activity_sessions where id = p_session and teacher_id = auth.uid())
$$;

create or replace function private.is_session_participant(p_session uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from session_participants where session_id = p_session and student_id = auth.uid())
$$;

create or replace function private.is_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = p_group and student_id = auth.uid())
$$;

create or replace function private.is_group_teacher(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from session_groups g join activity_sessions s on s.id = g.session_id
    where g.id = p_group and s.teacher_id = auth.uid())
$$;

create or replace function private.message_group(p_message uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select group_id from group_messages where id = p_message
$$;

create or replace function private.lesson_visible_to_student(p_lesson uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from activity_sessions s join session_participants p on p.session_id = s.id
    where s.lesson_id = p_lesson and p.student_id = auth.uid())
$$;

grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Table privileges: authenticated gets DML; RLS decides which rows.
-- anon gets nothing at all.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on public.realtime_events, public.ai_interventions, public.rate_limits from authenticated;
revoke all on all tables in schema public from anon;

-- Profiles: role and username are immutable for end users.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_color, avatar_icon, onboarded_at) on public.profiles to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','classes','class_memberships','student_preferences','student_accommodations',
    'teacher_private_notes','grouping_constraints','lessons','lesson_stages','lesson_materials',
    'activity_sessions','session_participants','session_groups','group_members','group_roles',
    'stage_readiness','individual_ideas','idea_syntheses','group_messages','message_reactions',
    'hand_raises','votes','private_ai_messages','collaborative_artifacts','artifact_updates',
    'media_uploads','submissions','presentation_requests','help_requests','teacher_messages',
    'announcements','reflection_responses','lesson_reports','audit_events','realtime_events',
    'ai_interventions','rate_limits']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- profiles -------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or private.shares_class(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_teacher on public.profiles for update to authenticated
  using (private.teaches_student(id)) with check (private.teaches_student(id));

-- classes ---------------------------------------------------------------------
create policy classes_teacher_all on public.classes for all to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid() and private.is_teacher());
create policy classes_student_select on public.classes for select to authenticated
  using (private.is_class_member(id));

-- class_memberships ---------------------------------------------------------
create policy memberships_teacher_all on public.class_memberships for all to authenticated
  using (private.is_class_teacher(class_id)) with check (private.is_class_teacher(class_id));
create policy memberships_student_select on public.class_memberships for select to authenticated
  using (student_id = auth.uid() or private.is_class_member(class_id));

-- student_preferences ---------------------------------------------------------
create policy prefs_self_all on public.student_preferences for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy prefs_teacher_select on public.student_preferences for select to authenticated
  using (private.teaches_student(student_id));

-- student_accommodations: teacher manages; student may read their own list --
create policy accommodations_teacher_all on public.student_accommodations for all to authenticated
  using (private.teaches_student(student_id))
  with check (private.teaches_student(student_id) and created_by = auth.uid());
create policy accommodations_self_select on public.student_accommodations for select to authenticated
  using (student_id = auth.uid());

-- teacher_private_notes: author teacher only -----------------------------------
create policy notes_teacher_all on public.teacher_private_notes for all to authenticated
  using (teacher_id = auth.uid() and private.teaches_student(student_id))
  with check (teacher_id = auth.uid() and private.teaches_student(student_id));

-- grouping_constraints ----------------------------------------------------------
create policy constraints_teacher_all on public.grouping_constraints for all to authenticated
  using (private.is_class_teacher(class_id)) with check (private.is_class_teacher(class_id));

-- lessons / stages / materials -------------------------------------------------
create policy lessons_owner_all on public.lessons for all to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid() and private.is_teacher());
create policy stages_owner_all on public.lesson_stages for all to authenticated
  using (exists (select 1 from lessons l where l.id = lesson_id and l.teacher_id = auth.uid()))
  with check (exists (select 1 from lessons l where l.id = lesson_id and l.teacher_id = auth.uid()));
create policy materials_owner_all on public.lesson_materials for all to authenticated
  using (exists (select 1 from lessons l where l.id = lesson_id and l.teacher_id = auth.uid()))
  with check (exists (select 1 from lessons l where l.id = lesson_id and l.teacher_id = auth.uid()));
create policy materials_participant_select on public.lesson_materials for select to authenticated
  using (private.lesson_visible_to_student(lesson_id));

-- activity_sessions -------------------------------------------------------------
create policy sessions_teacher_all on public.activity_sessions for all to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid() and private.is_class_teacher(class_id));
create policy sessions_student_select on public.activity_sessions for select to authenticated
  using (private.is_session_participant(id));

-- session_participants -----------------------------------------------------------
create policy participants_teacher_all on public.session_participants for all to authenticated
  using (private.is_session_teacher(session_id)) with check (private.is_session_teacher(session_id));
create policy participants_select on public.session_participants for select to authenticated
  using (student_id = auth.uid() or private.is_session_participant(session_id));
create policy participants_self_insert on public.session_participants for insert to authenticated
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from activity_sessions s
      where s.id = session_id and s.status <> 'ended' and private.is_class_member(s.class_id)));
create policy participants_self_update on public.session_participants for update to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- session_groups: participants read (names/progress); only teacher writes ------
create policy groups_teacher_all on public.session_groups for all to authenticated
  using (private.is_session_teacher(session_id)) with check (private.is_session_teacher(session_id));
create policy groups_participant_select on public.session_groups for select to authenticated
  using (private.is_session_participant(session_id));

-- group_members --------------------------------------------------------------------
create policy members_teacher_all on public.group_members for all to authenticated
  using (private.is_session_teacher(session_id)) with check (private.is_session_teacher(session_id));
create policy members_select on public.group_members for select to authenticated
  using (student_id = auth.uid() or private.is_group_member(group_id));

-- group_roles ------------------------------------------------------------------------
create policy roles_teacher_all on public.group_roles for all to authenticated
  using (private.is_group_teacher(group_id)) with check (private.is_group_teacher(group_id));
create policy roles_member_select on public.group_roles for select to authenticated
  using (private.is_group_member(group_id));
create policy roles_self_insert on public.group_roles for insert to authenticated
  with check (student_id = auth.uid() and private.is_group_member(group_id));
create policy roles_self_delete on public.group_roles for delete to authenticated
  using (student_id = auth.uid() and private.is_group_member(group_id));

-- stage_readiness ----------------------------------------------------------------------
create policy readiness_member_select on public.stage_readiness for select to authenticated
  using (private.is_group_member(group_id) or private.is_group_teacher(group_id));
create policy readiness_self_write on public.stage_readiness for insert to authenticated
  with check (student_id = auth.uid() and private.is_group_member(group_id));
create policy readiness_self_update on public.stage_readiness for update to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid() and private.is_group_member(group_id));
create policy readiness_self_delete on public.stage_readiness for delete to authenticated
  using (student_id = auth.uid());

-- individual_ideas: private to the author until shared ---------------------------------
create policy ideas_author_all on public.individual_ideas for all to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and private.is_group_member(group_id));
create policy ideas_group_shared_select on public.individual_ideas for select to authenticated
  using (shared and status = 'submitted' and private.is_group_member(group_id));
create policy ideas_teacher_select on public.individual_ideas for select to authenticated
  using (private.is_group_teacher(group_id));

-- idea_syntheses ------------------------------------------------------------------------
create policy syntheses_member_select on public.idea_syntheses for select to authenticated
  using (private.is_group_member(group_id) or private.is_group_teacher(group_id));
create policy syntheses_member_insert on public.idea_syntheses for insert to authenticated
  with check (origin = 'student_edit' and created_by = auth.uid() and private.is_group_member(group_id));

-- group_messages ------------------------------------------------------------------------
create policy messages_select on public.group_messages for select to authenticated
  using (private.is_group_member(group_id) or private.is_group_teacher(group_id));
create policy messages_student_insert on public.group_messages for insert to authenticated
  with check (kind = 'student' and author_id = auth.uid() and private.is_group_member(group_id));
create policy messages_teacher_insert on public.group_messages for insert to authenticated
  with check (kind = 'teacher' and author_id = auth.uid() and private.is_group_teacher(group_id));
create policy messages_pin_update on public.group_messages for update to authenticated
  using (private.is_group_member(group_id) or private.is_group_teacher(group_id))
  with check (private.is_group_member(group_id) or private.is_group_teacher(group_id));
revoke update on public.group_messages from authenticated;
grant update (pinned) on public.group_messages to authenticated;

-- message_reactions / hand_raises / votes ---------------------------------------------
create policy reactions_select on public.message_reactions for select to authenticated
  using (private.is_group_member(private.message_group(message_id))
      or private.is_group_teacher(private.message_group(message_id)));
create policy reactions_self_insert on public.message_reactions for insert to authenticated
  with check (user_id = auth.uid() and private.is_group_member(private.message_group(message_id)));
create policy reactions_self_delete on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

create policy hands_select on public.hand_raises for select to authenticated
  using (private.is_group_member(group_id) or private.is_group_teacher(group_id));
create policy hands_self_insert on public.hand_raises for insert to authenticated
  with check (student_id = auth.uid() and private.is_group_member(group_id));
create policy hands_delete on public.hand_raises for delete to authenticated
  using (student_id = auth.uid() or private.is_group_teacher(group_id));

create policy votes_select on public.votes for select to authenticated
  using (private.is_group_member(group_id) or private.is_group_teacher(group_id));
create policy votes_self_insert on public.votes for insert to authenticated
  with check (voter_id = auth.uid() and private.is_group_member(group_id));
create policy votes_self_delete on public.votes for delete to authenticated
  using (voter_id = auth.uid());

-- private_ai_messages: the student only. No teacher policy by design. ---------------
create policy private_ai_self_select on public.private_ai_messages for select to authenticated
  using (student_id = auth.uid());
create policy private_ai_self_insert on public.private_ai_messages for insert to authenticated
  with check (student_id = auth.uid() and role = 'student' and private.is_session_participant(session_id));

-- Teachers get aggregate metadata only (assistance category + counts).
create or replace function public.private_ai_usage(p_session uuid)
returns table (student_id uuid, action text, request_count bigint)
language sql stable security definer set search_path = public as $$
  select m.student_id, m.action, count(*)
  from private_ai_messages m
  where m.session_id = p_session and m.role = 'student' and private.is_session_teacher(p_session)
  group by m.student_id, m.action
$$;
revoke all on function public.private_ai_usage(uuid) from public, anon;
grant execute on function public.private_ai_usage(uuid) to authenticated;

-- collaborative artifacts --------------------------------------------------------------
create policy artifacts_select on public.collaborative_artifacts for select to authenticated
  using (private.is_group_member(group_id) or private.is_group_teacher(group_id));
create policy artifacts_member_insert on public.collaborative_artifacts for insert to authenticated
  with check (private.is_group_member(group_id));
create policy artifact_updates_select on public.artifact_updates for select to authenticated
  using (exists (select 1 from collaborative_artifacts a where a.id = artifact_id
                 and (private.is_group_member(a.group_id) or private.is_group_teacher(a.group_id))));
create policy artifact_updates_insert on public.artifact_updates for insert to authenticated
  with check (author_id = auth.uid() and exists (
    select 1 from collaborative_artifacts a where a.id = artifact_id and private.is_group_member(a.group_id)));

create policy media_select on public.media_uploads for select to authenticated
  using (private.is_group_member(group_id) or private.is_group_teacher(group_id));
create policy media_insert on public.media_uploads for insert to authenticated
  with check (uploader_id = auth.uid() and private.is_group_member(group_id));
create policy media_delete on public.media_uploads for delete to authenticated
  using (uploader_id = auth.uid());

-- submissions ---------------------------------------------------------------------------
create policy submissions_select on public.submissions for select to authenticated
  using (private.is_group_member(group_id) or private.is_group_teacher(group_id));
create policy submissions_member_insert on public.submissions for insert to authenticated
  with check (submitted_by = auth.uid() and status = 'submitted' and private.is_group_member(group_id));
create policy submissions_teacher_update on public.submissions for update to authenticated
  using (private.is_group_teacher(group_id)) with check (private.is_group_teacher(group_id));

create policy presreq_select on public.presentation_requests for select to authenticated
  using (private.is_group_member(group_id) or private.is_group_teacher(group_id));
create policy presreq_insert on public.presentation_requests for insert to authenticated
  with check (requested_by = auth.uid() and status = 'pending' and private.is_group_member(group_id));
create policy presreq_teacher_update on public.presentation_requests for update to authenticated
  using (private.is_group_teacher(group_id)) with check (private.is_group_teacher(group_id));

-- help requests & private teacher messaging: never visible to other students -----------
create policy help_self_select on public.help_requests for select to authenticated
  using (student_id = auth.uid());
create policy help_self_insert on public.help_requests for insert to authenticated
  with check (student_id = auth.uid() and status = 'sent' and private.is_session_participant(session_id));
create policy help_teacher_all on public.help_requests for all to authenticated
  using (private.is_session_teacher(session_id)) with check (private.is_session_teacher(session_id));

create policy tmsg_student_select on public.teacher_messages for select to authenticated
  using (student_id = auth.uid());
create policy tmsg_student_insert on public.teacher_messages for insert to authenticated
  with check (student_id = auth.uid() and sender_id = auth.uid() and private.is_session_participant(session_id));
create policy tmsg_teacher_all on public.teacher_messages for all to authenticated
  using (private.is_session_teacher(session_id))
  with check (private.is_session_teacher(session_id) and sender_id = auth.uid());

create policy announcements_select on public.announcements for select to authenticated
  using (private.is_session_teacher(session_id)
      or (private.is_session_participant(session_id) and (group_id is null or private.is_group_member(group_id))));
create policy announcements_teacher_insert on public.announcements for insert to authenticated
  with check (private.is_session_teacher(session_id));

-- reflection & reports ----------------------------------------------------------------
create policy reflections_self_all on public.reflection_responses for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid() and private.is_session_participant(session_id));
create policy reflections_teacher_select on public.reflection_responses for select to authenticated
  using (private.is_session_teacher(session_id));

create policy reports_teacher_all on public.lesson_reports for all to authenticated
  using (private.is_session_teacher(session_id)) with check (private.is_session_teacher(session_id));

create policy audit_teacher_select on public.audit_events for select to authenticated
  using (actor_id = auth.uid() or (session_id is not null and private.is_session_teacher(session_id)));
create policy audit_teacher_insert on public.audit_events for insert to authenticated
  with check (actor_id = auth.uid() and private.is_teacher());

-- realtime_events, ai_interventions, rate_limits: no policies => no access for
-- authenticated (forced RLS + revoked grants). Server connection only.
