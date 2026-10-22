import "server-only";
import { z } from "zod";
import { runStructured, untrusted, type AiResult } from "./core";

/**
 * Idea synthesis AI
 * Responsibility: organise a group's shared ideas into themes, with explicit
 *   references to the ideas behind each theme.
 * Allowed inputs: idea text keyed by opaque references (no names), the lesson
 *   objective and stage instructions.
 * Output: clusters, each listing the idea references it contains.
 * Verification: every reference must exist; any idea the model left out is
 *   added to a "Different angles" theme so no contribution is ever dropped,
 *   and no theme may cite an idea that doesn't exist.
 * Prohibited: inventing ideas, merging away minority or unusual views,
 *   judging which ideas are "best", naming students.
 */
export type SynthesisCluster = { id: string; title: string; summary: string; ideaIds: string[] };

const schema = z.object({
  clusters: z.array(z.object({ title: z.string(), summary: z.string(), ideaRefs: z.array(z.string()) })),
});

const SYSTEM = `You help a small group of secondary students see the shape of their own ideas. Group the ideas into 2–5 themes.
Rules:
- Use only the ideas provided. Never add new ideas or facts.
- Every idea must appear in at least one theme. Keep unusual or dissenting ideas visible — give them their own theme ("A different angle" style) rather than merging them away.
- Theme titles: 2–6 words. Summaries: one sentence describing what the ideas in the theme have in common, in neutral language. Do not judge which ideas are better.
- Refer to ideas only by their reference (e.g. "i3").`;

export async function synthesiseIdeas(input: { ideas: { id: string; body: string }[]; objective: string; instructions: string }): Promise<AiResult<SynthesisCluster[]>> {
  const refs = input.ideas.map((idea, i) => ({ ref: `i${i + 1}`, ...idea }));
  const byRef = new Map(refs.map((r) => [r.ref, r.id]));
  const prompt = [
    `Lesson objective: ${input.objective || "(not given)"}`,
    `Stage instructions: ${input.instructions || "(not given)"}`,
    "Ideas:",
    ...refs.map((r) => `${r.ref}: ${untrusted("student_idea", r.body, 600)}`),
  ].join("\n");

  const result = await runStructured({
    workflow: "synthesis",
    system: SYSTEM,
    prompt,
    schema,
    maxTokens: 1500,
    simulate: () => ({ clusters: simulateClusters(refs.map((r) => ({ ref: r.ref, body: r.body }))) }),
    verify: (d) => d.clusters.length > 0 && d.clusters.every((c) => c.ideaRefs.every((r) => byRef.has(r))),
  });

  return { origin: result.origin, data: finaliseClusters(result.data.clusters, byRef) };
}

/** Map refs back to ids, drop empty themes, and guarantee every idea is present. */
export function finaliseClusters(clusters: { title: string; summary: string; ideaRefs: string[] }[], byRef: Map<string, string>): SynthesisCluster[] {
  const used = new Set<string>();
  const out: SynthesisCluster[] = [];
  clusters.forEach((c, i) => {
    const ideaIds = [...new Set(c.ideaRefs.map((r) => byRef.get(r)).filter((x): x is string => !!x))];
    if (!ideaIds.length) return;
    ideaIds.forEach((id) => used.add(id));
    out.push({ id: `c${i + 1}`, title: c.title.slice(0, 80) || "Theme", summary: c.summary.slice(0, 300), ideaIds });
  });
  const missing = [...byRef.values()].filter((id) => !used.has(id));
  if (missing.length) {
    out.push({ id: `c${out.length + 1}`, title: "Different angles", summary: "Ideas that take their own direction — worth discussing on their own terms.", ideaIds: missing });
  }
  return out;
}

const STOP = new Set(
  "a an and are as at be because but by can could do does for from had has have he her his how i if in into is it its just like me more most my no not of on or our she so some than that the their them then there these they this those to too up us very was we were what when where which who why will with would you your feel feels feeling think thinks really also about poem speaker".split(" "),
);

function stem(w: string) {
  return w.replace(/(ing|ed|ly|es|s)$/u, "").slice(0, 12);
}

function keywords(text: string): string[] {
  return [...new Set(text.toLowerCase().replace(/[^a-z\s'-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem))];
}

/** Deterministic keyword clustering used when the live AI isn't available. */
export function simulateClusters(ideas: { ref: string; body: string }[]): { title: string; summary: string; ideaRefs: string[] }[] {
  const kw = ideas.map((i) => keywords(i.body));
  const freq = new Map<string, number>();
  kw.forEach((ks) => ks.forEach((k) => freq.set(k, (freq.get(k) ?? 0) + 1)));
  // Shared keywords (in 2+ ideas) become theme anchors, most common first.
  const anchors = [...freq.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
  const assigned = new Map<number, string>();
  const clusters: { anchor: string; idx: number[] }[] = [];
  for (const a of anchors) {
    if (clusters.length >= 4) break;
    const idx = kw.map((ks, i) => (ks.includes(a) && !assigned.has(i) ? i : -1)).filter((i) => i >= 0);
    if (idx.length < 2) continue;
    idx.forEach((i) => assigned.set(i, a));
    clusters.push({ anchor: a, idx });
  }
  const result = clusters.map((c) => {
    const word = original(ideas, c.idx, c.anchor);
    return {
      title: `Ideas about “${word}”`,
      summary: `${c.idx.length} ideas that mention ${word} or something close to it.`,
      ideaRefs: c.idx.map((i) => ideas[i].ref),
    };
  });
  const rest = ideas.map((_, i) => i).filter((i) => !assigned.has(i));
  if (rest.length) {
    result.push({
      title: result.length ? "Different angles" : "Your group's ideas",
      summary: result.length ? "Ideas that take their own direction — worth discussing on their own terms." : "These ideas each take a different direction.",
      ideaRefs: rest.map((i) => ideas[i].ref),
    });
  }
  return result;
}

/** Recover a readable word for a stemmed anchor from the original text. */
function original(ideas: { body: string }[], idx: number[], anchor: string) {
  for (const i of idx) {
    const m = ideas[i].body.toLowerCase().match(new RegExp(`\\b(${anchor}[a-z]*)\\b`));
    if (m) return m[1];
  }
  return anchor;
}
