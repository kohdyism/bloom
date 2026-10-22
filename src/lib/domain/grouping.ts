/**
 * Group recommendation engine (spec §9.2).
 *
 * Deterministic, auditable, constraint-based. No personality scores, no
 * compatibility ratings, no inference from behaviour. Inputs are only:
 *   - group size limits set by the teacher
 *   - teacher-entered pairing rules ("keep apart" is HARD, "prefer together" is soft)
 *   - the student's own stated working preferences
 *   - functional supports the teacher switched on (only "smaller groups" and
 *     spreading of turn-taking/processing-time supports are used)
 *   - who has worked together recently (to favour variety)
 * The same inputs and seed always produce the same result.
 */

export type GroupingStudent = {
  id: string;
  name: string;
  survey?: Partial<Record<"communication" | "workingStyle" | "thinkingTime" | "structure", string>>;
  supports?: string[];
};

export type GroupingInput = {
  students: GroupingStudent[];
  sizeMin: number;
  sizeMax: number;
  keepApart: [string, string][];
  keepTogether: [string, string][];
  /** pairKey(a,b) -> number of recent sessions they were grouped together */
  history: Record<string, number>;
  seed?: number;
};

export type GroupingWarning = { kind: "size" | "keep_apart" | "keep_together" | "history" | "info"; message: string };

export type GroupingResult = {
  feasible: boolean;
  groups: string[][];
  warnings: GroupingWarning[];
  reasons: string[][];
  score: number;
};

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Even group sizes within [min, max]; returns null when impossible. */
export function planSizes(n: number, min: number, max: number): number[] | null {
  if (n === 0) return [];
  if (min > max) return null;
  for (let k = Math.ceil(n / max); k <= Math.max(1, Math.floor(n / min)); k++) {
    const base = Math.floor(n / k);
    const extra = n % k;
    const sizes = Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
    if (sizes.every((s) => s >= min && s <= max)) return sizes;
  }
  return null;
}

type Ctx = {
  apart: Set<string>;
  together: Set<string>;
  history: Record<string, number>;
  byId: Map<string, GroupingStudent>;
};

const writes = (s?: GroupingStudent) => s?.survey?.communication === "write";
const talks = (s?: GroupingStudent) => s?.survey?.communication === "talk";
const needsTurnTaking = (s?: GroupingStudent) => !!s?.supports?.some((x) => x === "explicit_turn_taking" || x === "extra_processing_time");
const prefersSmall = (s?: GroupingStudent) =>
  !!s?.supports?.includes("smaller_groups") || s?.survey?.workingStyle === "pairs" || s?.survey?.workingStyle === "solo_first";

/** Soft cost of a group: lower is better. Hard constraints are handled separately. */
function groupCost(members: string[], targetSize: number, minSize: number, ctx: Ctx): number {
  let cost = 0;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const k = pairKey(members[i], members[j]);
      cost += 4 * (ctx.history[k] ?? 0);
      if (ctx.together.has(k)) cost -= 6;
    }
  }
  const studs = members.map((m) => ctx.byId.get(m));
  // Variety of communication preferences: avoid groups that are all "write" or all "talk".
  const w = studs.filter(writes).length;
  const t = studs.filter(talks).length;
  if (members.length >= 3 && (w === members.length || t === members.length)) cost += 3;
  if (members.length >= 3 && w >= 1 && t >= 1) cost -= 1;
  // Spread supports that rely on structured turn-taking across groups.
  const tt = studs.filter(needsTurnTaking).length;
  if (tt > 1) cost += 3 * (tt - 1);
  // Students who prefer smaller groups go in the smaller groups when sizes differ.
  const small = studs.filter(prefersSmall).length;
  if (small > 0 && targetSize > minSize) cost += 1.5 * small;
  return cost;
}

function violatesApart(members: string[], candidate: string[], ctx: Ctx) {
  for (const a of members) for (const b of candidate) if (ctx.apart.has(pairKey(a, b))) return true;
  return false;
}

/** Union-find over "prefer together" pairs to form units placed as one. */
function buildUnits(ids: string[], together: [string, string][], apart: Set<string>, max: number, warnings: GroupingWarning[], names: (id: string) => string) {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (x: string): string => (parent.get(x) === x ? x : find(parent.get(x)!));
  for (const [a, b] of together) {
    if (!parent.has(a) || !parent.has(b)) continue;
    if (apart.has(pairKey(a, b))) {
      warnings.push({ kind: "keep_together", message: `${names(a)} and ${names(b)} have both “keep apart” and “prefer together” rules; “keep apart” wins.` });
      continue;
    }
    parent.set(find(a), find(b));
  }
  const units = new Map<string, string[]>();
  for (const id of ids) {
    const r = find(id);
    if (!units.has(r)) units.set(r, []);
    units.get(r)!.push(id);
  }
  const out: string[][] = [];
  for (const u of units.values()) {
    if (u.length > max) {
      warnings.push({ kind: "keep_together", message: `A “prefer together” chain links ${u.length} students, more than the maximum group size of ${max}. It has been split.` });
      for (let i = 0; i < u.length; i += max) out.push(u.slice(i, i + max));
    } else out.push(u);
  }
  return out;
}

export function recommendGroups(input: GroupingInput): GroupingResult {
  const warnings: GroupingWarning[] = [];
  const ids = [...new Set(input.students.map((s) => s.id))].sort();
  const byId = new Map(input.students.map((s) => [s.id, s]));
  const names = (id: string) => byId.get(id)?.name ?? "A student";
  const apart = new Set(input.keepApart.filter(([a, b]) => byId.has(a) && byId.has(b)).map(([a, b]) => pairKey(a, b)));
  const together = new Set(input.keepTogether.filter(([a, b]) => byId.has(a) && byId.has(b)).map(([a, b]) => pairKey(a, b)));
  const ctx: Ctx = { apart, together, history: input.history, byId };

  if (ids.length === 0) return { feasible: true, groups: [], warnings: [{ kind: "info", message: "No students have joined yet." }], reasons: [], score: 0 };

  let sizes = planSizes(ids.length, input.sizeMin, input.sizeMax);
  if (!sizes) {
    // Relax the minimum (never the maximum) and say so.
    sizes = planSizes(ids.length, 1, input.sizeMax) ?? [ids.length];
    warnings.push({
      kind: "size",
      message: `${ids.length} students can't be split into groups of ${input.sizeMin}–${input.sizeMax}. Suggested sizes: ${sizes.join(", ")}.`,
    });
  }
  // Smaller groups last, so the largest groups fill first.
  sizes = [...sizes].sort((a, b) => b - a);
  const minSize = Math.min(...sizes);

  const units = buildUnits(ids, input.keepTogether, apart, input.sizeMax, warnings, names);
  const rand = mulberry32(input.seed ?? 1);
  // Most-constrained first: units with more keep-apart links, then larger units.
  const apartDegree = (u: string[]) => u.reduce((acc, id) => acc + [...apart].filter((k) => k.includes(id)).length, 0);
  const order = units
    .map((u) => ({ u, d: apartDegree(u), r: rand() }))
    .sort((a, b) => b.d - a.d || b.u.length - a.u.length || a.r - b.r)
    .map((x) => x.u);

  // Backtracking placement for hard constraints + capacity, cost-guided.
  const groups: string[][] = sizes.map(() => []);
  let steps = 0;
  const place = (i: number): boolean => {
    if (i === order.length) return true;
    if (++steps > 200_000) return false;
    const unit = order[i];
    const options = groups
      .map((g, gi) => ({ gi, fits: g.length + unit.length <= sizes![gi] && !violatesApart(g, unit, ctx) }))
      .filter((o) => o.fits)
      .map((o) => ({ ...o, delta: groupCost([...groups[o.gi], ...unit], sizes![o.gi], minSize, ctx) - groupCost(groups[o.gi], sizes![o.gi], minSize, ctx) + rand() * 0.01 }))
      .sort((a, b) => a.delta - b.delta);
    for (const o of options) {
      groups[o.gi].push(...unit);
      if (place(i + 1)) return true;
      groups[o.gi].splice(groups[o.gi].length - unit.length, unit.length);
    }
    return false;
  };

  if (!place(0)) {
    const pairs = [...apart].map((k) => k.split("|").map(names).join(" and "));
    return {
      feasible: false,
      groups: [],
      warnings: [
        ...warnings,
        {
          kind: "keep_apart",
          message: `These “keep apart” rules can't all be met with ${sizes.length} group${sizes.length === 1 ? "" : "s"} of sizes ${sizes.join(", ")}: ${pairs.join("; ")}. Allow more or smaller groups, or review the rules. Canopy won't break a “keep apart” rule.`,
        },
      ],
      reasons: [],
      score: Infinity,
    };
  }

  // Local improvement: swap single students between groups when it lowers
  // total cost and keeps every hard constraint and "together" unit intact.
  const unitOf = new Map<string, string[]>();
  for (const u of units) for (const id of u) unitOf.set(id, u);
  const total = () => groups.reduce((acc, g, gi) => acc + groupCost(g, sizes![gi], minSize, ctx), 0);
  let current = total();
  for (let iter = 0; iter < 1500; iter++) {
    const ga = Math.floor(rand() * groups.length);
    const gb = Math.floor(rand() * groups.length);
    if (ga === gb || !groups[ga].length || !groups[gb].length) continue;
    const a = groups[ga][Math.floor(rand() * groups[ga].length)];
    const b = groups[gb][Math.floor(rand() * groups[gb].length)];
    if (unitOf.get(a)!.length > 1 || unitOf.get(b)!.length > 1) continue;
    const na = groups[ga].filter((x) => x !== a);
    const nb = groups[gb].filter((x) => x !== b);
    if (violatesApart(na, [b], ctx) || violatesApart(nb, [a], ctx)) continue;
    const before = groupCost(groups[ga], sizes[ga], minSize, ctx) + groupCost(groups[gb], sizes[gb], minSize, ctx);
    const after = groupCost([...na, b], sizes[ga], minSize, ctx) + groupCost([...nb, a], sizes[gb], minSize, ctx);
    if (after < before) {
      groups[ga] = [...na, b];
      groups[gb] = [...nb, a];
      current = current - before + after;
    }
  }

  const reasons = groups.map((g, gi) => explainGroup(g, sizes![gi], minSize, ctx));
  const repeats = groups.flatMap((g) => g.flatMap((a, i) => g.slice(i + 1).filter((b) => (ctx.history[pairKey(a, b)] ?? 0) > 0).map((b) => [a, b])));
  if (repeats.length) {
    warnings.push({ kind: "history", message: `${repeats.length} pair${repeats.length === 1 ? " has" : "s have"} worked together recently — unavoidable with the current rules and sizes, or adjust by hand.` });
  }
  return { feasible: true, groups, warnings, reasons, score: current };
}

function explainGroup(members: string[], size: number, minSize: number, ctx: Ctx): string[] {
  const studs = members.map((m) => ctx.byId.get(m));
  const out: string[] = [];
  const w = studs.filter(writes).length;
  const t = studs.filter(talks).length;
  if (w && t) out.push(`Mix of ways to contribute: ${t} prefer${t === 1 ? "s" : ""} talking first, ${w} prefer${w === 1 ? "s" : ""} writing first.`);
  else if (w === members.length) out.push("Everyone here prefers writing first — written stages will suit them.");
  let newPairs = 0;
  let total = 0;
  for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
    total++;
    if (!(ctx.history[pairKey(members[i], members[j])] ?? 0)) newPairs++;
  }
  if (total) out.push(newPairs === total ? "No one here has been grouped together recently." : `${newPairs} of ${total} pairs are new combinations.`);
  if (studs.some(prefersSmall) && size === minSize) out.push("A smaller group, matching a stated or teacher-set preference.");
  if (studs.filter(needsTurnTaking).length === 1) out.push("Structured turn-taking support is spread across groups.");
  for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
    if (ctx.together.has(pairKey(members[i], members[j]))) out.push(`Keeps a “prefer together” pair: ${ctx.byId.get(members[i])?.name} and ${ctx.byId.get(members[j])?.name}.`);
  }
  return out;
}

/** Validate a teacher's (possibly hand-edited) assignment against hard rules. */
export function validateAssignment(groups: string[][], keepApart: [string, string][], sizeMin: number, sizeMax: number, names: (id: string) => string) {
  /** Blocking problems prevent approval; warnings are shown but the teacher may override. */
  const blocking: string[] = [];
  const warnings: string[] = [];
  const apart = new Set(keepApart.map(([a, b]) => pairKey(a, b)));
  const seen = new Set<string>();
  groups.forEach((g, gi) => {
    if (g.length > sizeMax) warnings.push(`Group ${gi + 1} has ${g.length} students — more than the lesson maximum of ${sizeMax}.`);
    if (g.length > 0 && g.length < sizeMin) warnings.push(`Group ${gi + 1} has ${g.length} student${g.length === 1 ? "" : "s"} — fewer than the lesson minimum of ${sizeMin}.`);
    for (const id of g) {
      if (seen.has(id)) blocking.push(`${names(id)} is in more than one group.`);
      seen.add(id);
    }
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      if (apart.has(pairKey(g[i], g[j]))) blocking.push(`Group ${gi + 1} breaks a “keep apart” rule: ${names(g[i])} and ${names(g[j])}.`);
    }
  });
  return { blocking, warnings };
}
