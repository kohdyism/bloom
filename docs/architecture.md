# Bloom architecture

Bloom is a single Next.js 16 (App Router) application backed by Postgres. It is
designed to deploy on Vercel + Supabase, and runs fully locally against plain
Postgres for development, demos and tests.

## Key decisions and trade-offs

| Decision | Why | Trade-off |
|---|---|---|
| **RLS is the final authority.** Every user request runs in a transaction with `set local role authenticated` and the user's JWT claims (`src/lib/db/index.ts → asUser`). | The same policies protect data whether the caller is the app, a bug, or a tampered request. Integration tests exercise them directly. | Server-authoritative operations (stage transitions, AI messages, the realtime log) run as `service_role` and are only called after an explicit application-level check. |
| **Supabase-compatible schema, local shim.** Migrations in `supabase/migrations` use `auth.users`, `auth.uid()` and the standard roles. `supabase/local/00_supabase_shim.sql` emulates those for plain Postgres. | One schema for production and tests; no Docker needed locally. | The Supabase Auth adapter (`src/lib/auth/backend.ts`) and Supabase Storage adapter (`src/lib/storage.ts`) are implemented but **not verified** in this repository (no Supabase project was available). |
| **Realtime = durable hints over SSE.** State changes commit first; then a small hint is appended to `realtime_events`, which fires `pg_notify`. Each server instance LISTENs and fans out to authorised SSE connections. Clients refetch their projection. | Realtime is never the system of record; missed events replay by `Last-Event-ID`; protected content never travels through broad channels. | Long-lived SSE connections need a host that allows them (works on Node servers; on Vercel serverless, connections are time-limited but clients reconnect and replay automatically). Supabase Realtime Broadcast/Presence was **not** used — see "Future work". |
| **Yjs CRDTs for shared artifacts.** Each edit is an append-only, idempotent update (`artifact_updates`), merged and periodically compacted into a snapshot. | Concurrent edits merge character-by-character; retries can't duplicate; reconnecting clients merge rather than overwrite. | Presence cursors (awareness) are not implemented. |
| **One object engine for whiteboard and slides** (`src/components/collab/board-canvas.tsx`), stored as per-object `Y.Map`s; slides ordered by a fractional `order` field. | Concurrent edits to different objects/properties never collide; reordering slides never deletes/re-creates one. | Freehand paths are simple polylines; no shape grouping or alignment tools. |
| **Deterministic grouping engine** (`src/lib/domain/grouping.ts`): backtracking for hard rules + local search for soft preferences. | Auditable, explainable, never violates "keep apart", no compatibility scores. AI is not used to make grouping decisions. | Optimises a simple, documented cost, not a learned objective. |
| **Pure stage engine** (`src/lib/domain/stage-engine.ts`) over observable signals; transitions are compare-and-set. | Predictable progression; concurrent readiness taps can't double-advance a group. | Facilitator nudges driven by time are evaluated on student heartbeats (no separate scheduler). |
| **Cache Components disabled.** | Every screen is per-user and live; a static shell gains nothing. | — |

## Module map

```
src/lib/
  config.ts                 env configuration (model names, modes)
  db/                       asUser (RLS) / asServer (service role)
  auth/                     session cookie, local + Supabase backends, provisioning
  security/rate-limit.ts    Postgres-backed fixed-window limits
  domain/                   pure, shared logic: lesson schema, templates, grouping,
                            stage engine, accessibility, artifact model, reflection
  ai/                       core runner + one file per workflow (see ai-workflows.md)
  realtime/                 server fan-out, SSE client hook, live-state hook
  modules/
    classes.ts, lessons.ts  teacher CRUD
    sessions/               common, engine (progression + facilitation),
                            teacher (controls), student (actions), state (projections)
    artifacts.ts            CRDT persistence, submissions
    private-ai.ts           private assistant
    reports.ts              lesson reports, audited reflection drill-down
src/app/
  (auth)/sign-in, join, demo
  teacher/…                 dashboard, classes, students, lessons, sessions, reports
  student/…                 home, welcome survey, session workspace
  display/[token]           public classroom display
  api/…                     live actions, state projections, realtime, artifacts, media
```

## Data flow for a student action

1. Client `POST /api/live/student { action, sessionId, … }` — validated by a zod
   discriminated union (`src/app/api/live/student/route.ts`). There is no
   `groupId` parameter: the server resolves the caller's group from membership.
2. The module runs inside `asUser` → RLS checks every read/write.
3. After commit, `publish()` writes hint events (`group:<id>`, `teacher:<id>`, …).
4. Subscribed clients refetch their projection (`/state`), which is computed
   under RLS for that user.

## Future work (prioritised)

1. Run the Supabase Auth/Storage adapters against a real project and add CI for them.
2. Optional Supabase Realtime transport (private channels with RLS on `realtime.messages`) for serverless hosting.
3. Collaborative cursors/presence in editors; richer slide layouts and image cropping.
4. School-configurable retention jobs (see privacy notes) and a safeguarding escalation workflow agreed with a DSL.
