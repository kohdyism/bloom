import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://postgres:bloom-local-dev@127.0.0.1:5432/bloom_test",
      BLOOM_AUTH_BACKEND: "local",
      BLOOM_AI_MODE: "simulated",
      SESSION_SECRET: "unit-test-session-secret-0123456789abcdef",
    },
  },
});
