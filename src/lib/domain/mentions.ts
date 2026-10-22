/** "@Nova …", "Nova, …", "hey nova …" — the student is talking to the group helper. */
export function mentionsHelper(text: string) {
  return /(^|\s)@(nova|bloom)\b/i.test(text) || /^\s*((hey|hi|hello|ok|okay)\s+)?nova\b[\s,:!?.]/i.test(text + " ");
}
