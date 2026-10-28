import { describe, expect, it } from "vitest";
import { ruleCheck, safeguardingConcern } from "@/lib/domain/moderation";
import { classifyUrl, videoEmbedUrl } from "@/lib/domain/stage-media";
import { cleanReflection, DEFAULT_REFLECTION, reflectionFor } from "@/lib/domain/reflection";

describe("moderation rules", () => {
  it("puts safeguarding first", () => {
    expect(ruleCheck("i want to kill myself")).toBe("safeguarding");
    expect(safeguardingConcern("I don't feel safe at home")).toBe(true);
    expect(safeguardingConcern("someone hits me after school")).toBe(true);
  });
  it("sorts the rest by kind, and lets on-task messages through", () => {
    expect(ruleCheck("send nudes")).toBe("inappropriate");
    expect(ruleCheck("shut up you idiot")).toBe("unkind");
    expect(ruleCheck("anyone on fortnite later?")).toBe("off_task");
    expect(ruleCheck("I think the storm line shows he feels alone")).toBeNull();
    expect(ruleCheck("The character wants to end it all? No — he wants to be understood")).toBe("safeguarding");
  });
});

describe("stage media", () => {
  it("turns YouTube and Vimeo links into privacy-friendly embeds", () => {
    expect(videoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoEmbedUrl("https://youtu.be/dQw4w9WgXcQ?t=3")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoEmbedUrl("https://vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789");
    expect(videoEmbedUrl("javascript:alert(1)")).toBeNull();
  });
  it("guesses what a pasted address is", () => {
    expect(classifyUrl("https://example.org/pic.PNG")).toBe("image");
    expect(classifyUrl("https://phet.colorado.edu/sims/html/forces/latest/forces_en.html")).toBe("link");
    expect(classifyUrl("ftp://example.org/x")).toBeNull();
  });
});

describe("custom reflection questions", () => {
  const set = { ratings: [{ key: "understood", question: "How well did you understand the poem?", low: "Not well", high: "Very well", optional: false }], questions: [{ key: "line", question: "Which line?" }] };
  it("falls back to the standard set", () => {
    expect(reflectionFor({ reflection: null })).toBe(DEFAULT_REFLECTION);
    expect(reflectionFor({ reflection: set }).ratings[0].key).toBe("understood");
  });
  it("keeps only this lesson's questions and needs every required scale", () => {
    expect("error" in cleanReflection(set, {}, {})).toBe(true);
    const ok = cleanReflection(set, { understood: 4, comfort: 5 }, { line: " The storm ", other: "x" });
    expect(ok).toEqual({ ratings: { understood: 4 }, answers: { line: "The storm" } });
  });
});
