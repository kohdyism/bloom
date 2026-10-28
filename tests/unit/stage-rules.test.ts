import { describe, expect, it } from "vitest";
import { contributionNeeded, makeStage, pipAvailableIn } from "@/lib/domain/lesson";

describe("Pip availability", () => {
  const lessonOn = { privateAssistant: true };
  it("is never available in face-to-face stages", () => {
    expect(pipAvailableIn(makeStage("talk"), lessonOn)).toBe(false);
    expect(pipAvailableIn(makeStage("discussion"), lessonOn)).toBe(false);
  });
  it("follows the lesson switch first, then the stage switch", () => {
    expect(pipAvailableIn(makeStage("brainstorm"), lessonOn)).toBe(true);
    expect(pipAvailableIn(makeStage("brainstorm"), { privateAssistant: false })).toBe(false);
    expect(pipAvailableIn(makeStage("brainstorm", { config: { privateAssistant: false } }), lessonOn)).toBe(false);
    // Older lessons without the setting keep Pip on.
    expect(pipAvailableIn(makeStage("creation"), {})).toBe(true);
  });
});

describe("contribution before ready", () => {
  it("asks for an idea, a vote or a change to the work", () => {
    expect(contributionNeeded(makeStage("brainstorm"))?.kind).toBe("idea");
    expect(contributionNeeded(makeStage("voting"))?.kind).toBe("vote");
    expect(contributionNeeded(makeStage("creation"))?.kind).toBe("work");
  });
  it("doesn't block stages without input, or thinking when the teacher made ideas optional", () => {
    expect(contributionNeeded(makeStage("discussion"))).toBeNull();
    expect(contributionNeeded(makeStage("talk"))).toBeNull();
    expect(contributionNeeded(makeStage("brainstorm", { config: { minIdeasPerStudent: 0 } }))).toBeNull();
  });
});
