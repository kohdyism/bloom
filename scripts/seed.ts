/**
 * Fictional demonstration dataset. Every person, class and support need here
 * is invented. Support needs are functional and non-diagnostic.
 */
import type { Client } from "pg";
import { hashPassword } from "../src/lib/auth/password";
import { DEFAULT_ROLES, defaultConfig, makeStage, type LessonDraft } from "../src/lib/domain/lesson";

export const DEMO_TEACHER = { username: "teacher.demo", password: "bloom-demo", name: "Ms Rivera" };
export const DEMO_STUDENT_PASSWORD = "bloom-student";

const COLORS = ["teal", "blue", "purple", "mint", "coral", "amber"];
const ICONS = ["leaf", "star", "wave", "sprout", "moon", "feather", "shell", "cloud"];

type SeedStudent = {
  username: string;
  name: string;
  survey: Record<string, string>;
  accommodations?: string[];
  note?: string;
};

const survey = (
  communication: string, written: string, structure: string, examples: string,
  reminders: string, visuals: string, thinkingTime: string, workingStyle: string,
) => ({ communication, written, structure, examples, reminders, visuals, thinkingTime, workingStyle });

export const DEMO_STUDENTS: SeedStudent[] = [
  { username: "ava.k", name: "Ava K", survey: survey("talk", "both", "structured", "yes", "yes", "yes", "sometimes", "small_group") },
  { username: "ben.o", name: "Ben O", survey: survey("write", "written", "structured", "yes", "yes", "yes", "yes", "pairs"), accommodations: ["extra_processing_time", "written_instructions"], note: "Fictional demo note: prefers to see instructions before discussing." },
  { username: "chloe.m", name: "Chloe M", survey: survey("talk", "spoken", "open", "no", "no", "sometimes", "no", "small_group") },
  { username: "dev.p", name: "Dev P", survey: survey("mix", "both", "structured", "yes", "sometimes", "yes", "sometimes", "small_group"), accommodations: ["task_breakdown"] },
  { username: "elena.r", name: "Elena R", survey: survey("write", "written", "structured", "yes", "yes", "sometimes", "yes", "pairs"), accommodations: ["smaller_groups", "explicit_turn_taking"], note: "Fictional demo note: more confident once roles are clear." },
  { username: "felix.t", name: "Felix T", survey: survey("talk", "spoken", "open", "sometimes", "no", "no", "no", "larger_group") },
  { username: "grace.l", name: "Grace L", survey: survey("mix", "both", "open", "sometimes", "sometimes", "yes", "sometimes", "small_group") },
  { username: "hamza.a", name: "Hamza A", survey: survey("write", "written", "structured", "yes", "yes", "yes", "yes", "small_group"), accommodations: ["reduced_sensory"] },
  { username: "isla.w", name: "Isla W", survey: survey("talk", "both", "open", "no", "no", "sometimes", "no", "larger_group") },
  { username: "jonah.b", name: "Jonah B", survey: survey("mix", "both", "structured", "yes", "sometimes", "yes", "sometimes", "pairs") },
  { username: "kiara.s", name: "Kiara S", survey: survey("write", "written", "structured", "yes", "yes", "yes", "yes", "solo_first"), accommodations: ["extra_processing_time"] },
  { username: "leo.f", name: "Leo F", survey: survey("talk", "spoken", "open", "sometimes", "no", "no", "sometimes", "larger_group") },
  { username: "maya.n", name: "Maya N", survey: survey("mix", "both", "structured", "yes", "yes", "yes", "sometimes", "small_group") },
  { username: "noah.g", name: "Noah G", survey: survey("talk", "spoken", "structured", "yes", "sometimes", "sometimes", "no", "small_group"), accommodations: ["written_instructions", "task_breakdown"] },
  { username: "olivia.c", name: "Olivia C", survey: survey("write", "written", "open", "sometimes", "no", "yes", "yes", "solo_first") },
  { username: "priya.d", name: "Priya D", survey: survey("mix", "both", "structured", "yes", "yes", "yes", "sometimes", "small_group") },
  { username: "quinn.h", name: "Quinn H", survey: survey("talk", "both", "open", "no", "no", "sometimes", "no", "larger_group") },
  { username: "rosa.v", name: "Rosa V", survey: survey("write", "written", "structured", "yes", "yes", "yes", "yes", "pairs"), accommodations: ["smaller_groups"] },
  { username: "sam.j", name: "Sam J", survey: survey("mix", "both", "structured", "sometimes", "sometimes", "yes", "sometimes", "small_group") },
  { username: "tomas.e", name: "Tomás E", survey: survey("talk", "spoken", "open", "sometimes", "no", "no", "no", "small_group") },
];

const POE_ALONE = `"Alone" by Edgar Allan Poe (written 1829; public domain)

From childhood's hour I have not been
As others were—I have not seen
As others saw—I could not bring
My passions from a common spring—
From the same source I have not taken
My sorrow—I could not awaken
My heart to joy at the same tone—
And all I lov'd—I lov'd alone—
Then—in my childhood—in the dawn
Of a most stormy life—was drawn
From ev'ry depth of good and ill
The mystery which binds me still—
From the torrent, or the fountain—
From the red cliff of the mountain—
From the sun that 'round me roll'd
In its autumn tint of gold—
From the lightning in the sky
As it pass'd me flying by—
From the thunder, and the storm—
And the cloud that took the form
(When the rest of Heaven was blue)
Of a demon in my view—`;

const pick = (...keys: string[]) => DEFAULT_ROLES.filter((r) => keys.includes(r.key));

export const DEMO_LESSONS: { classKey: string; draft: LessonDraft; materials: { title: string; body: string }[] }[] = [
  {
    classKey: "lit",
    materials: [{ title: "Poem: Alone", body: POE_ALONE }],
    draft: {
      title: "Reading 'Alone' together",
      description: "Analyse how Poe presents loneliness, using evidence from the poem, and write a collaborative response.",
      subject: "English Literature",
      yearLevel: "Year 8",
      objectives: [
        "Identify how the speaker presents feeling different from others",
        "Support an interpretation with a quotation",
        "Build a shared response that includes more than one reading",
      ],
      config: defaultConfig({ groupSizeMin: 3, groupSizeMax: 4, outputType: "document", presentationRequired: true, gamificationTheme: "garden", roles: pick("facilitator", "note_taker", "questioner", "presenter") }),
      stages: [
        makeStage("brainstorm", { title: "Think", durationSeconds: 300, instructions: "Read the poem on your own. Write one or two ideas about how the speaker feels and why. A single word or phrase from the poem is a great place to start." }),
        makeStage("synthesis", { title: "AI idea synthesis", durationSeconds: 240, instructions: "Look at how your group's ideas have been grouped. Does anything feel wrong or missing? You can rename groups or move ideas." }),
        makeStage("talk", { title: "Talk time", durationSeconds: 240, instructions: "Take turns sharing your ideas out loud. Which idea surprised you most, and why?" }),
        makeStage("discussion", { durationSeconds: 480, instructions: "Pick one idea that isn't yours and add to it. Which line of the poem best supports it?" }),
        makeStage("creation", { title: "Collaborative writing", durationSeconds: 720, instructions: "Write a paragraph answering: How does Poe present loneliness in 'Alone'? Include at least one quotation and more than one interpretation.", config: { artifacts: ["document"] } }),
        makeStage("submission", { durationSeconds: 120 }),
        makeStage("presentation", { durationSeconds: 600 }),
      ],
    },
  },
  {
    classKey: "dt",
    materials: [{ title: "Materials list", body: "Each group has: 4 sheets of A4 paper, 2 paper clips, 1 ruler, tape measure for testing.\nTest rule: launch from behind the line, measure to where the nose lands." }],
    draft: {
      title: "Paper Aeroplane Challenge",
      description: "Plan, build and test paper aeroplanes, record results and reflect on teamwork.",
      subject: "Design & Technology",
      yearLevel: "Year 8",
      objectives: ["Plan and share out tasks", "Test a design and record results fairly", "Reflect on how the group worked together"],
      config: defaultConfig({ modality: "mostly_in_person", outputType: "photo", gamificationTheme: "journey", roles: pick("facilitator", "timekeeper", "materials", "note_taker", "presenter") }),
      stages: [
        makeStage("orientation", { durationSeconds: 180, instructions: "Your challenge: build a paper aeroplane that flies as far as possible using only the supplied materials. You'll test three times and record every result." }),
        makeStage("role_selection", { durationSeconds: 180 }),
        makeStage("discussion", { title: "Planning", durationSeconds: 300, instructions: "Agree on a design before folding. Who folds, who tests, who records?" }),
        makeStage("physical", { title: "Build and test", durationSeconds: 900, instructions: "Build your aeroplane using the supplied materials. Test it three times and record each distance.", config: { checkins: ["Design agreed", "First plane built", "Test 1 recorded", "Test 2 recorded", "Test 3 recorded"], evidenceUpload: true, groupChat: false } }),
        makeStage("submission", { title: "Evidence capture", durationSeconds: 240, instructions: "Upload a photo of your plane and type your three distances into the results box.", config: { evidenceUpload: true } }),
        makeStage("reflection", { durationSeconds: 240, config: { prompts: ["What helped your group work well?", "What would you change about your design?"] } }),
      ],
    },
  },
  {
    classKey: "cit",
    materials: [{ title: "Challenge brief", body: "The student council has a small budget to make our school a better place to learn and spend time. What should we change first? Think about wellbeing, accessibility, learning spaces and the environment." }],
    draft: {
      title: "School Improvement Challenge",
      description: "Brainstorm improvements to our school, cluster and discuss ideas, vote, and present a plan.",
      subject: "Citizenship",
      yearLevel: "Year 9",
      objectives: ["Generate ideas that consider different students' needs", "Agree priorities democratically", "Present a persuasive plan"],
      config: defaultConfig({ outputType: "slides", presentationRequired: true, gamificationTheme: "constellation", ideaAnonymity: "anonymous", chatSupervision: "ai", roles: pick("facilitator", "synthesiser", "timekeeper", "presenter", "encourager") }),
      stages: [
        makeStage("brainstorm", { durationSeconds: 300, instructions: "What would make school better for everyone? Think about people whose experience might be different from yours.", config: { groupChat: false } }),
        makeStage("synthesis", { title: "Cluster ideas", durationSeconds: 240 }),
        makeStage("talk", { title: "Talk time", durationSeconds: 240, instructions: "Take turns sharing your ideas out loud. Which idea surprised you most, and why?" }),
        makeStage("discussion", { title: "Discuss", durationSeconds: 420, instructions: "Which ideas would help the most people? Which are realistic?" }),
        makeStage("voting", { title: "Vote", durationSeconds: 180, config: { votesPerStudent: 3 } }),
        makeStage("creation", { title: "Whiteboard & slides", durationSeconds: 900, instructions: "Sketch your plan on the whiteboard, then make 3–4 slides to pitch your top idea.", config: { artifacts: ["whiteboard", "slides"] } }),
        makeStage("submission", { durationSeconds: 120 }),
        makeStage("presentation", { title: "Present", durationSeconds: 600 }),
      ],
    },
  },
];

async function createUser(client: Client, opts: { username: string; name: string; role: "teacher" | "student"; password: string; i: number }) {
  const email = `${opts.username}@${opts.role === "teacher" ? "staff" : "students"}.bloom.demo`;
  const { rows } = await client.query<{ id: string }>(
    "insert into auth.users(email) values ($1) on conflict (email) do update set email = excluded.email returning id",
    [email],
  );
  const id = rows[0].id;
  if ((process.env.BLOOM_AUTH_BACKEND ?? "local") === "local") {
    await client.query(
      `insert into local_auth.credentials(user_id, password_hash) values ($1, $2)
       on conflict (user_id) do update set password_hash = excluded.password_hash`,
      [id, await hashPassword(opts.password)],
    );
  }
  await client.query(
    `insert into public.profiles(id, role, display_name, username, avatar_color, avatar_icon, onboarded_at)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (id) do update set display_name = excluded.display_name`,
    [id, opts.role, opts.name, opts.username, COLORS[opts.i % COLORS.length], ICONS[opts.i % ICONS.length],
      opts.role === "teacher" ? new Date() : null],
  );
  return id;
}

export async function seed(client: Client) {
  const existing = await client.query("select 1 from public.profiles where username = $1", [DEMO_TEACHER.username]);
  if (existing.rowCount) {
    console.log("  demo data already present — skipping (use db:reset for a clean slate)");
    return;
  }
  await client.query("begin");
  try {
    const teacherId = await createUser(client, { ...DEMO_TEACHER, role: "teacher", i: 0 });

    const studentIds: string[] = [];
    for (const [i, s] of DEMO_STUDENTS.entries()) {
      const id = await createUser(client, { username: s.username, name: s.name, role: "student", password: DEMO_STUDENT_PASSWORD, i: i + 1 });
      studentIds.push(id);
      // The first student is left un-onboarded so the survey flow can be demonstrated.
      if (i > 0) {
        await client.query("update public.profiles set onboarded_at = now() where id = $1", [id]);
        await client.query(
          "insert into public.student_preferences(student_id, survey, accessibility) values ($1, $2, '{}')",
          [id, JSON.stringify(s.survey)],
        );
      }
      for (const kind of s.accommodations ?? []) {
        await client.query(
          "insert into public.student_accommodations(student_id, created_by, kind) values ($1, $2, $3)",
          [id, teacherId, kind],
        );
      }
      if (s.note) {
        await client.query(
          "insert into public.teacher_private_notes(student_id, teacher_id, body) values ($1, $2, $3)",
          [id, teacherId, s.note],
        );
      }
    }

    const classes: Record<string, string> = {};
    const classDefs = [
      { key: "lit", name: "Year 8 Literature — Class 1", subject: "English Literature", year: "Year 8", members: studentIds },
      { key: "dt", name: "Year 8 Design & Technology", subject: "Design & Technology", year: "Year 8", members: studentIds.slice(0, 12) },
      { key: "cit", name: "Year 9 Citizenship", subject: "Citizenship", year: "Year 9", members: studentIds.slice(8, 20) },
    ];
    for (const c of classDefs) {
      const { rows } = await client.query<{ id: string }>(
        "insert into public.classes(teacher_id, name, subject, year_level) values ($1,$2,$3,$4) returning id",
        [teacherId, c.name, c.subject, c.year],
      );
      classes[c.key] = rows[0].id;
      for (const sid of c.members) {
        await client.query("insert into public.class_memberships(class_id, student_id) values ($1,$2)", [rows[0].id, sid]);
      }
    }

    // Fictional pairing restriction to demonstrate hard constraints.
    await client.query(
      "insert into public.grouping_constraints(class_id, kind, student_a, student_b) values ($1, 'keep_apart', $2, $3)",
      [classes.lit, studentIds[2], studentIds[5]],
    );

    for (const lesson of DEMO_LESSONS) {
      const d = lesson.draft;
      const { rows } = await client.query<{ id: string }>(
        `insert into public.lessons(teacher_id, class_id, title, description, subject, year_level, objectives, config, source)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'template') returning id`,
        [teacherId, classes[lesson.classKey], d.title, d.description, d.subject, d.yearLevel, d.objectives, JSON.stringify(d.config)],
      );
      for (const [pos, st] of d.stages.entries()) {
        await client.query(
          `insert into public.lesson_stages(lesson_id, position, kind, title, instructions, duration_seconds, config)
           values ($1,$2,$3,$4,$5,$6,$7)`,
          [rows[0].id, pos, st.kind, st.title, st.instructions, st.durationSeconds, JSON.stringify(st.config)],
        );
      }
      for (const m of lesson.materials) {
        await client.query(
          "insert into public.lesson_materials(lesson_id, kind, title, body) values ($1,'text',$2,$3)",
          [rows[0].id, m.title, m.body],
        );
      }
    }
    await client.query("commit");
    console.log(`  seeded 1 teacher, ${studentIds.length} students, ${classDefs.length} classes, ${DEMO_LESSONS.length} lessons`);
  } catch (err) {
    await client.query("rollback");
    throw err;
  }
}
