# Verification report

Date: 22 October 2026 · Commit: see `git log` (this file was added in the final commit)

This report covers what was built, what was actually verified and how, and
what is still unverified or missing. Nothing below is described as working
unless a test or a manual check exercised it.

## 1. Results of the automated checks

All run locally on PostgreSQL 16 and Node 22, against a production build
(`next build` then `next start`).

| Check | Command | Result |
|---|---|---|
| Type check | `npm run typecheck` | Clean |
| Lint | `npm run lint` | Clean (a few targeted `eslint-disable` lines, each with a written reason) |
| Unit + integration | `npm test` | **52 / 52 passed** (5 files) |
| Production build | `npm run build` | Succeeds |
| End-to-end | `npm run test:e2e` | **4 / 4 passed**, on two consecutive full runs |

The end-to-end specs:

1. **`classroom.spec.ts`: the brief's 30-step acceptance scenario (Scenario A).** One teacher and four students, each in a separate authenticated browser context, plus the public classroom display. It covers grouping with a keep-apart rule, private ideas, AI synthesis, the facilitator, the private assistant, help requests, collaborative writing, submission and return, presentation, ending the lesson, reflections and reports. It also includes tampering checks: another group's artifact, another student's help request, teacher APIs called as a student, a forged Yjs update, and display-token data limits.
2. **`school-improvement.spec.ts` (Scenario C).** Anonymous brainstorm, voting, a concurrent whiteboard, slides and presentation mode.
3. **`paper-aeroplane.spec.ts` (Scenario B).** Roles, physical check-ins, photo evidence, pause and extend, the teacher taking over from the AI, and return for revision.
4. **`accessibility.spec.ts`.** axe-core checks (WCAG 2.0/2.1/2.2 A and AA) on 18 screen states, normal and high-contrast with extra-large text. It also checks that a student's settings follow them to a second device. **Zero serious or critical violations.**

## 2. What is implemented

- **Accounts and roles.** Teacher and student roles, sign-in, join by code, and a first-time student survey. Password hashing uses scrypt and cookies are signed. Requests are rate-limited.
- **Classes and students.** Classes, rosters and per-student support settings. Support needs are simulated and non-diagnostic. Grouping rules: keep apart, keep together and preferred roles.
- **Lessons.** Templates for all three scenarios, AI lesson drafts that need teacher approval, and a stage editor.
- **Grouping engine.** Deterministic, using backtracking plus local search. Hard keep-apart rules are never broken; when they cannot be met, the reason is explained. Teachers can reorder groups by drag and drop. Groups can only be started once approved.
- **Stage engine.** Per-group timers, pause, extend, skip and reset. Stage advancement uses compare-and-set, which prevents double-advances (tested).
- **Live session.** A teacher dashboard with a per-group drawer, discreet private messages and help requests. The student workspace has readiness, chat, roles and check-ins. The public display has no student-identifying data beyond what its allow-list permits (tested).
- **Collaboration.** Documents (Tiptap), a whiteboard and slides, all on Yjs CRDTs. Updates are stored append-only and idempotently, with compaction. Exports are rendered to escaped HTML on the server.
- **AI.** The group facilitator, private assistant (levels 1–3, with refusal to complete assessed work), idea synthesis, lesson generation and reports. Pupil text is wrapped as untrusted content and model output is validated against a schema. Every AI message is labelled with its origin: live, simulated or offline helper.
- **Reflections and reports.** Private reflections and a per-session teacher report.
- **Privacy.** Row-level security is forced on every table. Each server write either runs as the user, under their RLS context, or as `service_role`, but only after an app-level check.
- **Accessibility.** High contrast, three text sizes, reduced motion, optional sounds (always paired with a visual signal), simpler instructions first, speech-to-text and read-aloud buttons, and options to hide or minimise the mascot and progress picture. A skip link, plus keyboard-operable menus and board editor. Preferences are saved per student and follow them across devices.

The app has 18 routes. Most of the brief's 38 screens are states within them (for example lobby, live, paused and ended within one session route). A screen-by-screen audit against the 38-item inventory has **not** been done.

## 3. Simulated, substituted or unverified

These are deliberate and labelled in the UI or the docs. None of them is presented as a working external integration.

| Area | Status |
|---|---|
| **Claude API** | No API key was available, so every AI feature was tested in **simulation mode**, which is deterministic and shows a "Simulated AI" label. The live code path uses `@anthropic-ai/sdk` structured outputs and is type-checked, but **was not run against the real API**. |
| **Supabase Auth and Storage** | Adapters written against the documented APIs, **not exercised**: no Supabase project was available. Local auth and local file storage were used and tested. |
| **Supabase Postgres** | The migrations target Supabase's roles and `auth.uid()`. Locally a shim (`supabase/local/00_supabase_shim.sql`) stands in for them. They have not been applied to a real Supabase project. |
| **Realtime** | Built on Postgres LISTEN/NOTIFY plus server-sent events (SSE), with per-channel authorisation and replay of missed events, rather than Supabase Realtime. On serverless hosts, SSE connections hit time limits and clients reconnect. |
| **Deployment** | **Not deployed.** No deployment URL exists. |
| **Real pupil data** | **Not approved.** Every demo student and support need is fictional. A school must complete the review in `docs/privacy-and-safeguarding.md` (DPIA, retention, safeguarding sign-off) first. |

## 4. Known gaps and remaining work (by priority)

**P1: before any pilot**
1. Run the live Claude path with a real key and review output quality and refusals on all workflows (`BLOOM_AI_MODE=auto`).
2. Apply the migrations to a Supabase staging project (UK/EU), switch to `BLOOM_AUTH_BACKEND=supabase` and `BLOOM_STORAGE_BACKEND=supabase`, and run the integration and e2e suites there.
3. Automated data retention and deletion jobs. Retention is documented but **not implemented**.
4. Accessibility testing with disabled users and screen readers (NVDA, VoiceOver). Automated axe checks only find some issues.

**P2**
5. Live cursors and presence highlighting in shared editors. Not implemented; documents still merge safely without them.
6. A Supabase Realtime transport option for serverless hosting.
7. Audit the screens against the brief's 38-item inventory and fill any gaps.
8. Load testing with a full class of about 30 students and several sessions at once.

**P3**
9. Richer gamification (currently a group progress picture and optional milestone celebrations), a dyslexia-friendly font option, and teacher-configurable rubrics in reports.
10. Translation and localisation (UI strings are currently English only).

## 5. Continuing the work

```bash
service postgresql start            # if the database isn't running
cd bloom && npm install
npm run db:reset && npm run dev     # local app on :3000, fictional data
npm test && npm run build && E2E_SERVER_COMMAND="npx next start -p 3100" npm run test:e2e
```

Prompt to continue in a new session: *"Continue the Bloom build from
`docs/verification-report.md` §4, starting with P1 item 1 (live Claude
verification), keeping all four e2e specs and the 52 unit/integration tests
passing."*
