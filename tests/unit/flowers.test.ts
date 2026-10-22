import { describe, expect, it } from "vitest";
import { FLOWERS, pickFlower } from "@/lib/domain/flowers";

describe("pickFlower", () => {
  it("is stable for the same group and collections", () => {
    expect(pickFlower("group-1", [[], []])).toBe(pickFlower("group-1", [[], []]));
  });

  it("prefers a flower none of the members has yet", () => {
    const most = FLOWERS.slice(0, FLOWERS.length - 1).map((f) => f.id);
    expect(pickFlower("group-2", [most, most])).toBe(FLOWERS[FLOWERS.length - 1].id);
  });

  it("chooses among the least-collected when everyone has everything", () => {
    const all = FLOWERS.map((f) => f.id);
    const one = FLOWERS[3].id;
    // Member A has a second copy of every flower except `one`.
    const picked = pickFlower("group-3", [[...all, ...all.filter((f) => f !== one)], all]);
    expect(FLOWERS.map((f) => f.id)).toContain(picked);
  });
});
