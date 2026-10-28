-- After teacher usability tests: the lesson's teacher can read what each
-- student wrote to Pip (and Pip's replies). Students are told this in Pip's
-- panel. Each time a teacher opens a conversation it is written to the audit log.
drop policy if exists private_ai_teacher_select on public.private_ai_messages;
create policy private_ai_teacher_select on public.private_ai_messages for select to authenticated
  using (private.is_session_teacher(session_id));
