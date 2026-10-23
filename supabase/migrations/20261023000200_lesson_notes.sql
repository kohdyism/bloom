-- Past lessons: a private "looking back" note a student can keep for each
-- lesson they took part in. Only the student can read or write it.
create table if not exists public.student_lesson_notes (
  student_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.activity_sessions(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (student_id, session_id)
);
alter table public.student_lesson_notes enable row level security;
drop policy if exists student_lesson_notes_own on public.student_lesson_notes;
create policy student_lesson_notes_own on public.student_lesson_notes
  for all to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
grant select, insert, update, delete on public.student_lesson_notes to authenticated;
grant all on public.student_lesson_notes to service_role;
