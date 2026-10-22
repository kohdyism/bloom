# Canopy

**Inclusive classroom collaboration with a supportive AI facilitator.**
Canopy helps secondary students (aged 13–14), including students with SEND,
take part confidently in group work: quiet thinking time before discussion,
screens-down talk time, structured roles, an AI facilitator (Bloom) that helps
the group without taking over, a private learning assistant (Pip), discreet teacher help, and shared documents,
whiteboards and slides that several students can edit at once.

> **Demo status.** This MVP ships with fictional students and simulated,
> non-diagnostic support needs. It is **not approved for real pupil data** —
> see [docs/privacy-and-safeguarding.md](docs/privacy-and-safeguarding.md).

## Contents

- [Quick start](#quick-start)
- [Demo accounts and guided demo](#demo-accounts-and-guided-demo)
- [Configuration](#configuration)
- [Tests](#tests)
- [Deployment](#deployment)
- [Documentation](#documentation)

## Quick start

Requirements: Node.js 20.9+ (22 recommended) and PostgreSQL 15+.

```bash
npm install
cp .env.example .env.local          # then set SESSION_SECRET
createdb bloom                       # or create it in psql
npm run db:reset                     # schema + RLS + fictional demo data (local only)
npm run dev                          # http://localhost:3000
```

Without `ANTHROPIC_API_KEY`, every AI feature runs in a clearly labelled
**simulation mode** (deterministic, offline). Add a key to use Claude.

## Demo accounts and guided demo

| Who | Username | Password |
|---|---|---|
| Teacher (Ms Rivera) | `teacher.demo` | `bloom-demo` |
| Students | `ben.o`, `chloe.m`, `dev.p`, `elena.r`, `felix.t`, … (20 in total) | `bloom-student` |
| First-time student (sees the survey) | `ava.k` | `bloom-student` |

Open **/demo** for a step-by-step walkthrough. In short: sign in as the
teacher in one window, launch *Reading 'Alone' together*, open the classroom
display, then sign in as students in private windows (or other browsers or
devices) and join with the code. Seed lessons:

- **Scenario A — Year 8 Literature:** Think → AI synthesis → Discussion → Collaborative writing → Submission → Presentation.
- **Scenario B — Paper Aeroplane Challenge:** Orientation → Roles → Planning → Build/Test check-ins → Evidence capture → Reflection.
- **Scenario C — School Improvement:** Brainstorm (anonymous) → Cluster → Discuss → Vote → Whiteboard & slides → Submit → Present.

## Configuration

All settings are environment variables — see [.env.example](.env.example).
The important ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection (Supabase: use the direct/session connection). |
| `SESSION_SECRET` | 32+ random characters; signs session cookies (local auth). |
| `BLOOM_AUTH_BACKEND` | `local` (default) or `supabase`. |
| `BLOOM_STORAGE_BACKEND` | `local` (default) or `supabase` (private bucket). |
| `ANTHROPIC_API_KEY` | Enables live AI. Server-only. |
| `BLOOM_AI_MODEL` (+ per-workflow overrides) | Model names are configuration, not code. |
| `BLOOM_AI_MODE` | `auto` or `simulated`. |
| `BLOOM_DEMO_MODE` | Shows the fictional-data banner and demo hints. |

## Tests

```bash
npm run lint && npm run typecheck
npm test                    # unit + integration (needs Postgres; uses a separate bloom_test database)
npm run build
E2E_SERVER_COMMAND="npx next start -p 3100" npm run test:e2e   # Playwright, separate bloom_e2e database
```

- **Unit** (`tests/unit`): grouping engine (hard constraints never violated across seeds, infeasibility explained, variety), stage engine, AI validation and fallbacks, prompt-injection hygiene, safe HTML serialisation, CRDT merging, sessions and passwords.
- **Integration** (`tests/integration`): real migrations and RLS policies — private ideas, private assistant transcripts, help requests, cross-group isolation, spoofed AI/system messages, profile tampering, other teachers, join-code rules, the public display allow-list.
- **End-to-end** (`e2e/`): the brief's 30-step classroom scenario with a teacher, four students in separate authenticated browser contexts and the public display, including URL/API tampering checks; the school-improvement scenario (anonymous brainstorm, voting, whiteboard, slides, presentation); the paper-aeroplane scenario (roles, check-ins, photo evidence, pause/extend, return for revision); and an axe-core WCAG 2.2 AA audit of the main screens in normal and high-contrast modes. If Playwright can't download its browser, set `PLAYWRIGHT_CHROMIUM_PATH` to an installed Chromium. Run E2E against a production build (`next start`) — the dev server plus six browsers needs a lot of memory.

## Deployment

### Recommended: one container + Postgres (e.g. Railway)

This is the configuration the test suite runs (local auth, files on a disk,
SSE realtime on a long-running server). The `Dockerfile` works on any
container host; `railway.json` configures Railway.

1. Push this repository to GitHub.
2. In Railway: **New project → Deploy from GitHub repo**, then **+ New →
   Database → PostgreSQL** in the same project. Railway's Postgres gives the
   app the role privileges the migrations need; some managed Postgres
   services (e.g. ones without `BYPASSRLS`) don't.
3. On the Canopy service: **Settings → Volumes → add a volume** mounted at
   `/data` (uploaded photos live there).
4. **Variables:**
   `DATABASE_URL=${{Postgres.DATABASE_URL}}`,
   `SESSION_SECRET=` (48+ random characters, e.g. `openssl rand -base64 48`),
   `BLOOM_DEMO_MODE=true`, and optionally `ANTHROPIC_API_KEY`.
   Set `BLOOM_SEED_DEMO=false` if you don't want the fictional demo data.
5. **Settings → Networking → Generate domain.** Each start applies pending
   migrations and loads the demo data only if it isn't there yet.
6. Sign in as `teacher.demo` / `bloom-demo` and change that password —
   it's published in this README.

### Fly.io (London)

`fly.toml` is included. With [flyctl](https://fly.io/docs/flyctl/install/) installed and signed in:

```bash
fly apps create bloom-kohdyism                     # or edit `app` in fly.toml
fly postgres create --name bloom-kohdyism-db       # Development / single node, region lhr, do NOT scale to zero
fly postgres attach bloom-kohdyism-db -a bloom-kohdyism   # sets DATABASE_URL
fly volumes create bloom_data --region lhr --size 1 -a bloom-kohdyism
fly secrets set SESSION_SECRET="$(openssl rand -base64 48)" -a bloom-kohdyism
fly deploy
```

This uses Fly's unmanaged Postgres (the attached user is a superuser, which
the migrations need). Fly doesn't support unmanaged Postgres — take your own
backups (`fly postgres` docs) before using it for anything beyond a demo.

### Alternative: Vercel + Supabase

1. **Supabase:** create a project (UK/EU region). Apply the migrations in
   `supabase/migrations` in order (Supabase SQL editor or `supabase db push`).
   Do **not** run `supabase/local/00_supabase_shim.sql` — Supabase already
   provides `auth.*` and the roles. Create a private storage bucket named
   `bloom-private` (or set `BLOOM_STORAGE_BUCKET`).
2. **Accounts:** set `BLOOM_AUTH_BACKEND=supabase`. Teacher accounts can be
   created in Supabase Auth with a matching row in `public.profiles`
   (`role = 'teacher'`). Student accounts are created by teachers in the app.
3. **Vercel:** import the repo; set the environment variables from
   `.env.example` (`DATABASE_URL` must be a session/direct connection so the
   realtime listener can use LISTEN/NOTIFY). Never prefix secrets with
   `NEXT_PUBLIC_`.
4. **Realtime on serverless:** SSE connections are time-limited on serverless
   platforms; clients reconnect and replay missed events automatically, but a
   long-running Node host (or the Supabase Realtime transport listed in
   future work) gives the smoothest experience.

> The Supabase Auth and Storage adapters follow the documented APIs but were
> **not exercised** in this repository's automated tests (no Supabase project
> was available while building it). Verify them in a staging project first.

## Documentation

- [docs/architecture.md](docs/architecture.md) — decisions, trade-offs, module map, future work
- [docs/ai-workflows.md](docs/ai-workflows.md) — every AI workflow's inputs, outputs, validation and limits
- [docs/privacy-and-safeguarding.md](docs/privacy-and-safeguarding.md) — what's protected and what a school must review first
- [docs/verification-report.md](docs/verification-report.md) — what was implemented and verified
