import { makeStage, STAGE_META, type Stage, type StageConfig, type StageKind } from "./lesson";

/**
 * The "Add a stage" menu. Online tasks happen on the screen (writing ideas,
 * voting, building the shared work). Offline tasks happen away from it, in the
 * room: talking, moving, making. Offline presets are ready-made versions of the
 * talk, discussion, hands-on and presentation stages with their own title and
 * instructions, which the teacher can then edit.
 */
export type StagePreset = {
  id: string;
  kind: StageKind;
  label: string;
  blurb: string;
  mode: "online" | "offline";
  title?: string;
  instructions?: string;
  minutes?: number;
  config?: Partial<StageConfig>;
};

const online = (kind: StageKind): StagePreset => ({ id: kind, kind, label: STAGE_META[kind].label, blurb: STAGE_META[kind].blurb, mode: "online" });

export const STAGE_PRESETS: StagePreset[] = [
  online("orientation"),
  online("role_selection"),
  online("brainstorm"),
  online("synthesis"),
  online("voting"),
  online("creation"),
  online("submission"),
  online("reflection"),

  { id: "talk", kind: "talk", mode: "offline", label: "Talk time", blurb: "Screens down: the group talks face to face." },
  { id: "discussion", kind: "discussion", mode: "offline", label: "Discussion", blurb: "Talk it through face to face, with earlier ideas on screen for reference.", config: { groupChat: false } },
  {
    id: "think_pair_share", kind: "talk", mode: "offline", label: "Think–pair–share", blurb: "Think alone, talk with a partner, then share with the group.", minutes: 6,
    title: "Think, pair, share", instructions: "Think quietly for one minute. Then share your idea with a partner. Then pairs share with the whole group.",
  },
  {
    id: "debate", kind: "talk", mode: "offline", label: "Debate", blurb: "Two sides argue for and against, then swap.", minutes: 8,
    title: "Debate", instructions: "Half the group argues for, half against. Each side gets two minutes. Then swap sides and try the other view.",
  },
  {
    id: "role_play", kind: "talk", mode: "offline", label: "Role play", blurb: "Act out a scene or take on a character's point of view.", minutes: 8,
    title: "Role play", instructions: "Each person takes a character. Act out the scene, then talk about how each character felt and why.",
  },
  {
    id: "jigsaw", kind: "talk", mode: "offline", label: "Jigsaw (expert groups)", blurb: "Each person becomes the expert on one part and teaches the others.", minutes: 10,
    title: "Jigsaw", instructions: "Each person takes one part of the topic and becomes the expert. Then take turns teaching your part to the group.",
  },
  {
    id: "gallery_walk", kind: "physical", mode: "offline", label: "Gallery walk", blurb: "Walk round other groups' work and leave feedback.", minutes: 8,
    title: "Gallery walk", instructions: "Walk round the room and look at other groups' work. Leave one kind comment and one question on a sticky note for each.",
    config: { checkins: ["Visited every group's work", "Left a comment for each", "Back at our table"] },
  },
  {
    id: "card_sort", kind: "physical", mode: "offline", label: "Card sort", blurb: "Sort printed cards into groups or a ranking together.", minutes: 8,
    title: "Card sort", instructions: "Sort the cards into groups that make sense to you. Agree a name for each group. Be ready to explain your choices.",
    config: { checkins: ["Sorted all the cards", "Named each group", "Agreed on our choices"] },
  },
  {
    id: "experiment", kind: "physical", mode: "offline", label: "Build or experiment", blurb: "Plan, make and test something, then improve it.", minutes: 15,
    title: "Build and test", instructions: "Plan what you'll make. Build it, test it, and change one thing to make it better.",
    config: { checkins: ["Made a plan", "Built it", "Tested it", "Improved it"], evidenceUpload: true },
  },
  { id: "physical", kind: "physical", mode: "offline", label: "Hands-on activity", blurb: "Make or test something in the room, with check-ins." },
  { id: "presentation", kind: "presentation", mode: "offline", label: "Present to the class", blurb: "Groups share their work with the class." },
];

export function stageFromPreset(p: StagePreset): Stage {
  return makeStage(p.kind, {
    title: p.title ?? STAGE_META[p.kind].label,
    instructions: p.instructions,
    durationSeconds: p.minutes ? p.minutes * 60 : undefined,
    config: p.config,
  });
}
