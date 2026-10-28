import type { LessonConfig, Stage } from "./lesson";

/**
 * Activity progression engine (spec §13). Pure functions over observable
 * signals — never an LLM judgement.
 *
 *   active ──requirements met──▶ ready_check ──readiness rule met──▶ next stage
 *      ▲                              │
 *      └──────── teacher reset ───────┘        teacher can advance at any time
 *
 * Absent members (not connected) never block a group. A student who marks
 * "need more time" holds the group under the all-ready rule. Timers never
 * advance a group or remove work: when time is up the group is simply told,
 * and the teacher can extend.
 */

export type StageSignals = {
  memberIds: string[];
  presentIds: string[];
  ready: Record<string, "ready" | "need_time" | undefined>;
  submittedIdeasBy: Record<string, number>;
  hasSynthesis: boolean;
  votesBy: Record<string, number>;
  rolesBy: Record<string, number>;
  checkinsDone: number;
  hasSubmission: boolean;
};

export type StageEvaluation = {
  requirementsMet: boolean;
  requirementLabel: string;
  readyCount: number;
  needTimeCount: number;
  activeCount: number;
  canAutoAdvance: boolean;
  waitingOn: string;
};

/** Members who count toward readiness: present ones, or everyone if nobody is tracked as present. */
export function activeMembers(s: StageSignals): string[] {
  const present = s.memberIds.filter((m) => s.presentIds.includes(m));
  return present.length ? present : s.memberIds;
}

export function evaluateStage(stage: Stage, config: LessonConfig, s: StageSignals): StageEvaluation {
  const active = activeMembers(s);
  const readyCount = active.filter((m) => s.ready[m] === "ready").length;
  const needTimeCount = active.filter((m) => s.ready[m] === "need_time").length;
  const n = active.length;

  let requirementsMet = true;
  let requirementLabel = "Ready when you are";
  switch (stage.kind) {
    case "brainstorm": {
      const min = stage.config.minIdeasPerStudent;
      const total = Object.values(s.submittedIdeasBy).reduce((a, b) => a + b, 0);
      // Students who contribute verbally can mark themselves ready without typing.
      const satisfied = active.filter((m) => (s.submittedIdeasBy[m] ?? 0) >= min || s.ready[m] === "ready").length;
      requirementsMet = total > 0 && satisfied === n;
      requirementLabel = min > 0 ? `Each person adds ${min} idea${min === 1 ? "" : "s"}` : "At least one idea shared";
      break;
    }
    case "talk":
      requirementLabel = "Talk together, then press ready";
      break;
    case "synthesis":
      requirementsMet = s.hasSynthesis;
      requirementLabel = "Review the grouped ideas";
      break;
    case "voting": {
      const voted = active.filter((m) => (s.votesBy[m] ?? 0) > 0 || s.ready[m] === "ready").length;
      requirementsMet = voted === n;
      requirementLabel = "Everyone votes (or passes)";
      break;
    }
    case "role_selection": {
      if (!config.rolesOptional) {
        requirementsMet = active.every((m) => (s.rolesBy[m] ?? 0) > 0);
        requirementLabel = "Everyone chooses a role";
      } else requirementLabel = "Choose roles if you'd like one";
      break;
    }
    case "physical": {
      const needed = stage.config.checkins.length;
      requirementsMet = s.checkinsDone >= needed;
      requirementLabel = needed ? `Complete ${needed} check-in${needed === 1 ? "" : "s"}` : "Finish the activity";
      break;
    }
    case "submission":
      requirementsMet = s.hasSubmission;
      requirementLabel = "Submit the group's work";
      break;
  }

  let canAutoAdvance = false;
  let waitingOn = "";
  const majority = Math.floor(n / 2) + 1;
  switch (stage.config.completion) {
    case "teacher_only":
      waitingOn = "Your teacher will move the group on";
      break;
    case "all_ready":
      canAutoAdvance = requirementsMet && n > 0 && readyCount === n;
      waitingOn = !requirementsMet ? requirementLabel : `${readyCount} of ${n} ready`;
      break;
    case "majority_ready":
      canAutoAdvance = requirementsMet && n > 0 && readyCount >= majority && needTimeCount < majority;
      waitingOn = !requirementsMet ? requirementLabel : `${readyCount} of ${n} ready (${majority} needed)`;
      break;
    case "on_requirements":
      canAutoAdvance = requirementsMet && n > 0 && readyCount >= majority && needTimeCount === 0;
      waitingOn = !requirementsMet ? requirementLabel : needTimeCount ? "Someone asked for more time" : `${readyCount} of ${n} ready (${majority} needed)`;
      break;
  }
  return { requirementsMet, requirementLabel, readyCount, needTimeCount, activeCount: n, canAutoAdvance, waitingOn };
}

export type TimerState = { remainingSeconds: number | null; overdue: boolean; warning: boolean };

export function timerState(deadline: Date | null, paused: boolean, remainingOnPause: number | null, warnSeconds: number, now = new Date()): TimerState {
  if (paused) return { remainingSeconds: remainingOnPause, overdue: (remainingOnPause ?? 1) <= 0, warning: false };
  if (!deadline) return { remainingSeconds: null, overdue: false, warning: false };
  const remaining = Math.round((deadline.getTime() - now.getTime()) / 1000);
  return { remainingSeconds: remaining, overdue: remaining <= 0, warning: remaining > 0 && remaining <= warnSeconds };
}

/** Group progress for gamification and dashboards: completed stages / total. */
export function progressFraction(stageIndex: number, stageStatus: string, totalStages: number) {
  if (totalStages === 0) return 0;
  const done = stageStatus === "complete" ? totalStages : stageIndex;
  return Math.min(1, done / totalStages);
}
