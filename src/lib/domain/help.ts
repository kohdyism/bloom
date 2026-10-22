export const HELP_REASONS = [
  { key: "dont_understand", label: "I don't understand the task" },
  { key: "need_time", label: "I need more time" },
  { key: "group_help", label: "I need help with my group" },
  { key: "speak_to_teacher", label: "I want to speak with the teacher" },
  { key: "uncomfortable", label: "Something is making me uncomfortable" },
  { key: "other", label: "Other" },
] as const;
export type HelpReason = (typeof HELP_REASONS)[number]["key"];
export const helpLabel = (k: string) => HELP_REASONS.find((r) => r.key === k)?.label ?? k;

export const HELP_STATUS_LABEL: Record<string, string> = {
  sent: "Sent",
  seen: "Seen by your teacher",
  responding: "Your teacher is responding",
  resolved: "Resolved",
};

export const ASSIST_LABELS: Record<string, string> = {
  explain_simply: "Explain simply",
  break_into_steps: "Break into steps",
  show_example: "Show an example",
  what_is_group_doing: "What's my group doing?",
  summarise_discussion: "Summarise discussion",
  express_idea: "Express my idea",
  prepare_to_contribute: "Prepare to contribute",
  stuck: "I'm stuck",
  question: "Own question",
};
