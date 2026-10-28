-- One place where a teacher controls the AI across all of their lessons:
-- extra instructions Bloom and Pip always follow, words students may not use
-- (held back in the chat, ideas and Pip), and whether ideas are checked
-- before the group sees them. Only the teacher can read or change theirs.
create table if not exists public.teacher_ai_settings (
  teacher_id uuid primary key references public.profiles(id) on delete cascade,
  instructions text not null default '' check (char_length(instructions) <= 2000),
  banned_words text[] not null default '{}',
  idea_check boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.teacher_ai_settings enable row level security;
drop policy if exists teacher_ai_settings_own on public.teacher_ai_settings;
create policy teacher_ai_settings_own on public.teacher_ai_settings for all to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid() and private.is_teacher());
grant select, insert, update on public.teacher_ai_settings to authenticated;
grant all on public.teacher_ai_settings to service_role;

-- Ideas held back by the idea check can be flagged to the teacher too.
alter table public.student_flags drop constraint if exists student_flags_source_check;
alter table public.student_flags add constraint student_flags_source_check check (source in ('chat', 'pip', 'idea'));
