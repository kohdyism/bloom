-- Lesson library folders, like projects in a design tool: lessons are grouped
-- by class first, and inside a class the teacher can make their own folders.
create table if not exists public.lesson_folders (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);
create index if not exists lesson_folders_teacher_idx on public.lesson_folders(teacher_id, class_id);
alter table public.lesson_folders enable row level security;
drop policy if exists lesson_folders_own on public.lesson_folders;
create policy lesson_folders_own on public.lesson_folders for all to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid() and private.is_teacher());
grant select, insert, update, delete on public.lesson_folders to authenticated;
grant all on public.lesson_folders to service_role;

alter table public.lessons add column if not exists folder_id uuid references public.lesson_folders(id) on delete set null;
