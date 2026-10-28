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

- **Teacher flags (added after teacher usability tests).** When moderation in the group chat (supervised chat) or in Pip catches an off-task, unkind or inappropriate message, the student is told kindly at the time and the lesson's teacher gets a flag on the live dashboard: who, which kind, when, and whether it came from the chat or Pip. The words are hidden until the teacher chooses to reveal them, and only the lesson's teacher can read flags (row-level security).
- **Safeguarding concern flag.** Simple, predictable keyword rules (not AI inference) look for language that may mean a student is at risk (e.g. self-harm, feeling unsafe at home). This works in Pip and in the group chat, even when chat supervision is off. It raises a high-priority flag that can't be missed on the teacher's dashboard. The student sees a supportive message pointing to "Need help" and a trusted adult. Canopy does not contact anyone outside the lesson's teacher.
- **Pip conversations are readable by the lesson's teacher** (changed after teacher usability tests). Other students never see them. Pip's panel and the lesson tour tell students "Your teacher can read what you write to Pip". Each time a teacher opens a conversation it is written to the audit log. Off-task, unkind or inappropriate questions are not sent to Pip at all; the student sees why and can edit their question.
- **Ideas are checked before the group sees them** (nonsense, off-task, unkind, inappropriate, teacher's banned words), with a kind note to the student. Spelling, grammar and length are never judged.
- **AI quality ratings** of a student's written work are suggestions for the teacher, built only from that student's own writing (never support needs), and reach the printed progress report only after the teacher checks and confirms them.
- **Before real use**, the school's Designated Safeguarding Lead must review the keyword rules, decide who responds to a safeguarding flag and how quickly, how flags are recorded in the school's own safeguarding system, and how students are told about this. The rules will miss some disclosures and flag some harmless messages; they support, never replace, staff judgement.

## Required before any real-pupil deployment

1. Data Protection Impact Assessment (DPIA), with the school as controller and a documented lawful basis.
2. Review against the ICO Children's Code (Age Appropriate Design Code) and DfE guidance on generative AI in education.
3. Safeguarding review with the DSL (see above), including the help-request workflow and response expectations.
4. Data processing agreements with hosting (Vercel/Supabase or alternative, UK/EU region) and Anthropic; confirm zero-retention / no-training terms for API data.
5. Retention schedule. Suggested defaults to configure: private assistant transcripts and chat 30 days after lesson end; submissions and reports for the academic year; audit log 1 year. (Retention jobs are **not** implemented yet.)
6. Accessibility audit with real users (WCAG 2.2 AA), including screen-reader and switch users.
7. Penetration test and dependency audit; rotate `SESSION_SECRET` and service keys.
8. Age suitability review of AI behaviour with representative (consented) testing.
