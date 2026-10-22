import { DEFAULT_ROLES, defaultConfig, makeStage, type LessonDraft } from "./lesson";

export type LessonTemplate = { key: string; name: string; summary: string; build: () => LessonDraft };

const roles = (...keys: string[]) => DEFAULT_ROLES.filter((r) => keys.includes(r.key));

export const LESSON_TEMPLATES: LessonTemplate[] = [
  {
    key: "think_pair_share",
    name: "Think–Pair–Share",
    summary: "Quiet thinking first, then build on each other's ideas and share back.",
    build: () => ({
      title: "Think–Pair–Share",
      description: "Individual thinking, paired discussion, then a shared response.",
      subject: "",
      yearLevel: "",
      objectives: ["Develop and justify a personal response", "Build on a partner's reasoning"],
      config: defaultConfig({ groupSizeMin: 2, groupSizeMax: 3, outputType: "document", roles: roles("note_taker", "presenter") }),
      stages: [
        makeStage("orientation", { instructions: "Read the question carefully. You'll think on your own first — there are no wrong starting points." }),
        makeStage("brainstorm", { title: "Think", instructions: "Write down your own thoughts. Aim for one or two ideas you could explain to someone else." }),
        makeStage("discussion", { title: "Pair", instructions: "Take turns explaining your idea. Ask your partner one question about theirs." }),
        makeStage("creation", { title: "Share", instructions: "Write a short shared response that includes both of your perspectives.", config: { artifacts: ["document"] } }),
        makeStage("submission"),
      ],
    }),
  },
  {
    key: "brainstorm_vote",
    name: "Brainstorm and Vote",
    summary: "Generate lots of ideas, group them, then agree on priorities fairly.",
    build: () => ({
      title: "Brainstorm and Vote",
      description: "Generate ideas individually, cluster them, discuss and vote on the strongest.",
      subject: "",
      yearLevel: "",
      objectives: ["Generate a range of ideas", "Prioritise ideas using agreed criteria"],
      config: defaultConfig({ outputType: "whiteboard", roles: roles("facilitator", "timekeeper", "synthesiser", "presenter") }),
      stages: [
        makeStage("orientation"),
        makeStage("role_selection"),
        makeStage("brainstorm", { instructions: "Add as many ideas as you like — quality over quantity. Ideas stay private until the stage ends." }),
        makeStage("synthesis"),
        makeStage("discussion", { instructions: "Which ideas would make the biggest difference? Why?" }),
        makeStage("voting", { config: { votesPerStudent: 3 } }),
        makeStage("creation", { title: "Plan it out", config: { artifacts: ["whiteboard"] } }),
        makeStage("submission"),
      ],
    }),
  },
  {
    key: "problem_solving",
    name: "Collaborative Problem Solving",
    summary: "Understand the problem, propose approaches, test one and explain it.",
    build: () => ({
      title: "Collaborative Problem Solving",
      description: "Groups work through a problem step by step and explain their solution.",
      subject: "",
      yearLevel: "",
      objectives: ["Break a problem into steps", "Explain and justify a solution"],
      config: defaultConfig({ outputType: "document", roles: roles("facilitator", "questioner", "note_taker", "presenter") }),
      stages: [
        makeStage("orientation", { instructions: "Read the problem together. What do you know? What do you need to find out?" }),
        makeStage("role_selection"),
        makeStage("brainstorm", { title: "Possible approaches", instructions: "Suggest one way the group could tackle the problem." }),
        makeStage("discussion", { title: "Choose an approach" }),
        makeStage("creation", { title: "Work it through", config: { artifacts: ["document", "whiteboard"] } }),
        makeStage("submission"),
        makeStage("reflection", { config: { prompts: ["What strategy helped most?", "What would you try differently?"] } }),
      ],
    }),
  },
  {
    key: "debate",
    name: "Structured Debate",
    summary: "Explore both sides with evidence, then reach a reasoned group position.",
    build: () => ({
      title: "Structured Debate",
      description: "Consider arguments for and against, weigh evidence and agree a position.",
      subject: "",
      yearLevel: "",
      objectives: ["Use evidence to support an argument", "Respond respectfully to opposing views"],
      config: defaultConfig({ outputType: "document", roles: roles("facilitator", "questioner", "timekeeper", "presenter") }),
      stages: [
        makeStage("orientation", { instructions: "Today's motion is on screen. You'll look at both sides before deciding." }),
        makeStage("role_selection"),
        makeStage("brainstorm", { title: "Arguments for and against", instructions: "Write at least one argument — it can be for either side, even one you disagree with." }),
        makeStage("synthesis"),
        makeStage("discussion", { title: "Weigh the evidence", instructions: "Which argument has the strongest evidence? Take turns." }),
        makeStage("voting", { title: "Where do we stand?" }),
        makeStage("creation", { title: "Write your position", config: { artifacts: ["document"] } }),
        makeStage("submission"),
        makeStage("presentation"),
      ],
    }),
  },
  {
    key: "physical_challenge",
    name: "Physical / Hands-On Challenge",
    summary: "Plan together, build in the room, check in on progress and capture evidence.",
    build: () => ({
      title: "Hands-On Challenge",
      description: "Plan, build and test something physical, then reflect on how the group worked.",
      subject: "",
      yearLevel: "",
      objectives: ["Plan and allocate tasks", "Test, record and improve a design"],
      config: defaultConfig({ modality: "mostly_in_person", outputType: "photo", roles: roles("facilitator", "timekeeper", "materials", "note_taker", "presenter") }),
      stages: [
        makeStage("orientation"),
        makeStage("role_selection"),
        makeStage("discussion", { title: "Plan", instructions: "Agree a plan before you start building." }),
        makeStage("physical", { title: "Build and test", config: { checkins: ["We have a plan everyone agrees on", "First version built", "Tested at least once"], evidenceUpload: true } }),
        makeStage("submission", { title: "Capture evidence", config: { evidenceUpload: true } }),
        makeStage("reflection"),
      ],
    }),
  },
];
