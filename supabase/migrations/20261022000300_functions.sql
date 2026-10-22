-- ===========================================================================
-- Server role grants, join flow, realtime notification
-- ===========================================================================

grant usage on schema public, private to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema private to service_role;

-- ---------------------------------------------------------------------------
-- Join a live session with a classroom code.
-- Knowing the code is NOT sufficient: the caller must be an authenticated
-- student enrolled in the session's class, the session must not have ended
-- and the code must not have expired.
-- ---------------------------------------------------------------------------
create or replace function public.join_session_by_code(p_code text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_session activity_sessions%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_session from activity_sessions
  where join_code = upper(trim(p_code)) and status <> 'ended'
  limit 1;

  if not found then
    raise exception 'code_not_found' using errcode = 'P0002';
  end if;
  if v_session.join_code_expires_at < now()
     and not exists (select 1 from session_participants
                     where session_id = v_session.id and student_id = v_uid) then
    raise exception 'code_expired' using errcode = 'P0001';
  end if;
  if not exists (select 1 from class_memberships
                 where class_id = v_session.class_id and student_id = v_uid) then
    raise exception 'not_enrolled' using errcode = '42501';
  end if;

  insert into session_participants (session_id, student_id)
  values (v_session.id, v_uid)
  on conflict (session_id, student_id) do update set last_seen_at = now();

  return v_session.id;
end $$;
revoke all on function public.join_session_by_code(text) from public, anon;
grant execute on function public.join_session_by_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: every row in realtime_events wakes listeners with its id only
-- (pg_notify payloads are capped at 8KB; listeners read the row itself).
-- ---------------------------------------------------------------------------
create or replace function private.notify_realtime_event() returns trigger
language plpgsql as $$
begin
  perform pg_notify('bloom_realtime', new.id::text);
  return new;
end $$;

create trigger realtime_events_notify
after insert on public.realtime_events
for each row execute function private.notify_realtime_event();

-- updated_at maintenance
create or replace function private.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

create trigger lessons_touch before update on public.lessons
  for each row execute function private.touch_updated_at();
create trigger ideas_touch before update on public.individual_ideas
  for each row execute function private.touch_updated_at();
create trigger help_touch before update on public.help_requests
  for each row execute function private.touch_updated_at();
create trigger groups_touch before update on public.session_groups
  for each row execute function private.touch_updated_at();
