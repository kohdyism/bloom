-- Flags for the teacher: when moderation catches something in the group chat
-- or in Pip (off-task, unkind, inappropriate), or language that suggests a
-- safeguarding concern. Only the lesson's teacher can read them; students
-- never see who was flagged. The flagged words are kept so the teacher can
-- reveal them on purpose.
create table if not exists public.student_flags (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.activity_sessions(id) on delete cascade,
  group_id uuid references public.session_groups(id) on delete set null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('chat', 'pip')),
  category text not null check (category in ('off_task', 'unkind', 'inappropriate', 'safeguarding')),
  excerpt text not null default '' check (char_length(excerpt) <= 600),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists student_flags_session_idx on public.student_flags(session_id, created_at desc);
alter table public.student_flags enable row level security;
drop policy if exists student_flags_teacher on public.student_flags;
create policy student_flags_teacher on public.student_flags for all to authenticated
  using (private.is_session_teacher(session_id)) with check (private.is_session_teacher(session_id));
grant select, update on public.student_flags to authenticated;
grant all on public.student_flags to service_role;
