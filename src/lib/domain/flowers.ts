/**
 * Collectible flowers. When a group finishes every stage, its plant opens into
 * one of these. Each student keeps the flowers from their groups in their
 * garden. Purely cooperative: a flower belongs to the whole group, and nothing
 * here is ranked or compared between students.
 */
export const FLOWERS = [
  { id: "daisy", name: "Daisy", blurb: "Simple and cheerful — a great first bloom." },
  { id: "sunflower", name: "Sunflower", blurb: "Always turns to face the light." },
  { id: "tulip", name: "Tulip", blurb: "Grows back stronger every spring." },
  { id: "poppy", name: "Poppy", blurb: "Bright enough to spot from across a field." },
  { id: "forget_me_not", name: "Forget-me-not", blurb: "Tiny, but it never goes unnoticed." },
  { id: "cherry_blossom", name: "Cherry blossom", blurb: "Blooms all at once, together." },
  { id: "bluebell", name: "Bluebell", blurb: "Grows in big, friendly crowds." },
  { id: "lavender", name: "Lavender", blurb: "Calm, and smells wonderful." },
  { id: "rose", name: "Rose", blurb: "Layer upon layer, like good teamwork." },
  { id: "marigold", name: "Marigold", blurb: "Warm as a summer afternoon." },
  { id: "lotus", name: "Lotus", blurb: "Rises up from muddy water — rare and special." },
  { id: "hibiscus", name: "Hibiscus", blurb: "Big, bold and full of sunshine — rare and special." },
] as const;

export type FlowerId = (typeof FLOWERS)[number]["id"];
export const isFlowerId = (x: unknown): x is FlowerId => FLOWERS.some((f) => f.id === x);
export const flowerInfo = (id: FlowerId) => FLOWERS.find((f) => f.id === id)!;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Pick the flower a group's plant opens into: one the members have collected
 * least (so each bloom tends to be new to them), tie-broken by the group id so
 * the choice is stable.
 */
export function pickFlower(groupId: string, memberCollections: FlowerId[][]): FlowerId {
  const counts = new Map<FlowerId, number>(FLOWERS.map((f) => [f.id, 0]));
  for (const col of memberCollections) for (const f of new Set(col)) counts.set(f, (counts.get(f) ?? 0) + 1);
  const min = Math.min(...counts.values());
  const fresh = FLOWERS.filter((f) => counts.get(f.id) === min);
  return fresh[hash(groupId) % fresh.length].id;
}
