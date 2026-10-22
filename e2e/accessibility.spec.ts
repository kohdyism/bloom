import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { joinSession, signInAs, STUDENT_PASSWORD, TEACHER } from "./helpers";

/**
 * Automated WCAG 2.2 A/AA checks (axe-core) on the main screens, in normal
 * and high-contrast modes. Automated checks catch only part of accessibility;
 * they don't replace testing with disabled users and assistive technology.
 */
async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const summary = serious.map((v) => `${label}: ${v.id} (${v.impact}) — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(summary, summary.join("\n")).toEqual([]);
}

test("main screens have no serious automated accessibility violations", async ({ browser }) => {
  const anon = await browser.newPage();
  await anon.goto("/sign-in");
  await audit(anon, "sign-in");
  await anon.goto("/demo");
  await audit(anon, "demo guide");
  await anon.close();

  const teacher = await signInAs(browser, TEACHER.username, TEACHER.password);
  const t = teacher.page;
  for (const path of ["/teacher", "/teacher/classes", "/teacher/lessons", "/teacher/reports"]) {
    await t.goto(path);
    await audit(t, path);
  }
  await t.goto("/teacher/classes");
  await t.getByRole("link", { name: /Year 8 Literature — Class 1/ }).click();
  await audit(t, "class details");
  await t.getByRole("link", { name: "Ben O" }).click();
  await audit(t, "student support editor");
  await t.goto("/teacher/lessons");
  await t.getByRole("heading", { name: "Reading 'Alone' together" }).click();
  await audit(t, "lesson builder");
  await t.getByRole("button", { name: "Launch lesson" }).click();
  await t.waitForURL(/\/teacher\/sessions\//);
  await audit(t, "session lobby");
  const code = (await t.getByTestId("join-code").textContent())!.trim();
  const displayHref = await t.getByRole("link", { name: /Open classroom display/ }).getAttribute("href");

  const first = await signInAs(browser, "ava.k", STUDENT_PASSWORD);
  await expect(first.page).toHaveURL(/\/student\/welcome/);
  await audit(first.page, "first-time survey (intro)");
  await first.page.getByRole("button", { name: /Let's go/ }).click();
  await audit(first.page, "first-time survey (question)");

  const s = await signInAs(browser, "ben.o", STUDENT_PASSWORD);
  await audit(s.page, "student home");
  await joinSession(s, code);
  await audit(s.page, "student waiting room");
  await t.getByRole("button", { name: "Suggest groups" }).click();
  await t.getByRole("button", { name: "Approve groups" }).click();
  await t.getByRole("button", { name: "Start lesson" }).click();
  await expect(s.page.getByRole("heading", { name: "Think" })).toBeVisible();
  await audit(s.page, "student workspace (brainstorm)");
  await audit(t, "teacher live dashboard");

  // High-contrast and large-text modes.
  await s.page.getByRole("button", { name: "Accessibility and display settings" }).click();
  await s.page.getByLabel("High contrast").click();
  await s.page.getByLabel("Extra large").check({ force: true });
  await expect(s.page.locator("html")).toHaveAttribute("data-contrast", "high");
  await s.page.keyboard.press("Escape");
  await audit(s.page, "student workspace (high contrast, XL text)");
  // Preferences follow the student to another device.
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto("/sign-in");
  await p2.getByLabel("Username").fill("ben.o");
  await p2.getByLabel("Password").fill(STUDENT_PASSWORD);
  await p2.getByRole("button", { name: "Sign in" }).click();
  await p2.waitForURL(/\/student/);
  await expect(p2.locator("html")).toHaveAttribute("data-contrast", "high");
  await expect(p2.locator("html")).toHaveAttribute("data-text", "xl");

  const display = await browser.newPage();
  await display.goto(displayHref!);
  await audit(display, "classroom display");

  for (const c of [teacher.context, first.context, s.context, other]) await c.close();
});
