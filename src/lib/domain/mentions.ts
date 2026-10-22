/** "@Bloom …", "Bloom, …", "hey bloom …" — the student is talking to the group helper (its old name, Nova, still works). */
export function mentionsHelper(text: string) {
  return /(^|\s)@(bloom|nova)\b/i.test(text) || /^\s*((hey|hi|hello|ok|okay)\s+)?(bloom|nova)\b[\s,:!?.]/i.test(text + " ");
}
