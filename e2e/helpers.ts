import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const TEACHER = { username: "teacher.demo", password: "bloom-demo" };
export const STUDENT_PASSWORD = "bloom-student";

export type Actor = { name: string; context: BrowserContext; page: Page };

/** Each actor gets a genuinely separate browser context (own cookies/session). */
export async function signInAs(browser: Browser, username: string, password: string, opts: { tour?: boolean } = {}): Promise<Actor> {
  const context = await browser.newContext();
  // The first-lesson tour is tested on its own; other tests start with it already seen.
  if (!opts.tour) await context.addInitScript(() => { try { window.localStorage.setItem("bloom.lessonTour.v1", "done"); } catch { /* no storage */ } });
  const page = await context.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 60_000 }), page.getByRole("button", { name: "Sign in" }).click()]);
  return { name: username, context, page };
}

export async function joinSession(actor: Actor, code: string) {
  const { page } = actor;
  await page.goto("/student");
  await page.getByLabel("Lesson code").fill(code);
  await page.getByRole("button", { name: "Join" }).click();
  await page.waitForURL(/\/student\/session\//, { timeout: 60_000 });
}

/** JSON request made with the actor's own session cookie. */
export async function apiAs(actor: Actor, method: "GET" | "POST", url: string, body?: unknown) {
  const res = await actor.page.request.fetch(url, { method, data: body, failOnStatusCode: false });
  return { status: res.status(), json: await res.json().catch(() => null) };
}

export async function ready(page: Page, label = "I'm ready") {
  const btn = page.getByRole("button", { name: label });
  await expect(btn).toBeVisible();
  await btn.click();
}

export const sessionIdFrom = (page: Page) => page.url().split("/").filter(Boolean).pop()!.split("?")[0];
