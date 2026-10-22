import { test, expect, type Page } from "@playwright/test";
import { joinSession, ready, signInAs, STUDENT_PASSWORD, TEACHER } from "./helpers";

/**
 * Scenario C (School Improvement Challenge): anonymous ideas, voting, shared
 * whiteboard and slides, and a slide presentation — on iPad-landscape sized
 * student screens. Set SCREENSHOT_DIR to save a visual tour.
 */
const shot = async (page: Page, name: string) => {
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/${name}.png`, fullPage: false });
};

test("school improvement: vote, whiteboard, slides, present", async ({ browser }) => {
  const teacher = await signInAs(browser, TEACHER.username, TEACHER.password);
  const t = teacher.page;
  await t.goto("/teacher/lessons");
  await t.getByRole("heading", { name: "School Improvement Challenge", exact: true }).click();
  await shot(t, "t-lesson-builder");
  await t.getByRole("button", { name: "Launch lesson" }).click();
  await t.waitForURL(/\/teacher\/sessions\//);
  const code = (await t.getByTestId("join-code").textContent())!.trim();
  const displayHref = await t.getByRole("link", { name: /Open classroom display/ }).getAttribute("href");
  const displayCtx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const display = await displayCtx.newPage();
  await display.goto(displayHref!);

  const names = ["maya.n", "noah.g", "priya.d"];
  const s = [];
  for (const n of names) {
    const a = await signInAs(browser, n, STUDENT_PASSWORD);
    // iPad landscape by default; STUDENT_VIEWPORT=1440x900 for a laptop-sized tour.
    const [vw, vh] = (process.env.STUDENT_VIEWPORT ?? "1180x820").split("x").map(Number);
    await a.page.setViewportSize({ width: vw, height: vh });
    await joinSession(a, code);
    s.push(a);
  }
  await shot(s[0].page, "s-waiting-room");
  await shot(t, "t-lobby");
  await shot(display, "d-lobby");
  await t.getByRole("button", { name: "Suggest groups" }).click();
  await expect(t.getByRole("region", { name: "Group 1" })).toBeVisible();
  await shot(t, "t-group-suggestions");
  await t.getByRole("button", { name: "Approve groups" }).click();
  await expect(s[0].page.getByText(/You're in group/)).toBeVisible();
  await shot(s[0].page, "s-group-reveal");
  await t.getByRole("button", { name: "Start lesson" }).click();

  // Brainstorm (anonymous in this lesson).
  const ideas = ["Quiet room at lunch for people who find the canteen loud", "Ramps and wider doors in the old block", "More plants and a quiet garden area"];
  for (const [i, a] of s.entries()) {
    await expect(a.page.getByRole("heading", { name: "Individual thinking", exact: true })).toBeVisible();
    await a.page.getByLabel("Your idea").fill(ideas[i]);
    await a.page.getByRole("button", { name: "Add idea" }).click();
  }
  await shot(s[0].page, "s-brainstorm");
  for (const a of s) await ready(a.page, "I'm done thinking");

  await expect(s[0].page.getByRole("heading", { name: "Cluster ideas", exact: true })).toBeVisible();
  await expect(s[0].page.getByText("Ramps and wider doors in the old block")).toBeVisible();
  // Anonymity: other people's ideas show no names.
  await expect(s[0].page.getByText("— A groupmate").first()).toBeVisible();
  await expect(s[0].page.getByText("— Noah G")).toHaveCount(0);
  await shot(s[0].page, "s-synthesis");
  for (const a of s) await ready(a.page);

  await expect(s[0].page.getByRole("heading", { name: "Discuss", exact: true })).toBeVisible();
  await s[1].page.getByLabel("Message your group").fill("I think the quiet room helps the most people.");
  await s[1].page.getByRole("button", { name: "Send message" }).click();
  await s[0].page.getByRole("button", { name: "Ask Nova" }).click();
  await s[0].page.getByRole("menuitem", { name: "Give us a discussion question" }).click();
  await expect(s[2].page.getByText("Simulated AI").first()).toBeVisible();
  await shot(s[2].page, "s-discussion");
  for (const a of s) await ready(a.page);

  // Voting.
  await expect(s[0].page.getByRole("heading", { name: "Vote", exact: true })).toBeVisible();
  for (const a of s) {
    const row = a.page.getByRole("listitem").filter({ hasText: "Quiet room at lunch" });
    await row.getByRole("button", { name: "Vote" }).click();
    await expect(row.getByRole("button", { name: "Voted" })).toBeVisible();
  }
  await expect(s[0].page.getByLabel("3 votes")).toBeVisible();
  await shot(s[0].page, "s-voting");
  for (const a of s) await ready(a.page);

  // Whiteboard: add a sticky note, visible to a groupmate without refreshing.
  await expect(s[0].page.getByRole("heading", { name: "Whiteboard & slides", exact: true })).toBeVisible();
  const board = s[0].page.getByRole("application", { name: /Group whiteboard/ });
  await s[0].page.getByRole("button", { name: "Sticky note" }).click();
  await board.click({ position: { x: 300, y: 200 } });
  await s[0].page.getByLabel("Edit text", { exact: true }).fill("Quiet room in G12");
  await s[0].page.getByLabel("Edit text", { exact: true }).press("Escape");
  await expect(s[1].page.getByRole("button", { name: "Sticky note: Quiet room in G12" })).toBeVisible();
  await s[1].page.getByRole("button", { name: "Text", exact: true }).click();
  await s[1].page.getByRole("application", { name: /Group whiteboard/ }).click({ position: { x: 500, y: 350 } });
  await s[1].page.getByLabel("Edit text", { exact: true }).fill("Ask the council for £200");
  await s[1].page.getByLabel("Edit text", { exact: true }).press("Escape");
  await expect(s[0].page.getByRole("button", { name: "Text: Ask the council for £200" })).toBeVisible();
  await shot(s[0].page, "s-whiteboard");
  // Earlier ideas are one tap away while working, ready to add to the board.
  await s[0].page.getByRole("tab", { name: /^Ideas/ }).click();
  await expect(s[0].page.getByRole("button", { name: /^Add to whiteboard: Ramps/ })).toBeVisible();
  await s[0].page.waitForTimeout(400); // let the panel finish sliding in
  await shot(s[0].page, "s-ideas-panel");
  await s[0].page.getByRole("button", { name: /^Add to whiteboard: Ramps/ }).click();
  await expect(s[1].page.getByRole("button", { name: "Sticky note: Ramps and wider doors in the old block" })).toBeVisible();
  await s[0].page.getByRole("tab", { name: "Activity", exact: true }).click();

  // Slides.
  await s[2].page.getByRole("tab", { name: "Slides" }).click();
  await s[2].page.getByRole("button", { name: "Title", exact: true }).click();
  await s[2].page.getByRole("button", { name: "Text: Title" }).dblclick();
  await s[2].page.getByLabel("Edit text", { exact: true }).fill("A quiet room for everyone");
  await s[2].page.getByLabel("Edit text", { exact: true }).press("Escape");
  await s[0].page.getByRole("tab", { name: "Slides" }).click();
  await expect(s[0].page.getByRole("button", { name: "Text: A quiet room for everyone" })).toBeVisible();
  await shot(s[0].page, "s-slides");
  for (const a of s) await ready(a.page);

  await expect(s[0].page.getByRole("heading", { name: "Submission", exact: true })).toBeVisible();
  await s[0].page.getByRole("button", { name: "Submit for my group" }).click();
  await expect(s[1].page.getByText(/Version 1 submitted/)).toBeVisible();
  await shot(s[1].page, "s-submitted");

  // Present the slides; slide control can be handed to a student.
  await t.getByLabel("Present a group's submitted work").selectOption({ index: 1 });
  await t.getByRole("button", { name: "Present", exact: true }).click();
  await expect(display.getByText("A quiet room for everyone", { exact: true })).toBeVisible();
  await shot(display, "d-presentation");
  await t.getByLabel("Slide control").selectOption({ label: "Priya D" });
  await expect(s[2].page.getByText("Your teacher gave you control of the slides.")).toBeVisible();
  await shot(t, "t-dashboard");
  await t.getByRole("button", { name: "Stop presenting" }).click();
  await expect(display.getByText("Cluster ideas").or(display.getByText("Submission")).first()).toBeVisible();
  await shot(display, "d-overview");

  for (const a of [teacher, ...s]) await a.context.close();
  await displayCtx.close();
});
