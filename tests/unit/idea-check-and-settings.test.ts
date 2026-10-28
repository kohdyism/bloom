import { describe, expect, it } from "vitest";
import { bannedWordHit, looksLikeNonsense } from "@/lib/domain/moderation";
import { quickIdeaCheck } from "@/lib/ai/idea-guard";

describe("idea check", () => {
  it("holds back nonsense but lets short, misspelled real ideas through", () => {
    for (const t of ["asdfgh", "jjjjjjj", "lol", "idk", "...", "qwerty uiop", "xkcdrtv"]) expect(looksLikeNonsense(t)).toBe(true);
    for (const t of ["more benches", "quite room at lunch", "ramps", "Why is he alone?", "The storm = his feelings"]) expect(looksLikeNonsense(t)).toBe(false);
  });
  it("puts safety first, then kindness, then nonsense", () => {
    expect(quickIdeaCheck("I want to kill myself").verdict).toBe("safeguarding");
    expect(quickIdeaCheck("you're all idiots").verdict).toBe("unkind");
    expect(quickIdeaCheck("asdfasdf").verdict).toBe("nonsense");
    expect(quickIdeaCheck("A quiet room for people who find the canteen loud").verdict).toBe("ok");
  });
});

describe("banned words", () => {
  it("matches whole words in any case, not parts of words", () => {
    expect(bannedWordHit("Is anyone getting PIZZA later?", ["pizza"])).toBe("pizza");
    expect(bannedWordHit("I like pizzazz", ["pizza"])).toBeNull();
    expect(bannedWordHit("no banned words here", [])).toBeNull();
    expect(bannedWordHit("that's so c++", ["c++"])).toBe("c++");
  });
});
