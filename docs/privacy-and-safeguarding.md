# Privacy, security and safeguarding notes

**Status: MVP using fictional data only.** Canopy has not been assessed or
approved for real pupil data. Nothing in this repository should be read as a
claim of UK GDPR compliance or safeguarding sign-off.

## What is implemented

- **Role-based access + row-level security** on every table (`supabase/migrations/…rls_policies.sql`), forced RLS, no `anon` access, column-level grants (students can't change their role).
- **Teacher-managed accounts.** Students cannot self-register. Joining a lesson needs a signed-in, enrolled student *and* a valid, expiring code (`join_session_by_code`).
- **Protected teacher data.** Functional accommodations are visible to the teacher and to the student themselves (as plain labels). Free-text notes live in `teacher_private_notes`, readable only by their author. Neither is ever sent to the group facilitator AI, shown to classmates or put on the display.
- **Private assistant transcripts** have no teacher policy at all. Teachers see only `private_ai_usage()` — counts by assistance type.
- **Help requests and teacher messages** are visible only to the student and the session's teacher; realtime notifications for them go only to the teacher channel and the student's own channel. "Something is making me uncomfortable" is flagged urgent.
- **Public display** is built from an explicit allow-list (`displayState`), reached by an unguessable token, and tested to exclude protected content.
- **Media** is stored privately and streamed only after an access check; uploads are type-sniffed by content and size-limited.
- **AI data minimisation.** Students are pseudonymised ("Member A") before any prompt; untrusted content is wrapped and neutralised against prompt injection; model output is schema-validated and verified (e.g. synthesis can't cite non-existent ideas); AI output is always labelled (live / simulated / offline helper).
- **Rate limiting** for sign-in, joining, AI calls, help requests, messages and uploads.
- **Audit log** (`audit_events`) for teacher controls, accommodation changes, AI-draft approvals and every individual reflection view.
- **No advertising, no behavioural tracking, no third-party analytics.** No diagnosis inference or compatibility scoring anywhere.
- **No listening.** Speech-to-text is push-to-talk in the browser; Canopy never records or streams audio.

## Safeguarding position in the MVP

- Canopy does **not** infer risk from student text and does **not** automatically disclose anything. The private assistant (live or simulated) is instructed to signpost the student to "Need help" / a trusted adult when they say they feel unsafe, and the help panel tells students their teacher may follow school safeguarding procedures.
- The assistant panel tells students exactly what the teacher can see (counts by type, not words). It never describes conversations as absolutely confidential.
- **Before real use**, the school's Designated Safeguarding Lead must define whether any exceptional disclosure route is needed, who may trigger it, how it is logged and how students are told. No such route exists today.

## Required before any real-pupil deployment

1. Data Protection Impact Assessment (DPIA), with the school as controller and a documented lawful basis.
2. Review against the ICO Children's Code (Age Appropriate Design Code) and DfE guidance on generative AI in education.
3. Safeguarding review with the DSL (see above), including the help-request workflow and response expectations.
4. Data processing agreements with hosting (Vercel/Supabase or alternative, UK/EU region) and Anthropic; confirm zero-retention / no-training terms for API data.
5. Retention schedule. Suggested defaults to configure: private assistant transcripts and chat 30 days after lesson end; submissions and reports for the academic year; audit log 1 year. (Retention jobs are **not** implemented yet.)
6. Accessibility audit with real users (WCAG 2.2 AA), including screen-reader and switch users.
7. Penetration test and dependency audit; rotate `SESSION_SECRET` and service keys.
8. Age suitability review of AI behaviour with representative (consented) testing.
