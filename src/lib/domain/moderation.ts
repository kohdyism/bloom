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
const UNKIND = /\b(stupid|idiots?|dumb|shut up|losers?|ugly|hate you|freaks?|morons?|retards?|stfu|kys)\b/i;
const OFF_TASK = /\b(fortnite|roblox|minecraft|tiktok|youtube|instagram|snap(chat)?|lunch break plans|who wants to play)\b/i;
const MASH = /^(.)\1{5,}$|^([a-z]{1,3})\2{3,}$/i;

/** A teacher's banned word appears in the text (whole words, any case). */
export function bannedWordHit(text: string, words: readonly string[]): string | null {
  for (const raw of words) {
    const w = raw.trim();
    if (!w) continue;
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^\\p{L}\\p{N}])${esc}($|[^\\p{L}\\p{N}])`, "iu").test(text)) return w;
  }
  return null;
}

/** Clearly not an idea yet: keyboard mashing, a lone filler word, no real words. */
export function looksLikeNonsense(text: string): boolean {
  const t = text.trim().toLowerCase();
  const letters = t.replace(/[^\p{L}]/gu, "");
  if (letters.length < 2) return true;
  if (/^(idk|dunno|nothing|no idea|lol|lmao|ok|okay|yes|no|nah|meh|hi|hello|test|\?+|\.+)$/.test(t.replace(/[!.\s]+$/g, ""))) return true;
  if (MASH.test(letters)) return true;
  if (/(asdf|qwer|zxcv|hjkl|jkjk|sdfg|dfgh|fghj|ghjk|uiop|wert|xcvb)/.test(letters)) return true;
  // A long "word" with no vowels at all is almost always mashing.
  if (t.split(/\s+/).some((w) => w.replace(/[^\p{L}]/gu, "").length >= 6 && !/[aeiouy]/.test(w))) return true;
  return false;
}

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

/** What the student sees when their idea is held back. */
export const IDEA_NOTES: Record<FlagCategory | "nonsense" | "banned", string> = {
  safeguarding: CHAT_NOTES.safeguarding,
  inappropriate: "That idea can't be shared in class. Try another idea about the task.",
  unkind: "That could hurt someone. Try writing your idea in a kind way.",
  off_task: "That doesn't seem to be about the task. Have another look at the question and try again.",
  nonsense: "That doesn't look like an idea yet. Try writing one real idea — even a short one is great.",
  banned: "That uses a word your teacher has asked everyone not to use. Try saying it another way.",
};

/** Why a question to Pip wasn't sent (shown to the student, who can edit and try again). */
export const PIP_NOTES: Record<"off_task" | "unkind" | "inappropriate" | "nonsense" | "banned", string> = {
  off_task: "Not sent. Pip only helps with today's task — try asking something about the task.",
  nonsense: "Not sent. That doesn't look like a question yet — try asking Pip about the task.",
  unkind: "Not sent. That could hurt someone. If something is wrong in your group, press “Need help”.",
  inappropriate: "Not sent. That isn't OK to ask in class. Try a question about the task.",
  banned: "Not sent. That uses a word your teacher has asked everyone not to use.",
};
