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

describe("teacher-set minimums before ready", () => {
  it("uses the teacher's number for ideas, votes, chat messages and photos", () => {
    expect(contributionNeeded(makeStage("brainstorm", { config: { minIdeasPerStudent: 3 } }))).toMatchObject({ kind: "idea", count: 3 });
    expect(contributionNeeded(makeStage("voting", { config: { minContribution: 2, votesPerStudent: 3 } }))).toMatchObject({ kind: "vote", count: 2 });
    expect(contributionNeeded(makeStage("discussion", { config: { minContribution: 2 } }))).toMatchObject({ kind: "message", count: 2 });
    expect(contributionNeeded(makeStage("physical", { config: { minContribution: 1, evidenceUpload: true } }))).toMatchObject({ kind: "photo", count: 1 });
  });
  it("never asks for more votes than a student has, and can be switched off", () => {
    expect(contributionNeeded(makeStage("voting", { config: { minContribution: 9, votesPerStudent: 2 } }))?.count).toBe(2);
    expect(contributionNeeded(makeStage("voting", { config: { minContribution: 0 } }))).toBeNull();
    expect(contributionNeeded(makeStage("creation", { config: { minContribution: 0 } }))).toBeNull();
  });
  it("has nothing to count when the task is off screen", () => {
    expect(contributionNeeded(makeStage("discussion", { config: { minContribution: 2, groupChat: false } }))).toBeNull();
    expect(contributionNeeded(makeStage("physical", { config: { minContribution: 2 } }))).toBeNull();
  });
});
