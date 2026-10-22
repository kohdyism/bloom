import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { joinSession, ready, signInAs, STUDENT_PASSWORD, TEACHER } from "./helpers";

/**
 * Scenario B (Paper Aeroplane Challenge): roles, a physical stage with
 * check-ins (no listening), photo evidence, submission with results, and
 * teacher interventions (extend, pause, AI take-over).
 */
// 1×1 PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("paper aeroplane: check-ins, photo evidence, teacher interventions", async ({ browser }, info) => {
  const dir = info.outputPath("files");
  mkdirSync(dir, { recursive: true });
  const photo = path.join(dir, "plane.png");
  writeFileSync(photo, PNG);

  const teacher = await signInAs(browser, TEACHER.username, TEACHER.password);
  const t = teacher.page;
  await t.goto("/teacher/lessons");
  await t.getByRole("heading", { name: "Paper Aeroplane Challenge", exact: true }).click();
  await t.getByRole("tab", { name: "Settings" }).click();
  await t.getByLabel("Smallest group").fill("2");
  await t.getByLabel("Largest group").fill("2");
  await t.getByRole("button", { name: "Save", exact: true }).click();
  await expect(t.getByText("Saved", { exact: true })).toBeVisible();
  await t.getByRole("button", { name: "Launch lesson" }).click();
  await t.waitForURL(/\/teacher\/sessions\//);
  const code = (await t.getByTestId("join-code").textContent())!.trim();

  const a = await signInAs(browser, "jonah.b", STUDENT_PASSWORD);
  const b = await signInAs(browser, "kiara.s", STUDENT_PASSWORD);
  for (const s of [a, b]) await joinSession(s, code);
  await t.getByRole("button", { name: "Suggest groups" }).click();
  await t.getByRole("button", { name: "Approve groups" }).click();
  await t.getByRole("button", { name: "Start lesson" }).click();

  // Orientation → roles → planning.
  await expect(a.page.getByRole("heading", { name: "Orientation", exact: true })).toBeVisible();
  for (const s of [a, b]) await ready(s.page);
  await a.page.getByRole("button", { name: /^Materials coordinator/ }).click();
  await b.page.getByRole("button", { name: /^Timekeeper/ }).click();
  await expect(a.page.getByText("Kiara S", { exact: true }).first()).toBeVisible();
  for (const s of [a, b]) await ready(s.page);
  await expect(a.page.getByRole("heading", { name: "Planning", exact: true })).toBeVisible();

  // Teacher interventions: extend time and take over facilitation.
  await t.getByRole("button", { name: "+2 min" }).first().click();
  await expect(a.page.getByText("Your teacher added 2 more minutes to this stage.")).toBeVisible();
  await t.getByRole("button", { name: "Open" }).first().click();
  await t.getByRole("button", { name: /Take over \(pause AI prompts\)/ }).click();
  await expect(a.page.getByText("Your teacher is facilitating directly")).toBeVisible();
  await t.keyboard.press("Escape");

  // Class pause is synchronised to every student.
  await t.getByRole("button", { name: "Pause class" }).click();
  await expect(a.page.getByRole("alertdialog", { name: "Paused" })).toBeVisible();
  await expect(b.page.getByRole("alertdialog", { name: "Paused" })).toBeVisible();
  await t.getByRole("button", { name: "Resume class" }).click();
  await expect(a.page.getByRole("alertdialog", { name: "Paused" })).toHaveCount(0);

  for (const s of [a, b]) await ready(s.page);
  await expect(a.page.getByRole("heading", { name: "Build and test", exact: true })).toBeVisible();
  await expect(a.page.getByText("Bloom doesn't listen to your group")).toBeVisible();

  // Check-ins sync between devices.
  for (const label of ["Design agreed", "First plane built", "Test 1 recorded", "Test 2 recorded", "Test 3 recorded"]) {
    await a.page.getByLabel(label).check();
    await expect(b.page.getByLabel(label)).toBeChecked();
  }
  await a.page.getByLabel("Take or choose a photo").setInputFiles(photo);
  await a.page.getByLabel(/^Caption/).fill("Test 2: 4.2 metres");
  await a.page.getByRole("button", { name: "Upload" }).click();
  await expect(b.page.getByRole("img", { name: "Test 2: 4.2 metres" })).toBeVisible();
  for (const s of [a, b]) await ready(s.page);

  // Evidence capture: submit with a results note.
  await expect(a.page.getByRole("heading", { name: "Evidence capture", exact: true })).toBeVisible();
  await b.page.getByLabel(/^Note or results/).fill("3.1 m, 4.2 m, 3.8 m");
  await b.page.getByRole("button", { name: "Submit for my group" }).click();
  await expect(a.page.getByText(/Version 1 submitted by Kiara S/)).toBeVisible();
  await expect(a.page.getByText("includes media")).toBeVisible();

  // Teacher reviews and returns for revision; the group sees the feedback.
  await t.getByRole("button", { name: "Open" }).first().click();
  await t.getByRole("button", { name: "Review" }).click();
  await expect(t.getByRole("img", { name: "Test 2: 4.2 metres" })).toBeVisible();
  await t.getByLabel("Feedback for the group").fill("Great testing! Add which design change helped most.");
  await t.getByRole("button", { name: "Return for revision" }).click();
  await expect(a.page.getByText("Your teacher returned your work for revision")).toBeVisible();
  await expect(a.page.getByText("Add which design change helped most.")).toBeVisible();

  for (const s of [teacher, a, b]) await s.context.close();
});
