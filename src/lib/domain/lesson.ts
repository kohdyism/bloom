import { z } from "zod";
import { stageAttachmentSchema } from "./stage-media";
import { reflectionSetSchema } from "./reflection";

/** The twelve configurable stage building blocks (spec §6.5). */
export const STAGE_KINDS = [
  "orientation",
  "role_selection",
  "brainstorm",
  "synthesis",
  "talk",
  "discussion",
  "voting",
  "creation",
  "physical",
  "submission",
  "presentation",
  "reflection",
] as const;
export type StageKind = (typeof STAGE_KINDS)[number];

export const STAGE_META: Record<StageKind, { label: string; blurb: string; defaultMinutes: number }> = {
  orientation: { label: "Orientation", blurb: "Introduce the task and what success looks like.", defaultMinutes: 3 },
  role_selection: { label: "Role selection", blurb: "Students choose the roles they'll take on.", defaultMinutes: 3 },
  brainstorm: { label: "Individual thinking", blurb: "Students write ideas privately before sharing.", defaultMinutes: 5 },
  synthesis: { label: "Idea synthesis", blurb: "AI groups the shared ideas; students review and challenge it.", defaultMinutes: 4 },
  talk: { label: "Talk time", blurb: "Screens down: the group talks face to face.", defaultMinutes: 4 },
  discussion: { label: "Discussion", blurb: "Talk it through, face to face or in the group space.", defaultMinutes: 8 },
  voting: { label: "Voting", blurb: "Agree on priorities with a quick, fair vote.", defaultMinutes: 3 },
  creation: { label: "Collaborative creation", blurb: "Build the shared output together.", defaultMinutes: 12 },
  physical: { label: "Hands-on activity", blurb: "Make or test something in the room, with check-ins.", defaultMinutes: 12 },
  submission: { label: "Submission", blurb: "One member submits the group's work.", defaultMinutes: 2 },
  presentation: { label: "Presentation", blurb: "Groups share their work with the class.", defaultMinutes: 8 },
  reflection: { label: "Group reflection", blurb: "Look back on how the group worked together.", defaultMinutes: 3 },
};

export const COMPLETION_RULES = ["all_ready", "majority_ready", "teacher_only", "on_requirements"] as const;
export type CompletionRule = (typeof COMPLETION_RULES)[number];

export const ARTIFACT_KINDS = ["document", "whiteboard", "slides"] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export const stageConfigSchema = z.object({
  completion: z.enum(COMPLETION_RULES).default("all_ready"),
  /** Brainstorm: ideas each student adds before "Done thinking" unlocks (at least 1 is always required). */
  minIdeasPerStudent: z.number().int().min(0).max(10).default(1),
  /**
   * The least each student adds before they can press "I'm ready" in voting
   * (votes), a written discussion (messages), creation (0 or 1: a change to the
   * shared work) and hands-on stages with photos (photos). Unset = the stage's
   * default. Thinking time uses minIdeasPerStudent.
   */
  minContribution: z.number().int().min(0).max(20).optional(),
  /** Creation: which shared artifacts are available. */
  artifacts: z.array(z.enum(ARTIFACT_KINDS)).default([]),
  /** Voting: how many votes each student can place. */
  votesPerStudent: z.number().int().min(1).max(10).default(3),
  /** Physical: check-in prompts the group ticks off as they work. */
  checkins: z.array(z.string().min(1).max(160)).max(10).default([]),
  /** Physical / submission: allow photo evidence of physical work. */
  evidenceUpload: z.boolean().default(false),
  /** Reflection: group-level prompts. */
  prompts: z.array(z.string().min(1).max(200)).max(6).default([]),
  /** Whether the group chat is available during this stage (teacher's choice). */
  groupChat: z.boolean().default(true),
  /** Whether Pip, the private assistant, is available during this stage (only when it is on for the lesson). */
  privateAssistant: z.boolean().default(true),
  /** Pictures, videos, links/simulations and files shown inline with the instructions. */
  attachments: z.array(stageAttachmentSchema).max(8).default([]),
});
export type StageConfig = z.infer<typeof stageConfigSchema>;

export const stageSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(STAGE_KINDS),
  title: z.string().min(1).max(120),
  instructions: z.string().max(4000).default(""),
  durationSeconds: z.number().int().min(0).max(7200),
  config: stageConfigSchema.default(stageConfigSchema.parse({})),
});
export type Stage = z.infer<typeof stageSchema>;

export const roleSchema = z.object({
  key: z.string().min(1).max(40).regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(40),
  description: z.string().max(240),
});
export type RoleDef = z.infer<typeof roleSchema>;

export const DEFAULT_ROLES: RoleDef[] = [
  { key: "facilitator", name: "Facilitator", description: "Keeps the conversation moving and makes sure everyone gets a turn." },
  { key: "timekeeper", name: "Timekeeper", description: "Watches the clock and gives the group a heads-up before time runs out." },
  { key: "note_taker", name: "Note-taker", description: "Captures the key points so nothing gets lost." },
  { key: "presenter", name: "Presenter", description: "Shares the group's work with the class (with help from everyone)." },
  { key: "synthesiser", name: "Synthesiser", description: "Spots connections between ideas and sums them up." },
  { key: "questioner", name: "Questioner", description: "Asks 'why?' and 'what's the evidence?' to deepen thinking." },
  { key: "encourager", name: "Encourager", description: "Notices good contributions and invites quieter voices in." },
  { key: "materials", name: "Materials coordinator", description: "Looks after the physical materials and the workspace." },
];

export const GAMIFICATION_THEMES = ["garden", "constellation", "journey", "none"] as const;
export type GamificationTheme = (typeof GAMIFICATION_THEMES)[number];

export const lessonConfigSchema = z.object({
  groupSizeMin: z.number().int().min(1).max(8).default(3),
  groupSizeMax: z.number().int().min(1).max(8).default(4),
  roles: z.array(roleSchema).max(12).default(DEFAULT_ROLES.slice(0, 5)),
  rolesOptional: z.boolean().default(true),
  facilitationIntensity: z.enum(["low", "moderate", "high"]).default("moderate"),
  /** Private learning assistant: 1 Socratic, 2 structured scaffolding, 3 detailed support. */
  assistanceLevel: z.number().int().min(1).max(3).default(2),
  /** Group facilitator can have its own level. */
  facilitatorAssistanceLevel: z.number().int().min(1).max(3).default(2),
  modality: z.enum(["mixed", "mostly_in_person", "mostly_digital"]).default("mixed"),
  ideaAnonymity: z.enum(["named", "anonymous"]).default("named"),
  outputType: z.enum(["document", "whiteboard", "slides", "photo", "mixed"]).default("document"),
  presentationRequired: z.boolean().default(false),
  allowResubmission: z.boolean().default(true),
  gamificationTheme: z.enum(GAMIFICATION_THEMES).default("garden"),
  timerWarningSeconds: z.number().int().min(0).max(600).default(60),
  /** Supervised chat: Bloom checks each group-chat message first and holds back off-task or unkind ones. */
  chatSupervision: z.enum(["off", "ai"]).default("off"),
  /** Pip, the private assistant, for the whole lesson. Each stage can also turn it off. */
  privateAssistant: z.boolean().default(true),
  /** The teacher's own post-lesson reflection questions (null = the default set). */
  reflection: reflectionSetSchema.nullable().default(null),
  /** Labels for finding the lesson in the library (e.g. "Year 8", "Poetry"). */
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
});
export type LessonConfig = z.infer<typeof lessonConfigSchema>;

export const lessonDraftSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000).default(""),
  subject: z.string().max(80).default(""),
  yearLevel: z.string().max(40).default(""),
  objectives: z.array(z.string().min(1).max(240)).max(8).default([]),
  config: lessonConfigSchema,
  stages: z.array(stageSchema).min(1).max(20),
});
export type LessonDraft = z.infer<typeof lessonDraftSchema>;

export function defaultConfig(overrides: Partial<LessonConfig> = {}): LessonConfig {
  return lessonConfigSchema.parse(overrides);
}

export function makeStage(kind: StageKind, partial: Partial<Omit<Stage, "kind" | "config">> & { config?: Partial<StageConfig> } = {}): Stage {
  const meta = STAGE_META[kind];
  const defaults: Partial<StageConfig> =
    kind === "creation" ? { artifacts: ["document"] } :
    kind === "brainstorm" ? { completion: "on_requirements", minIdeasPerStudent: 1 } :
    kind === "presentation" ? { completion: "teacher_only" } : {};
  return stageSchema.parse({
    kind,
    title: partial.title ?? meta.label,
    instructions: partial.instructions ?? "",
    durationSeconds: partial.durationSeconds ?? meta.defaultMinutes * 60,
    config: { ...defaults, ...(partial.config ?? {}) },
  });
}

/** Snapshot frozen onto a session at launch. */
export const sessionSnapshotSchema = z.object({
  lessonId: z.string(),
  title: z.string(),
  description: z.string(),
  subject: z.string(),
  yearLevel: z.string(),
  objectives: z.array(z.string()),
  config: lessonConfigSchema,
  stages: z.array(stageSchema),
  materials: z.array(z.object({ id: z.string(), title: z.string(), kind: z.string(), body: z.string() })),
});
export type SessionSnapshot = z.infer<typeof sessionSnapshotSchema>;

/** Is the group chat open during this stage? Never in talk time (screens down) or reflection; otherwise the teacher's choice (older lessons keep it on). */
export function chatOpenIn(stage: { kind: StageKind; config: { groupChat?: boolean } } | null | undefined): boolean {
  if (!stage || stage.kind === "talk" || stage.kind === "reflection") return false;
  return stage.config.groupChat !== false;
}

/** Stages meant for talking face to face: no Pip, no AI buttons. */
export const FACE_TO_FACE_STAGES: readonly StageKind[] = ["talk", "discussion"];

/**
 * Can students reach Pip during this stage? Only if the teacher left it on
 * for the lesson AND for this stage, and never while the group is meant to be
 * talking face to face.
 */
export function pipAvailableIn(stage: { kind: StageKind; config: { privateAssistant?: boolean } } | null | undefined, lesson: { privateAssistant?: boolean }): boolean {
  if (lesson.privateAssistant === false) return false;
  if (!stage) return true;
  if (FACE_TO_FACE_STAGES.includes(stage.kind)) return false;
  return stage.config.privateAssistant !== false;
}

export type ContributionKind = "idea" | "vote" | "work" | "message" | "photo";

const NOUN: Record<ContributionKind, [string, string]> = {
  idea: ["idea", "ideas"],
  vote: ["vote", "votes"],
  work: ["change to your group's work", "changes to your group's work"],
  message: ["message in the group chat", "messages in the group chat"],
  photo: ["photo", "photos"],
};

/** "1 idea", "3 votes" — for hints and the builder. */
export function contributionLabel(kind: ContributionKind, n: number) {
  return `${n} ${NOUN[kind][n === 1 ? 0 : 1]}`;
}

/** The stage's default minimum when the teacher hasn't set one. */
export function defaultMinContribution(kind: StageKind): number {
  return kind === "voting" || kind === "creation" ? 1 : 0;
}

/** Which stages can have a minimum, and what students add there (null = nothing to count on screen). */
export function contributionKindFor(stage: { kind: StageKind; config: { groupChat?: boolean; evidenceUpload?: boolean } }): ContributionKind | null {
  switch (stage.kind) {
    case "brainstorm": return "idea";
    case "voting": return "vote";
    case "creation": return "work";
    case "discussion": return chatOpenIn(stage) ? "message" : null;
    case "physical": return stage.config.evidenceUpload ? "photo" : null;
    default: return null;
  }
}

/**
 * Stages where each student must add something before they can say they're
 * ready, and how much: the teacher sets the minimum per stage.
 */
export function contributionNeeded(stage: { kind: StageKind; config: { minIdeasPerStudent?: number; minContribution?: number; votesPerStudent?: number; groupChat?: boolean; evidenceUpload?: boolean } } | null | undefined): null | { kind: ContributionKind; count: number; hint: string } {
  if (!stage) return null;
  const kind = contributionKindFor(stage);
  if (!kind) return null;
  // Thinking time always needs at least one idea before "Done thinking"; the teacher can ask for more.
  let n = kind === "idea" ? Math.max(1, stage.config.minIdeasPerStudent ?? 1) : stage.config.minContribution ?? defaultMinContribution(stage.kind);
  if (kind === "vote") n = Math.min(n, stage.config.votesPerStudent ?? 3);
  if (kind === "work") n = Math.min(n, 1);
  if (n <= 0) return null;
  const hint = kind === "work" ? "Add something to your group's work first"
    : kind === "vote" && n === 1 ? "Vote for at least one idea first"
    : kind === "idea" && n === 1 ? "Add at least one idea first"
    : `Add at least ${contributionLabel(kind, n)} first`;
  return { kind, count: n, hint };
}
