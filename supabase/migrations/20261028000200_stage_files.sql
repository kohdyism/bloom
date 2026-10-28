-- Files a teacher attaches straight to one stage's instructions (pictures,
-- PDFs). Stored with the lesson's materials so the same access rules apply,
-- but kept out of the general "materials" list.
alter table public.lesson_materials drop constraint if exists lesson_materials_kind_check;
alter table public.lesson_materials add constraint lesson_materials_kind_check
  check (kind in ('text', 'file', 'link', 'stage_file'));
