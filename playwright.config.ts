import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres:bloom-local-dev@127.0.0.1:5432/bloom_e2e";

/**
 * End-to-end tests run against their own database (reset in global setup)
 * and their own server, in simulated-AI mode so results are deterministic.
 * Set PLAYWRIGHT_CHROMIUM_PATH to use a preinstalled Chromium.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 10 * 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1280, height: 860 },
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ["--disable-background-networking", "--disable-component-update", "--no-first-run", "--disable-dev-shm-usage"] }
      : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } } }],
  webServer: {
    command: process.env.E2E_SERVER_COMMAND ?? `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/sign-in`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      DATABASE_URL,
      BLOOM_AUTH_BACKEND: "local",
      BLOOM_AI_MODE: "simulated",
      BLOOM_DEMO_MODE: "true",
      SESSION_SECRET: "e2e-session-secret-0123456789abcdefghij",
      BLOOM_UPLOAD_DIR: ".data/e2e-uploads",
    },
  },
});
