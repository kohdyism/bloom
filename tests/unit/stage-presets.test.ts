import { describe, expect, it } from "vitest";
import { STAGE_PRESETS, stageFromPreset } from "@/lib/domain/stage-presets";
import { stageSchema } from "@/lib/domain/lesson";

describe("stage presets", () => {
  it("splits tasks into online and offline, with discussion offline", () => {
    expect(STAGE_PRESETS.find((p) => p.id === "discussion")?.mode).toBe("offline");
    expect(STAGE_PRESETS.find((p) => p.id === "brainstorm")?.mode).toBe("online");
    expect(STAGE_PRESETS.filter((p) => p.mode === "offline").length).toBeGreaterThanOrEqual(8);
  });
  it("makes valid stages with their own title and instructions", () => {
    for (const p of STAGE_PRESETS) expect(() => stageSchema.parse(stageFromPreset(p))).not.toThrow();
    const debate = stageFromPreset(STAGE_PRESETS.find((p) => p.id === "debate")!);
    expect(debate.kind).toBe("talk");
    expect(debate.title).toBe("Debate");
    expect(debate.durationSeconds).toBe(480);
  });
});
