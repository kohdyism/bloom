import { test, expect } from "@playwright/test";
import * as Y from "yjs";
import { apiAs, joinSession, ready, signInAs, STUDENT_PASSWORD, TEACHER, type Actor } from "./helpers";

/**
 * The full acceptance scenario from the brief (§33), with a teacher and four
 * students in genuinely separate authenticated browser contexts, plus the
 * public display. Steps are numbered to match the brief.
 */
test("complete inclusive classroom lesson", async ({ browser }) => {
  // 1–2. Teacher signs in and opens the Literature class's lesson.
  const teacher = await signInAs(browser, TEACHER.username, TEACHER.password);
  const t = teacher.page;
  await t.goto("/teacher/classes");
  await t.getByRole("link", { name: /Year 8 Literature — Class 1/ }).click();
  await expect(t.getByRole("heading", { name: "Year 8 Literature — Class 1", exact: true })).toBeVisible();

  // 3–4. Open the lesson; configure stages (add role selection), timings and group sizes.
  await t.goto("/teacher/lessons");
  await t.getByRole("heading", { name: "Reading 'Alone' together", exact: true }).click();
  await expect(t.getByLabel("Lesson title")).toHaveValue("Reading 'Alone' together");
  await t.getByRole("button", { name: "Add stage" }).click();
  await t.getByRole("dialog").getByRole("button", { name: /^Role selection/ }).click();
  await t.getByRole("button", { name: "Move Role selection up" }).click();
  await t.getByLabel("Duration (minutes)").fill("4");
  await t.getByRole("tab", { name: "Settings" }).click();
  await t.getByLabel("Smallest group").fill("2");
  await t.getByLabel("Largest group").fill("2");
  await t.getByRole("button", { name: "Save", exact: true }).click();
  await expect(t.getByText("Saved", { exact: true })).toBeVisible();
  await t.getByRole("button", { name: "Launch lesson" }).click();
  await t.waitForURL(/\/teacher\/sessions\//);
  const sessionId = t.url().split("/").pop()!;
  const code = (await t.getByTestId("join-code").textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  // Public display (no sign-in needed; token-scoped).
  const displayHref = await t.getByRole("link", { name: /Open classroom display/ }).getAttribute("href");
  const displayCtx = await browser.newContext();
  const display = await displayCtx.newPage();
  await display.goto(displayHref!);
  await expect(display.getByTestId("display-join-code")).toHaveText(code);

  // 5–6. Students join from separate contexts; the teacher sees them live.
  // chloe.m and felix.t have a fictional "keep apart" rule in the seed data.
  const usernames = ["ben.o", "chloe.m", "felix.t", "dev.p"];
  const students: Actor[] = [];
  for (const u of usernames) {
    const s = await signInAs(browser, u, STUDENT_PASSWORD);
    await joinSession(s, code);
    await expect(s.page.getByRole("heading", { name: "You're in!", exact: true })).toBeVisible();
    students.push(s);
  }
  await expect(t.getByText("4 of 20")).toBeVisible();
  await expect(display.getByText("4 joined")).toBeVisible();

  // 7–8. Recommendations generated; teacher approves.
  await t.getByRole("button", { name: "Suggest groups" }).click();
  await expect(t.getByRole("region", { name: "Group 2" })).toBeVisible();
  await t.getByRole("button", { name: "Approve groups" }).click();
  await expect(t.getByText("Groups approved — students can see their group")).toBeVisible();

  // Hard constraint respected: chloe.m and felix.t are never in the same group.
  const groupOf = async (a: Actor) => (await apiAs(a, "GET", `/api/live/student/${sessionId}/state`)).json.group?.id as string;
  const gids = await Promise.all(students.map(groupOf));
  expect(gids[1]).not.toEqual(gids[2]);

  // 9. Students see their assigned group.
  for (const s of students) await expect(s.page.getByText(/You're in group/)).toBeVisible();
  const a1 = students[0];
  const a2 = students[gids.findIndex((g, i) => i > 0 && g === gids[0])];
  const others = students.filter((s) => s !== a1 && s !== a2);
  const groupA = gids[0];

  // 11. Teacher starts the session (groups could not begin before this).
  const early = await apiAs(a1, "POST", "/api/live/student", { action: "readiness", sessionId, state: "ready" });
  expect(early.status).toBe(409);
  await t.getByRole("button", { name: "Start lesson" }).click();
  await expect(t.getByRole("heading", { name: "Groups", exact: true })).toBeVisible();

  // 10. Students choose roles (multiple allowed), then confirm readiness.
  await a1.page.getByRole("button", { name: /^Facilitator/ }).click();
  await a1.page.getByRole("button", { name: /^Note-taker/ }).click();
  await a2.page.getByRole("button", { name: /^Presenter/ }).click();
  await expect(a2.page.getByText("You", { exact: true }).first()).toBeVisible();
  await ready(a1.page);
  await ready(a2.page);

  // 12. Private individual ideas.
  await expect(a1.page.getByRole("heading", { name: "Think", exact: true })).toBeVisible();
  await a1.page.getByLabel("Your idea").fill("The speaker feels lonely because he sees the world differently from others.");
  await a1.page.getByRole("button", { name: "Add idea" }).click();
  // Saved ideas appear in the Ideas tab, marked private.
  await a1.page.getByRole("button", { name: /See my ideas/ }).click();
  await expect(a1.page.getByText("Added — private until thinking time ends")).toBeVisible();
  await a1.page.getByRole("tab", { name: "Activity", exact: true }).click();
  await a2.page.getByLabel("Your idea").fill("Lonely childhood: nature and the storm reflect his feelings.");
  await a2.page.getByRole("button", { name: "Add idea" }).click();
  await a2.page.getByRole("button", { name: /See my ideas/ }).click();
  await expect(a2.page.getByText("Added — private until thinking time ends")).toBeVisible();
  await a2.page.getByRole("tab", { name: "Activity", exact: true }).click();
  // Ideas are private: a2 cannot see a1's idea yet.
  await expect(a2.page.getByText("sees the world differently")).toHaveCount(0);
  await ready(a1.page, "I'm done thinking");
  await ready(a2.page, "I'm done thinking");

  // 13. AI synthesis grounded in the submitted ideas, labelled as AI.
  await expect(a1.page.getByRole("heading", { name: "AI idea synthesis", exact: true })).toBeVisible();
  await expect(a1.page.getByText("Simulated AI").first()).toBeVisible();
  await expect(a1.page.getByText("Lonely childhood: nature and the storm reflect his feelings.")).toBeVisible();
  await expect(a2.page.getByText("sees the world differently from others")).toBeVisible();
  await ready(a1.page);
  await ready(a2.page);

  // Talk time: the screen steps back so the group talks face to face.
  await expect(a1.page.getByRole("heading", { name: "Discussion time!" })).toBeVisible();
  await expect(a1.page.getByLabel("Message your group")).toHaveCount(0);
  await ready(a1.page, "We're done talking");
  await ready(a2.page, "We're done talking");

  // 14. Discussion: message, reply, reaction, build on an idea.
  await expect(a1.page.getByRole("heading", { name: "Discussion", exact: true })).toBeVisible();
  await a1.page.getByLabel("Message your group").fill("I think the storm line is the strongest evidence.");
  await a1.page.getByRole("button", { name: "Send message" }).click();
  await expect(a2.page.getByText("I think the storm line is the strongest evidence.")).toBeVisible();
  await a2.page.getByRole("button", { name: "Agree", exact: true }).first().click();
  await expect(a1.page.getByRole("button", { name: "Agree (1)" })).toBeVisible();
  // In discussion, the group's ideas are the activity beside the chat.
  await a2.page.getByRole("button", { name: /^Build on idea/ }).first().click();
  await a2.page.getByLabel("Build on that idea").fill("Yes — and 'all I lov'd — I lov'd alone' shows it clearly.");
  await a2.page.getByRole("button", { name: "Add to idea bank" }).click();
  await expect(a1.page.getByText("shows it clearly").first()).toBeVisible();

  // 15. Private AI assistance (student-only).
  await a1.page.getByRole("button", { name: "Ask Pip (private)" }).click();
  await a1.page.getByRole("button", { name: "Explain simply" }).click();
  await expect(a1.page.getByRole("log", { name: "Conversation with Pip" }).getByText("Simulated AI")).toBeVisible();
  await a1.page.keyboard.press("Escape");

  // 16–17. Another student requests teacher help; the teacher receives it immediately.
  await a2.page.getByRole("button", { name: "Need help" }).click();
  await a2.page.getByLabel("I don't understand the task").check();
  await a2.page.getByLabel("Add a message (optional)").fill("Which line should we focus on?");
  await a2.page.getByRole("button", { name: "Send to my teacher" }).click();
  await expect(a2.page.getByText("Sent to your teacher")).toBeVisible();
  await a2.page.keyboard.press("Escape");
  await expect(t.getByText("Which line should we focus on?")).toBeVisible();
  // Never disclosed to other students.
  await expect(a1.page.getByText("Which line should we focus on?")).toHaveCount(0);
  await t.getByRole("button", { name: "Mark seen" }).click();

  // 18. Group advances after meeting readiness conditions.
  await ready(a1.page);
  await ready(a2.page);
  await expect(a1.page.getByRole("heading", { name: "Collaborative writing", exact: true })).toBeVisible();

  // 19–20. Multiple students edit the shared document; edits are visible to both.
  const ed1 = a1.page.getByRole("textbox", { name: "Shared document" });
  const ed2 = a2.page.getByRole("textbox", { name: "Shared document" });
  await ed1.click();
  await a1.page.keyboard.type("Poe presents loneliness as lifelong. ", { delay: 15 });
  await expect(ed2).toContainText("Poe presents loneliness as lifelong.");
  await ed2.click();
  await a2.page.keyboard.press("Control+End");
  await a2.page.keyboard.type("Nature mirrors his isolation.", { delay: 15 });
  // Now both type at the same time in different places; nothing may be lost.
  await Promise.all([
    (async () => { await ed1.click(); await a1.page.keyboard.press("Control+Home"); await a1.page.keyboard.type("In 'Alone', ", { delay: 20 }); })(),
    (async () => { await a2.page.keyboard.press("Control+End"); await a2.page.keyboard.type(" The storm is key.", { delay: 20 }); })(),
  ]);
  for (const ed of [ed1, ed2]) {
    await expect(ed).toContainText("In 'Alone', Poe presents loneliness as lifelong.");
    await expect(ed).toContainText("Nature mirrors his isolation. The storm is key.");
  }
  await expect(ed1).toContainText("Nature mirrors his isolation.");
  await expect(ed2).toContainText("Poe presents loneliness as lifelong.");
  await expect(a1.page.getByText("All changes saved")).toBeVisible();
  await expect(a2.page.getByText("All changes saved")).toBeVisible();

  // 21. Student disconnects, reconnects and sees saved work.
  await a1.page.close();
  a1.page = await a1.context.newPage();
  await a1.page.goto(`/student/session/${sessionId}`);
  await expect(a1.page.getByRole("textbox", { name: "Shared document" })).toContainText("Nature mirrors his isolation.");

  // 22–23. One student submits; all group members see the status.
  await ready(a1.page);
  await ready(a2.page);
  await expect(a1.page.getByRole("heading", { name: "Submission", exact: true })).toBeVisible();
  await a1.page.getByRole("button", { name: "Submit for my group" }).click();
  await expect(a2.page.getByText(/Version 1 submitted by Ben O/)).toBeVisible();
  await expect(a2.page.getByRole("list", { name: "Submission status" }).getByText("Submitted")).toBeVisible();

  // 24–25. Teacher presents; other students (another group) view it read-only.
  await t.getByLabel("Present a group's submitted work").selectOption({ index: 0 });
  await t.getByRole("button", { name: "Present", exact: true }).click();
  await expect(display.getByText(/presents/)).toBeVisible();
  await expect(display.getByText("Poe presents loneliness as lifelong.")).toBeVisible();
  for (const o of others) {
    await expect(o.page.getByText(/is presenting/)).toBeVisible();
    await expect(o.page.getByText("Poe presents loneliness as lifelong.")).toBeVisible();
    await expect(o.page.getByText("You're viewing a read-only copy.")).toBeVisible();
  }

  // 30 (part). The public display never shows protected information.
  const displayText = await display.locator("body").innerText();
  for (const secret of ["Which line should we focus on?", "Extra thinking time", "Written instructions", "Fictional demo note", "Explain simply", "keep apart"]) {
    expect(displayText).not.toContain(secret);
  }

  // Security: a student in another group can't reach group A's workspace data.
  const outsider = others[0];
  const groupAState = await apiAs(a2, "GET", `/api/live/student/${sessionId}/state`);
  const docId = (groupAState.json.group.artifacts as { id: string; kind: string }[]).find((x) => x.kind === "document")!.id;
  expect((await apiAs(outsider, "GET", `/api/artifacts/${docId}`)).status).toBe(404);
  const hack = new Y.Doc();
  hack.getXmlFragment("content").insert(0, [new Y.XmlText("overwritten")]);
  const update = Buffer.from(Y.encodeStateAsUpdate(hack)).toString("base64");
  expect((await apiAs(outsider, "POST", `/api/artifacts/${docId}`, { update, clientUpdateId: "tamper-attempt-1" })).status).toBe(404);
  expect((await apiAs(outsider, "GET", `/api/live/teacher/${sessionId}/groups/${groupA}`)).status).toBe(403);
  expect((await apiAs(outsider, "GET", `/api/live/teacher/${sessionId}/state`)).status).toBe(403);
  const outsiderState = await apiAs(outsider, "GET", `/api/live/student/${sessionId}/state`);
  expect(outsiderState.json.group.id).not.toBe(groupA);
  expect(JSON.stringify(outsiderState.json)).not.toContain("Which line should we focus on?");
  expect(JSON.stringify(outsiderState.json)).not.toContain("strongest evidence");
  // Private assistant transcripts: the endpoint only ever returns the caller's own.
  const outsiderAi = await apiAs(outsider, "GET", `/api/live/student/${sessionId}/assistant`);
  expect(JSON.stringify(outsiderAi.json)).not.toContain("Explain simply");
  // A tampered realtime subscription to another group's channel is refused.
  const sse = await outsider.page.request.fetch(`/api/realtime?channels=group:${groupA}`, { failOnStatusCode: false, timeout: 10_000 });
  expect(sse.status()).toBe(403);

  // 26–27. Teacher ends the lesson; students complete reflections.
  await t.getByRole("button", { name: "Stop presenting" }).click();
  await t.getByRole("button", { name: "End lesson" }).click();
  await t.getByRole("dialog").getByRole("button", { name: "End lesson" }).click();
  for (const s of [a1, a2]) {
    await expect(s.page.getByText("The lesson has ended — how did it go?")).toBeVisible();
    // The group submitted its work, so its plant blooms into a flower for everyone's garden.
    await expect(s.page.getByText("Your group's plant bloomed!")).toBeVisible();
    await s.page.getByRole("button", { name: "Lovely!" }).click();
    for (const q of ["comfort", "opportunity", "listened", "clarity", "overall"]) {
      await s.page.locator(`label:has(input[name="${q}"][value="4"])`).click();
      await expect(s.page.locator(`input[name="${q}"][value="4"]`)).toBeChecked();
    }
    await s.page.getByLabel(/What helped you participate today/).fill(s === a1 ? "Having thinking time first and clear roles." : "Writing my idea before talking.");
    await s.page.getByRole("button", { name: "Send reflection" }).click();
    await expect(s.page.getByText("Thanks for reflecting!")).toBeVisible();
  }
  await expect(display.getByText("Great work today, everyone!")).toBeVisible();
  expect(await display.locator("body").innerText()).not.toContain("Having thinking time first");

  // 28–29. Teacher views the report and deliberately opens one reflection.
  await t.goto(`/teacher/reports/${sessionId}`);
  await expect(t.getByRole("heading", { name: "Reading 'Alone' together", exact: true })).toBeVisible();
  await expect(t.getByText("Simulated AI").first()).toBeVisible();
  await expect(t.getByText("Thinking time before discussing")).toBeVisible();
  await t.getByLabel("Student").selectOption({ label: "Ben O" });
  await t.getByRole("button", { name: "Open privately" }).click();
  await expect(t.getByRole("dialog").getByText("Having thinking time first and clear roles.")).toBeVisible();

  for (const a of [teacher, ...students]) await a.context.close();
  await displayCtx.close();
});
