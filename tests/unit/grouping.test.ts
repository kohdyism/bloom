import { describe, expect, it } from "vitest";
import { pairKey, planSizes, recommendGroups, validateAssignment, type GroupingStudent } from "@/lib/domain/grouping";

const students = (n: number, extra: (i: number) => Partial<GroupingStudent> = () => ({})): GroupingStudent[] =>
  Array.from({ length: n }, (_, i) => ({ id: `s${String(i).padStart(2, "0")}`, name: `Student ${i}`, ...extra(i) }));

const base = { keepApart: [] as [string, string][], keepTogether: [] as [string, string][], history: {} };

describe("planSizes", () => {
  it("splits evenly within limits", () => {
    expect(planSizes(10, 3, 4)).toEqual([4, 3, 3]);
    expect(planSizes(8, 2, 2)).toEqual([2, 2, 2, 2]);
    expect(planSizes(4, 3, 4)).toEqual([4]);
  });
  it("returns null when impossible", () => {
    expect(planSizes(5, 3, 3)).toBeNull();
    expect(planSizes(3, 4, 2)).toBeNull();
  });
});

describe("recommendGroups", () => {
  it("places every student exactly once within size limits", () => {
    const r = recommendGroups({ ...base, students: students(20), sizeMin: 3, sizeMax: 4 });
    expect(r.feasible).toBe(true);
    const all = r.groups.flat();
    expect(new Set(all).size).toBe(20);
    expect(all).toHaveLength(20);
    for (const g of r.groups) {
      expect(g.length).toBeGreaterThanOrEqual(3);
      expect(g.length).toBeLessThanOrEqual(4);
    }
  });

  it("never breaks a keep-apart rule, across many random seeds and rule sets", () => {
    const s = students(16);
    for (let seed = 1; seed <= 40; seed++) {
      const apart: [string, string][] = [];
      for (let k = 0; k < 10; k++) {
        const a = s[(seed * 7 + k * 3) % 16].id;
        const b = s[(seed * 5 + k * 11 + 1) % 16].id;
        if (a !== b) apart.push([a, b]);
      }
      const r = recommendGroups({ ...base, students: s, sizeMin: 3, sizeMax: 4, keepApart: apart, seed });
      if (!r.feasible) continue;
      const bad = new Set(apart.map(([a, b]) => pairKey(a, b)));
      for (const g of r.groups) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
        expect(bad.has(pairKey(g[i], g[j]))).toBe(false);
      }
    }
  });

  it("explains infeasible keep-apart rules instead of silently violating them", () => {
    // Three students who must all be apart, but only one group is possible.
    const s = students(3);
    const r = recommendGroups({ ...base, students: s, sizeMin: 3, sizeMax: 3, keepApart: [["s00", "s01"], ["s01", "s02"]] });
    expect(r.feasible).toBe(false);
    expect(r.groups).toEqual([]);
    expect(r.warnings.some((w) => w.kind === "keep_apart" && /won't break/.test(w.message))).toBe(true);
  });

  it("is deterministic for the same seed and varies with a new seed", () => {
    const s = students(12, (i) => ({ survey: { communication: i % 2 ? "write" : "talk" } }));
    const a = recommendGroups({ ...base, students: s, sizeMin: 3, sizeMax: 3, seed: 7 });
    const b = recommendGroups({ ...base, students: s, sizeMin: 3, sizeMax: 3, seed: 7 });
    expect(a.groups).toEqual(b.groups);
    const outcomes = new Set([1, 2, 3, 4, 5, 6].map((seed) => JSON.stringify(recommendGroups({ ...base, students: s, sizeMin: 3, sizeMax: 3, seed }).groups)));
    expect(outcomes.size).toBeGreaterThan(1);
  });

  it("favours new combinations over pairs who worked together recently", () => {
    const s = students(6);
    const history: Record<string, number> = { [pairKey("s00", "s01")]: 3, [pairKey("s02", "s03")]: 3, [pairKey("s04", "s05")]: 3 };
    const r = recommendGroups({ ...base, students: s, sizeMin: 2, sizeMax: 2, history });
    for (const g of r.groups) expect(history[pairKey(g[0], g[1])] ?? 0).toBe(0);
  });

  it("keeps prefer-together pairs together unless a keep-apart rule forbids it", () => {
    const s = students(8);
    const r = recommendGroups({ ...base, students: s, sizeMin: 4, sizeMax: 4, keepTogether: [["s01", "s06"]] });
    expect(r.groups.some((g) => g.includes("s01") && g.includes("s06"))).toBe(true);
    const conflict = recommendGroups({ ...base, students: s, sizeMin: 4, sizeMax: 4, keepTogether: [["s01", "s06"]], keepApart: [["s01", "s06"]] });
    expect(conflict.groups.some((g) => g.includes("s01") && g.includes("s06"))).toBe(false);
    expect(conflict.warnings.some((w) => w.kind === "keep_together")).toBe(true);
  });

  it("relaxes only the minimum size, and says so", () => {
    const r = recommendGroups({ ...base, students: students(5), sizeMin: 3, sizeMax: 3 });
    expect(r.feasible).toBe(true);
    expect(Math.max(...r.groups.map((g) => g.length))).toBeLessThanOrEqual(3);
    expect(r.warnings.some((w) => w.kind === "size")).toBe(true);
  });

  it("produces factual reasons without personality labels or scores", () => {
    const s = students(8, (i) => ({ survey: { communication: i % 2 ? "write" : "talk" }, supports: i === 0 ? ["extra_processing_time"] : [] }));
    const r = recommendGroups({ ...base, students: s, sizeMin: 4, sizeMax: 4 });
    const text = r.reasons.flat().join(" ").toLowerCase();
    for (const banned of ["anxious", "shy", "disruptive", "compatib", "score", "lazy", "diagnos"]) expect(text).not.toContain(banned);
  });
});

describe("validateAssignment", () => {
  it("blocks keep-apart violations and duplicates but only warns about sizes", () => {
    const names = (id: string) => id;
    const r = validateAssignment([["a", "b", "c", "d", "e"], ["f", "a"]], [["b", "c"]], 2, 4, names);
    expect(r.blocking.some((m) => m.includes("keep apart"))).toBe(true);
    expect(r.blocking.some((m) => m.includes("more than one group"))).toBe(true);
    expect(r.warnings.some((m) => m.includes("more than the lesson maximum"))).toBe(true);
  });
});
