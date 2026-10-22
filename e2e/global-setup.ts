import { execSync } from "node:child_process";

/** Fresh fictional dataset for every end-to-end run. */
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL ?? "postgres://postgres:bloom-local-dev@127.0.0.1:5432/bloom_e2e";
  execSync("npx tsx scripts/db.ts reset", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url, BLOOM_AUTH_BACKEND: "local" } });
}
