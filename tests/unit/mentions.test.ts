import { describe, expect, it } from "vitest";
import { mentionsHelper } from "@/lib/domain/mentions";

describe("mentionsHelper", () => {
  it("spots a student talking to the group helper", () => {
    for (const t of ["@Bloom what does presents mean?", "Bloom, can you help?", "hey bloom we're stuck", "@nova help"]) expect(mentionsHelper(t)).toBe(true);
  });
  it("ignores ordinary messages", () => {
    for (const t of ["I think the storm is key", "the flowers bloom in spring", "a supernova"]) expect(mentionsHelper(t)).toBe(false);
  });
});
