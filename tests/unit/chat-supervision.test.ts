import { describe, expect, it } from "vitest";
import { quickCheck, reviewChatMessage } from "@/lib/ai/chat-guard";
import { chatOpenIn, makeStage } from "@/lib/domain/lesson";

describe("group chat per stage", () => {
  it("is on by default, and off when the teacher turns it off", () => {
    expect(chatOpenIn(makeStage("creation"))).toBe(true);
    expect(chatOpenIn(makeStage("creation", { config: { groupChat: false } }))).toBe(false);
    expect(chatOpenIn(makeStage("discussion", { config: { groupChat: false } }))).toBe(false);
  });
  it("is never open during talk time or reflection", () => {
    expect(chatOpenIn(makeStage("talk"))).toBe(false);
    expect(chatOpenIn(makeStage("reflection"))).toBe(false);
  });
  it("keeps older lessons (no setting) working", () => {
    expect(chatOpenIn({ kind: "brainstorm", config: {} })).toBe(true);
  });
});

describe("supervised chat", () => {
  it("lets on-task and friendly working messages through", () => {
    for (const t of ["I think the storm line is strongest", "ok", "agree!", "lol good point", "Who wants to be timekeeper?"]) expect(quickCheck(t).verdict).toBe("ok");
  });
  it("holds back unkind messages with a kind note", () => {
    const v = quickCheck("shut up you idiot");
    expect(v.verdict).toBe("unkind");
    expect(v.note).not.toMatch(/idiot/);
  });
  it("holds back clearly off-task messages and keyboard mashing", () => {
    expect(quickCheck("anyone on fortnite tonight").verdict).toBe("off_task");
    expect(quickCheck("aaaaaaaaaa").verdict).toBe("off_task");
  });
  it("falls back to the quick rules without live AI", async () => {
    await expect(reviewChatMessage({ lesson: "Poems", stage: "Discuss", instructions: "", recent: [], text: "play roblox later?" })).resolves.toMatchObject({ verdict: "off_task" });
    await expect(reviewChatMessage({ lesson: "Poems", stage: "Discuss", instructions: "", recent: [], text: "The poem feels lonely" })).resolves.toMatchObject({ verdict: "ok" });
  });
});
