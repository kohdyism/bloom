# AI workflows

All calls are server-side (`src/lib/ai/core.ts`). Model names come from
configuration (`BLOOM_AI_MODEL*`). Every workflow has a deterministic
simulation used when no API key is set (labelled **Simulated AI**) and as the
fallback when a live call fails, times out or returns invalid output (labelled
**Offline helper**). Classroom work never depends on the AI being available.

Shared rules appended to every prompt: untrusted data arrives inside
`<untrusted>` blocks that can't be broken out of; never mention support needs,
private conversations or help requests; never label or compare students.

| Workflow | File | Allowed inputs | Output & validation | Prohibited |
|---|---|---|---|---|
| Lesson generation | `lesson-generation.ts` | Teacher description, subject, year, minutes. No student data. | zod schema → normalised and clamped `LessonDraft`; saved **unapproved** — launch is blocked until the teacher approves. | Assessed answers; skipping approval. |
| Group facilitator | `facilitator.ts` | Stage, objectives, material excerpt, shared ideas, recent messages and roles with members pseudonymised; intensity; assistance level. | Short group message. Triggers are deterministic and deduplicated (`ai_interventions`), capped per stage; AI/system messages never trigger AI (no loops). | Naming/singling out students; judging participation; writing the group's output; pressuring anyone to speak. |
| Private assistant | `tutor.ts` | The student's own ideas and preferences/supports (as preferences), group ideas + recent discussion (pseudonymised), stage text, materials, assistance level, last turns. | Reply text, stored only in the student's transcript. | Completing assessed output at any level; revealing others' information; claiming absolute confidentiality. |
| Idea synthesis | `synthesis.ts` | Idea text keyed by opaque refs, objective, instructions. | Clusters of refs; refs verified; omitted ideas restored to "Different angles"; students can edit/regroup/regenerate. | Inventing or dropping ideas; judging ideas. |
| Teacher reporting | `report.ts` | Recorded counts/timings per pseudonymous group, help counts by reason (no content), aggregated ratings, anonymised free text. | zod schema; group refs verified; labelled in the UI. | Inventing behaviour; diagnosis; ranking; inferring disability. |
| Grouping | `domain/grouping.ts` | — | **Not AI.** Deterministic constraint solver with plain-language reasons. | Opaque compatibility judgements. |

Facilitation intensity: **Low** — only when the group asks; ready-checks are
plain system messages. **Moderate** (default) — stage introductions, ready-check
invitations, a gentle "no ideas yet" prompt, one participation-balance prompt
per discussion stage, private (never group) nudges that respect the student's
"reminders" preference and extra-thinking-time support. **High** — adds time
warnings and an off-task refocus when recent messages share no vocabulary with
the task.
