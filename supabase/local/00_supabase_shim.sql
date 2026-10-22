-- ---------------------------------------------------------------------------
-- LOCAL DEVELOPMENT ONLY
-- Emulates the parts of Supabase's platform schema that Bloom's migrations
-- depend on (auth.users, auth.uid(), the anon/authenticated/service_role
-- roles). Never run this against a real Supabase project: Supabase already
-- provides these objects.
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

-- Same contract as Supabase: the JWT subject of the current request.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ), ''
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  )
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;

-- Local password store standing in for Supabase Auth. Not reachable by the
-- authenticated role.
create schema if not exists local_auth;
create table if not exists local_auth.credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  password_hash text not null,
  updated_at timestamptz not null default now()
);
revoke all on schema local_auth from public, anon, authenticated;

-- The server role signs users in and provisions teacher-managed accounts.
grant usage on schema local_auth to service_role;
grant select, insert, update, delete on local_auth.credentials to service_role;
grant select, insert, update on auth.users to service_role;
