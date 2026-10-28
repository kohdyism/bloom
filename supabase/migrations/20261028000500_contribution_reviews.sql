-- AI-suggested quality rating of one student's written contributions in one
-- lesson. Only the teacher sees it; it reaches the printed progress report
-- only once the teacher has checked and confirmed it.
create table if not exists public.contribution_reviews (
  session_id uuid not null references public.activity_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  criteria jsonb not null,
  summary text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  origin text not null check (origin in ('ai', 'ai_simulated', 'offline_helper')),
  status text not null default 'suggested' check (status in ('suggested', 'confirmed')),
  teacher_note text not null default '' check (char_length(teacher_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, student_id)
);
alter table public.contribution_reviews enable row level security;
drop policy if exists contribution_reviews_teacher on public.contribution_reviews;
create policy contribution_reviews_teacher on public.contribution_reviews for all to authenticated
  using (teacher_id = auth.uid() and private.is_session_teacher(session_id))
  with check (teacher_id = auth.uid() and private.is_session_teacher(session_id));
grant select, insert, update, delete on public.contribution_reviews to authenticated;
grant all on public.contribution_reviews to service_role;
