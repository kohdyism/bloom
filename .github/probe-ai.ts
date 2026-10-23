import { synthesiseIdeas } from "@/lib/ai/synthesis";
import { facilitatorMessage } from "@/lib/ai/facilitator";

const origWarn = console.warn;
console.warn = (...a: unknown[]) => origWarn("PROBE WARN", ...a.map((x) => String(x).replace(/sk-ant[\w-]*/g, "[key]").slice(0, 300)));
const ideas = [
  { id: "11111111-1111-4111-8111-111111111111", body: "The speaker has always felt different from others." },
  { id: "22222222-2222-4222-8222-222222222222", body: "The storm and dark cloud make his loneliness frightening." },
  { id: "33333333-3333-4333-8333-333333333333", body: "He sees beauty in nature differently from everyone else." },
];
async function main() {
const s = await synthesiseIdeas({ ideas, objective: "Identify how the speaker presents feeling different", instructions: "Group the ideas." });
console.log("PROBE synthesis origin:", s.origin, "clusters:", s.data.length);
const ctx = {
  lessonTitle: "Reading 'Alone' together", objectives: ["Identify how the speaker presents feeling different"],
  stage: { kind: "discussion" as const, title: "Discussion", instructions: "Pick one idea that isn't yours and add to it." },
  nextStageTitle: "Collaborative writing", materialsExcerpt: "", sharedIdeas: ideas.map((i) => i.body),
  recentMessages: [{ author: "Member A", body: "I think the storm is the key image." }], roles: [], intensity: "moderate" as const,
  assistanceLevel: 2, outputType: "document" as const,
};
const f = await facilitatorMessage({ kind: "ask", quick: "discussion_question" }, ctx as never);
console.log("PROBE facilitator origin:", f.origin, "|", f.data.slice(0, 120));
}
void main();
