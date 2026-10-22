import { chromium, devices } from "playwright";
const BASE = process.env.BASE;
const OUT = "shots";
import { mkdirSync } from "node:fs";
const note = (...a) => { const t = a.join(" "); console.log(t); console.log("::notice::" + t.replace(/\n/g, " ")); };
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
async function actor(u, p, opts = {}) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") note(`[${u} console]`, m.text().slice(0, 300)); });
  page.on("pageerror", (e) => note(`[${u} pageerror]`, e.message.slice(0, 300)));
  await page.goto(BASE + "/sign-in");
  await page.getByLabel("Username").fill(u);
  await page.getByLabel("Password").fill(p);
  await Promise.all([page.waitForURL((x) => !x.pathname.startsWith("/sign-in")), page.getByRole("button", { name: "Sign in" }).click()]);
  return page;
}
const T = await actor("teacher.demo", "bloom-demo", { viewport: { width: 1280, height: 800 } });
const ben = await actor("ben.o", "bloom-student", { ...devices["iPhone 13"], defaultBrowserType: undefined });
const elena = await actor("elena.r", "bloom-student", { viewport: { width: 1280, height: 800 } });
await T.goto(BASE + "/teacher/lessons");
await T.getByRole("heading", { name: "Reading 'Alone' together", exact: true }).click();
await T.getByRole("button", { name: "Launch lesson" }).click();
await T.waitForURL(/\/teacher\/sessions\//);
const code = (await T.getByTestId("join-code").textContent()).trim();
for (const s of [ben, elena]) {
  await s.goto(BASE + "/student");
  await s.getByLabel("Lesson code").fill(code);
  await s.getByRole("button", { name: "Join" }).click();
  await s.waitForURL(/session/);
}
await T.getByRole("button", { name: "Suggest groups" }).click();
await T.getByRole("button", { name: "Approve groups" }).click();
await T.getByRole("button", { name: "Start lesson" }).click();
for (const s of [ben, elena]) {
  const skip = s.getByRole("button", { name: "Skip the tour" });
  await skip.waitFor({ timeout: 15000 }).then(() => skip.click()).catch(() => {});
}
async function shot(name) { await ben.screenshot({ path: `${OUT}/${name}-ben.png` }); await elena.screenshot({ path: `${OUT}/${name}-elena.png` }); }
async function stageName(p) { return (await p.getByText(/Stage \d+ of \d+/).first().innerText().catch(() => "?")) + " / " + (await p.getByText(/\d+ of \d+ ready/).first().innerText().catch(() => "-")); }
for (let step = 1; step <= 6; step++) {
  await ben.waitForTimeout(1500);
  note("step", step, "ben:", await stageName(ben), "elena:", await stageName(elena));
  await shot(`s${step}`);
  for (const s of [ben, elena]) {
    const actTab = s.getByRole("tab", { name: "Activity", exact: true });
    if (await actTab.isVisible().catch(() => false)) await actTab.click().catch(() => {});
    // Do what each stage needs.
    const idea = s.getByLabel("Your idea");
    if (await idea.isVisible().catch(() => false)) { await idea.fill("An idea about the poem " + step); await s.getByRole("button", { name: "Add idea" }).click(); await s.waitForTimeout(500); }
    const sub = s.getByRole("button", { name: "Submit for my group" });
    if (await sub.isVisible().catch(() => false)) { await sub.click(); await s.waitForTimeout(800); }
    const btn = s.getByRole("button", { name: /^(I'm ready|I'm done thinking)$/ });
    if (await btn.isVisible().catch(() => false)) { await btn.click(); note("  clicked ready", s === ben ? "ben" : "elena"); }
    else note("  NO visible ready button for", s === ben ? "ben" : "elena", "| any in DOM:", await btn.count());
    await s.waitForTimeout(600);
  }
  await ben.waitForTimeout(2500);
}
await T.reload();
await T.getByRole("button", { name: "End lesson" }).click().catch(() => {});
await T.getByRole("dialog").getByRole("button", { name: "End lesson" }).click().catch(() => {});
note("ended lesson");
await browser.close();
