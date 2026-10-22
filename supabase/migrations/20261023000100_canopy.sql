-- Canopy: "Talk time" stages, collectible flowers, and submission that
-- moves the group on by itself once the work is in.

-- 1. A new stage kind: screens down, talk in person.
alter table public.lesson_stages drop constraint if exists lesson_stages_kind_check;
alter table public.lesson_stages add constraint lesson_stages_kind_check check (kind in (
  'orientation', 'role_selection', 'brainstorm', 'synthesis', 'talk', 'discussion',
  'voting', 'creation', 'physical', 'submission', 'presentation', 'reflection'));

-- 2. The flower a group's plant opened into when it finished every stage.
alter table public.session_groups add column if not exists flower text;

-- 3. Demo lessons: add Talk time after the ideas are grouped, and let a group
--    move on from Submission once it has submitted (instead of waiting for
--    the teacher). Only the seeded demo lessons are touched.
do $$
declare
  rec record;
  syn int;
begin
  for rec in select id from public.lessons where title in ('Reading ''Alone'' together', 'School Improvement Challenge') loop
    if exists (select 1 from public.lesson_stages where lesson_id = rec.id and kind = 'talk') then continue; end if;
    select position into syn from public.lesson_stages where lesson_id = rec.id and kind = 'synthesis' order by position limit 1;
    if syn is null then continue; end if;
    update public.lesson_stages set position = position + 1 where lesson_id = rec.id and position > syn;
    insert into public.lesson_stages(lesson_id, position, kind, title, instructions, duration_seconds, config)
    values (rec.id, syn + 1, 'talk', 'Talk time',
      'Take turns sharing your ideas out loud. Which idea surprised you most, and why?',
      240, '{"completion":"all_ready","minIdeasPerStudent":1,"artifacts":[],"votesPerStudent":3,"checkins":[],"evidenceUpload":false,"prompts":[]}'::jsonb);
  end loop;
  update public.lesson_stages st set config = jsonb_set(st.config, '{completion}', '"all_ready"')
  from public.lessons les
  where les.id = st.lesson_id and st.kind = 'submission' and st.config ->> 'completion' = 'teacher_only'
    and les.title in ('Reading ''Alone'' together', 'Paper Aeroplane Challenge', 'School Improvement Challenge');
end $$;
