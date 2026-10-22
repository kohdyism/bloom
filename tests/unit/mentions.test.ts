import { describe, expect, it } from "vitest";
import { mentionsHelper } from "@/lib/domain/mentions";

describe("mentionsHelper", () => {
  it("spots a student talking to the group helper", () => {
    for (const t of ["@Nova what does presents mean?", "Nova, can you help?", "hey nova we're stuck", "@bloom help"]) expect(mentionsHelper(t)).toBe(true);
  });
  it("ignores ordinary messages", () => {
    for (const t of ["I think the storm is key", "a supernova", "my friend nova said hi"]) expect(mentionsHelper(t)).toBe(false);
  });
});
