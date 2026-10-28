/**
 * Plain-rule checks shared by the group chat and Pip. They are deliberately
 * simple and predictable: they never decide anything about a student on
 * their own — they hold a message back, tell the student kindly why, and
 * tell the teacher so a person can follow up.
 */
export type FlagCategory = "off_task" | "unkind" | "inappropriate" | "safeguarding";

export const FLAG_LABELS: Record<FlagCategory, string> = {
  safeguarding: "Safeguarding concern",
  inappropriate: "Inappropriate content",
  unkind: "Unkind",
  off_task: "Off-task",
};

// Language that may mean a student is at risk. Kept broad on purpose: a false
// alarm costs a teacher a quiet check-in; a miss costs much more.
const SAFEGUARDING = new RegExp(
  [
    String.raw`\b(kill|hurt|harm|cut|starve)(ing)?\s+my\s?self\b`,
    String.raw`\bself[\s-]?harm`,
    String.raw`\bsuicid`,
    String.raw`\b(want|wanna|going)\s+to\s+die\b`,
    String.raw`\bend\s+(it\s+all|my\s+life)\b`,
    String.raw`\bno\s+(reason|point)\s+(to|in)\s+(live|living)\b`,
    String.raw`\b(nobody|no\s?one)\s+would\s+(care|miss\s+me)\b`,
    String.raw`\b(abus(e|ed|ing)\s+me|hits?\s+me\b|beats?\s+me\b|touch(es|ed)?\s+me\b)`,
    String.raw`\b(not|don'?t\s+feel)\s+safe\s+at\s+home\b`,
    String.raw`\bscared\s+to\s+go\s+home\b`,
  ].join("|"),
  "i",
);
const INAPPROPRIATE = /\b(porn\w*|nudes?|sex(y|ual)?|f+u+c+k\w*|sh[i1]t\w*|b[i1]tch\w*|c[u*]nt|dick|wank\w*|weed|vape|drugs?|cocaine|kill you|stab you|shoot (you|up))\b/i;
const UNKIND = /\b(stupid|idiot|dumb|shut up|loser|ugly|hate you|freak|moron|retard|stfu|kys)\b/i;
const OFF_TASK = /\b(fortnite|roblox|minecraft|tiktok|youtube|instagram|snap(chat)?|lunch break plans|who wants to play)\b/i;
const MASH = /^(.)\1{5,}$|^([a-z]{1,3})\2{3,}$/i;

export function safeguardingConcern(text: string): boolean {
  return SAFEGUARDING.test(text);
}

/** The first rule a message breaks, most serious first (null = fine). */
export function ruleCheck(text: string): FlagCategory | null {
  const t = text.trim();
  if (!t) return null;
  if (safeguardingConcern(t)) return "safeguarding";
  if (INAPPROPRIATE.test(t)) return "inappropriate";
  if (UNKIND.test(t)) return "unkind";
  if (MASH.test(t.replace(/\s/g, "")) || OFF_TASK.test(t)) return "off_task";
  return null;
}

/** What the student sees when the chat holds their message back. */
export const CHAT_NOTES: Record<FlagCategory, string> = {
  safeguarding: "It sounds like something might be wrong. Your teacher has been told so they can check in with you. You can also press “Need help” or talk to a trusted adult.",
  inappropriate: "That isn't OK to share in class. Keep the chat for your group's work.",
  unkind: "That could hurt someone — try saying it in a kinder way.",
  off_task: "That doesn't look like it's about the task — keep the chat for your group's work.",
};

/** Pip's reply when a question isn't something Pip will help with. */
export const PIP_REDIRECTS: Record<FlagCategory, string> = {
  safeguarding: "I'm really glad you said something. I'm not the right helper for this, but a person can help: your teacher has been told so they can check in with you. You can also press “Need help” or talk to a trusted adult. If you are in danger right now, tell an adult straight away.",
  inappropriate: "I can't help with that. I'm here to help with today's task — what part of the task can I help you with?",
  unkind: "I can't help with that. If something is going wrong in your group, you can press “Need help” to tell your teacher. What part of the task can I help with?",
  off_task: "That's not something I can help with — I only help with today's task. Want me to explain the task simply, or break it into steps?",
};
