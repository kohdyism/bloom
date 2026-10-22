-- ===========================================================================
-- Bloom core schema
-- Runs unchanged on Supabase Postgres and on the local shim
-- (supabase/local/00_supabase_shim.sql).
--
-- Access model
--   * Every table has row-level security enabled.
--   * The application performs user requests inside a transaction that sets
--     `role authenticated` and `request.jwt.claims`, so these policies are the
--     final authority on what a user can read or write.
--   * A small number of server-authoritative operations (stage transitions,
--     AI-authored messages, realtime event log) run as the privileged server
--     connection, only after the application has verified the caller.
-- ===========================================================================

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('teacher', 'student')),
  display_name text not null check (char_length(display_name) between 1 and 80),
  username text not null unique check (username ~ '^[a-z0-9._-]{3,40}$'),
  avatar_color text not null default 'teal',
  avatar_icon text not null default 'leaf',
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Classes and enrolment
-- ---------------------------------------------------------------------------
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  subject text not null default '',
  year_level text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index classes_teacher_idx on public.classes(teacher_id);

create table public.class_memberships (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index class_memberships_student_idx on public.class_memberships(student_id);

-- Student-owned working-style survey and accessibility preferences.
create table public.student_preferences (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  survey jsonb not null default '{}'::jsonb,
  accessibility jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Functional (non-diagnostic) accommodations. The student can see which
-- functional supports are switched on for them; free-text teacher notes live
-- in teacher_private_notes, which students can never read.
create table public.student_accommodations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in (
    'smaller_groups', 'extra_processing_time', 'written_instructions',
    'explicit_turn_taking', 'reduced_sensory', 'task_breakdown')),
  created_at timestamptz not null default now(),
  unique (student_id, kind)
);

create table public.teacher_private_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) <= 4000),
  updated_at timestamptz not null default now(),
  unique (student_id, teacher_id)
);

create table public.grouping_constraints (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  kind text not null check (kind in ('keep_apart', 'keep_together')),
  student_a uuid not null references public.profiles(id) on delete cascade,
  student_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (student_a <> student_b),
  unique (class_id, student_a, student_b)
);

-- ---------------------------------------------------------------------------
-- Lessons
-- ---------------------------------------------------------------------------
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '',
  subject text not null default '',
  year_level text not null default '',
  objectives text[] not null default '{}',
  config jsonb not null default '{}'::jsonb,
  is_template boolean not null default false,
  source text not null default 'scratch' check (source in ('scratch', 'template', 'ai')),
  ai_draft_approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lessons_teacher_idx on public.lessons(teacher_id);

create table public.lesson_stages (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  position int not null,
  kind text not null check (kind in (
    'orientation', 'role_selection', 'brainstorm', 'synthesis', 'discussion',
    'voting', 'creation', 'physical', 'submission', 'presentation', 'reflection')),
  title text not null,
  instructions text not null default '',
  duration_seconds int not null default 300 check (duration_seconds between 0 and 7200),
  config jsonb not null default '{}'::jsonb,
  unique (lesson_id, position) deferrable initially deferred
);

create table public.lesson_materials (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  kind text not null check (kind in ('text', 'file', 'link')),
  title text not null,
  body text not null default '',
  storage_path text,
  mime_type text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Live sessions
-- ---------------------------------------------------------------------------
create table public.activity_sessions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'active', 'paused', 'ended')),
  groups_approved boolean not null default false,
  join_code text not null,
  join_code_expires_at timestamptz not null,
  display_token text not null unique,
  -- Frozen copy of the lesson's stages and config at launch, so edits to the
  -- lesson never change a running session.
  snapshot jsonb not null,
  presentation jsonb,
  started_at timestamptz,
  paused_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index activity_sessions_live_code_idx
  on public.activity_sessions(join_code) where status <> 'ended';
create index activity_sessions_teacher_idx on public.activity_sessions(teacher_id);

create table public.session_participants (
  session_id uuid not null references public.activity_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (session_id, student_id)
);

create table public.session_groups (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.activity_sessions(id) on delete cascade,
  name text not null,
  color text not null,
  position int not null,
  stage_index int not null default 0,
  stage_status text not null default 'waiting' check (stage_status in ('waiting', 'active', 'ready_check', 'complete')),
  stage_started_at timestamptz,
  stage_deadline timestamptz,
  remaining_seconds_on_pause int,
  paused boolean not null default false,
  ai_enabled boolean not null default true,
  milestones int not null default 0,
  updated_at timestamptz not null default now()
);
create index session_groups_session_idx on public.session_groups(session_id);

create table public.group_members (
  session_id uuid not null references public.activity_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.session_groups(id) on delete cascade,
  primary key (session_id, student_id)
);
create index group_members_group_idx on public.group_members(group_id);

create table public.group_roles (
  group_id uuid not null references public.session_groups(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  role_key text not null check (char_length(role_key) between 1 and 40),
  created_at timestamptz not null default now(),
  primary key (group_id, student_id, role_key)
);

create table public.stage_readiness (
  group_id uuid not null references public.session_groups(id) on delete cascade,
  stage_index int not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  state text not null check (state in ('ready', 'need_time')),
  updated_at timestamptz not null default now(),
  primary key (group_id, stage_index, student_id)
);

-- ---------------------------------------------------------------------------
-- Ideas, synthesis, discussion, voting
-- ---------------------------------------------------------------------------
create table public.individual_ideas (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.session_groups(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  stage_index int not null,
  body text not null check (char_length(body) between 1 and 1000),
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  shared boolean not null default false,
  builds_on uuid references public.individual_ideas(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index individual_ideas_group_idx on public.individual_ideas(group_id, stage_index);

-- clusters: [{ id, title, summary, idea_ids: uuid[] }]
create table public.idea_syntheses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.session_groups(id) on delete cascade,
  version int not null,
  origin text not null check (origin in ('ai', 'ai_simulated', 'offline_helper', 'student_edit')),
  clusters jsonb not null,
  note text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (group_id, version)
);

create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.session_groups(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('student', 'teacher', 'ai', 'system')),
  ai_origin text check (ai_origin in ('ai', 'ai_simulated', 'offline_helper')),
  body text not null check (char_length(body) between 1 and 2000),
  reply_to uuid references public.group_messages(id) on delete set null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  check ((kind in ('student', 'teacher')) = (author_id is not null))
);
create index group_messages_group_idx on public.group_messages(group_id, created_at);

create table public.message_reactions (
  message_id uuid not null references public.group_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('applaud', 'agree', 'build', 'question')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, kind)
);

create table public.hand_raises (
  group_id uuid not null references public.session_groups(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  raised_at timestamptz not null default now(),
  primary key (group_id, student_id)
);

create table public.votes (
  group_id uuid not null references public.session_groups(id) on delete cascade,
  stage_index int not null,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  target_id text not null,
  created_at timestamptz not null default now(),
  primary key (group_id, stage_index, voter_id, target_id)
);

-- ---------------------------------------------------------------------------
-- Private AI assistant (student-only transcripts)
-- ---------------------------------------------------------------------------
create table public.private_ai_messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.activity_sessions(id) on delete cascade,
  role text not null check (role in ('student', 'assistant')),
  action text not null default 'question',
  origin text check (origin in ('ai', 'ai_simulated', 'offline_helper', 'facilitator_nudge')),
  body text not null check (char_length(body) between 1 and 6000),
  created_at timestamptz not null default now()
);
create index private_ai_messages_owner_idx on public.private_ai_messages(student_id, session_id, created_at);

-- ---------------------------------------------------------------------------
-- Collaborative artifacts (Yjs CRDT update log + compacted snapshot)
-- ---------------------------------------------------------------------------
create table public.collaborative_artifacts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.session_groups(id) on delete cascade,
  kind text not null check (kind in ('document', 'whiteboard', 'slides')),
  title text not null default '',
  snapshot bytea,
  updated_at timestamptz not null default now(),
  unique (group_id, kind)
);

create table public.artifact_updates (
  id bigserial primary key,
  artifact_id uuid not null references public.collaborative_artifacts(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  client_update_id text not null,
  update bytea not null,
  created_at timestamptz not null default now(),
  unique (artifact_id, client_update_id)
);
create index artifact_updates_artifact_idx on public.artifact_updates(artifact_id, id);

create table public.media_uploads (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.session_groups(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 8 * 1024 * 1024),
  caption text not null default '',
  created_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.session_groups(id) on delete cascade,
  version int not null,
  status text not null default 'submitted' check (status in ('submitted', 'reviewed', 'returned')),
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  content jsonb not null,
  feedback text not null default '',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (group_id, version)
);

create table public.presentation_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.session_groups(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Teacher assistance, messaging, announcements
-- ---------------------------------------------------------------------------
create table public.help_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.activity_sessions(id) on delete cascade,
  group_id uuid references public.session_groups(id) on delete set null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in (
    'dont_understand', 'need_time', 'group_help', 'speak_to_teacher', 'uncomfortable', 'other')),
  message text not null default '' check (char_length(message) <= 1000),
  priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  status text not null default 'sent' check (status in ('sent', 'seen', 'responding', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index help_requests_session_idx on public.help_requests(session_id, status);

create table public.teacher_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.activity_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  help_request_id uuid references public.help_requests(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index teacher_messages_thread_idx on public.teacher_messages(session_id, student_id, created_at);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.activity_sessions(id) on delete cascade,
  group_id uuid references public.session_groups(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Reflection and reporting
-- ---------------------------------------------------------------------------
create table public.reflection_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.activity_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  ratings jsonb not null,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create table public.lesson_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.activity_sessions(id) on delete cascade,
  summary jsonb not null,
  origin text not null check (origin in ('ai', 'ai_simulated', 'offline_helper')),
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigserial primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  session_id uuid references public.activity_sessions(id) on delete cascade,
  action text not null,
  target text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_session_idx on public.audit_events(session_id, created_at);

-- ---------------------------------------------------------------------------
-- Server-only infrastructure (no grants to authenticated)
-- ---------------------------------------------------------------------------
-- Durable event log behind realtime delivery. Clients never read it directly:
-- the realtime endpoint authorises each channel and replays from here.
create table public.realtime_events (
  id bigserial primary key,
  channel text not null,
  event text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index realtime_events_channel_idx on public.realtime_events(channel, id);

-- De-duplication of AI facilitator triggers (prevents intervention loops).
create table public.ai_interventions (
  group_id uuid not null references public.session_groups(id) on delete cascade,
  trigger_key text not null,
  created_at timestamptz not null default now(),
  primary key (group_id, trigger_key)
);

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null
);
