import { z } from "zod";

/** The eleven configurable stage building blocks (spec §6.5). */
export const STAGE_KINDS = [
  "orientation",
  "role_selection",
  "brainstorm",
  "synthesis",
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
  /** Brainstorm: minimum submitted ideas per present member before the group can move on. */
  minIdeasPerStudent: z.number().int().min(0).max(10).default(1),
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
    kind === "submission" || kind === "presentation" ? { completion: "teacher_only" } : {};
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
