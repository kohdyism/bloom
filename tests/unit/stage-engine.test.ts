import { describe, expect, it } from "vitest";
import { evaluateStage, progressFraction, timerState, type StageSignals } from "@/lib/domain/stage-engine";
import { defaultConfig, makeStage } from "@/lib/domain/lesson";

const signals = (over: Partial<StageSignals> = {}): StageSignals => ({
  memberIds: ["a", "b", "c"], presentIds: ["a", "b", "c"], ready: {}, submittedIdeasBy: {}, hasSynthesis: false,
  votesBy: {}, rolesBy: {}, checkinsDone: 0, hasSubmission: false, ...over,
});
const config = defaultConfig();

describe("evaluateStage", () => {
  it("brainstorm needs a submitted idea from each present member (or a ready tap for verbal contributors)", () => {
    const stage = makeStage("brainstorm");
    expect(evaluateStage(stage, config, signals()).requirementsMet).toBe(false);
    const partial = evaluateStage(stage, config, signals({ submittedIdeasBy: { a: 1, b: 2 } }));
    expect(partial.requirementsMet).toBe(false);
    // c prefers to contribute out loud and marks ready instead of typing.
    const verbal = evaluateStage(stage, config, signals({ submittedIdeasBy: { a: 1, b: 2 }, ready: { c: "ready" } }));
    expect(verbal.requirementsMet).toBe(true);
  });

  it("all_ready advances only when every present member is ready", () => {
    const stage = makeStage("discussion");
    expect(evaluateStage(stage, config, signals({ ready: { a: "ready", b: "ready" } })).canAutoAdvance).toBe(false);
    expect(evaluateStage(stage, config, signals({ ready: { a: "ready", b: "ready", c: "ready" } })).canAutoAdvance).toBe(true);
  });

  it("absent members never block the group", () => {
    const stage = makeStage("discussion");
    const e = evaluateStage(stage, config, signals({ presentIds: ["a", "b"], ready: { a: "ready", b: "ready" } }));
    expect(e.activeCount).toBe(2);
    expect(e.canAutoAdvance).toBe(true);
  });

  it("a 'need more time' request holds an all-ready group", () => {
    const stage = makeStage("discussion");
    expect(evaluateStage(stage, config, signals({ ready: { a: "ready", b: "ready", c: "need_time" } })).canAutoAdvance).toBe(false);
  });

  it("teacher_only stages never auto-advance", () => {
    const stage = makeStage("submission", { config: { completion: "teacher_only" } });
    const e = evaluateStage(stage, config, signals({ hasSubmission: true, ready: { a: "ready", b: "ready", c: "ready" } }));
    expect(e.requirementsMet).toBe(true);
    expect(e.canAutoAdvance).toBe(false);
  });

  it("submission moves on by itself once the work is in and everyone is ready", () => {
    const stage = makeStage("submission");
    expect(evaluateStage(stage, config, signals({ hasSubmission: false, ready: { a: "ready", b: "ready", c: "ready" } })).canAutoAdvance).toBe(false);
    expect(evaluateStage(stage, config, signals({ hasSubmission: true, ready: { a: "ready", b: "ready", c: "ready" } })).canAutoAdvance).toBe(true);
  });

  it("talk time has nothing to complete first: it moves on when everyone is ready", () => {
    const stage = makeStage("talk");
    const e = evaluateStage(stage, config, signals({ ready: { a: "ready", b: "ready", c: "ready" } }));
    expect(e.requirementsMet).toBe(true);
    expect(e.canAutoAdvance).toBe(true);
  });

  it("majority_ready needs more than half and isn't blocked by a minority asking for time", () => {
    const stage = makeStage("discussion", { config: { completion: "majority_ready" } });
    expect(evaluateStage(stage, config, signals({ ready: { a: "ready" } })).canAutoAdvance).toBe(false);
    expect(evaluateStage(stage, config, signals({ ready: { a: "ready", b: "ready", c: "need_time" } })).canAutoAdvance).toBe(true);
  });

  it("physical stages complete when every check-in is ticked", () => {
    const stage = makeStage("physical", { config: { checkins: ["one", "two"], completion: "on_requirements" } });
    expect(evaluateStage(stage, config, signals({ checkinsDone: 1, ready: { a: "ready", b: "ready" } })).canAutoAdvance).toBe(false);
    expect(evaluateStage(stage, config, signals({ checkinsDone: 2, ready: { a: "ready", b: "ready" } })).canAutoAdvance).toBe(true);
  });

  it("required roles block until everyone has one", () => {
    const strict = defaultConfig({ rolesOptional: false });
    const stage = makeStage("role_selection");
    expect(evaluateStage(stage, strict, signals({ rolesBy: { a: 1, b: 1 } })).requirementsMet).toBe(false);
    expect(evaluateStage(stage, strict, signals({ rolesBy: { a: 1, b: 1, c: 2 } })).requirementsMet).toBe(true);
  });
});

describe("timers and progress", () => {
  it("reports warnings and overdue without changing anything", () => {
    const now = new Date("2026-10-22T10:00:00Z");
    expect(timerState(new Date("2026-10-22T10:00:30Z"), false, null, 60, now)).toMatchObject({ remainingSeconds: 30, warning: true, overdue: false });
    expect(timerState(new Date("2026-10-22T09:59:00Z"), false, null, 60, now)).toMatchObject({ overdue: true });
    expect(timerState(null, true, 120, 60, now)).toMatchObject({ remainingSeconds: 120, warning: false });
  });
  it("progress counts completed stages only", () => {
    expect(progressFraction(0, "active", 4)).toBe(0);
    expect(progressFraction(2, "active", 4)).toBe(0.5);
    expect(progressFraction(3, "complete", 4)).toBe(1);
  });
});
