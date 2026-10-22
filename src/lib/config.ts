import "server-only";

/**
 * Central runtime configuration. Everything environment-specific is read here
 * so the rest of the code never touches process.env directly.
 */
function read(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value !== undefined && value !== "") return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable ${name}`);
}

export type AuthBackend = "local" | "supabase";
export type AiMode = "live" | "simulated";

export const config = {
  get databaseUrl() {
    return read("DATABASE_URL", "postgres://postgres:bloom-local-dev@127.0.0.1:5432/bloom");
  },
  get authBackend(): AuthBackend {
    return read("BLOOM_AUTH_BACKEND", "local") === "supabase" ? "supabase" : "local";
  },
  get sessionSecret() {
    const secret = read("SESSION_SECRET", process.env.NODE_ENV === "production" ? undefined : "dev-only-insecure-session-secret-change-me");
    if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
    return secret;
  },
  get supabaseUrl() {
    return read("NEXT_PUBLIC_SUPABASE_URL", "");
  },
  get supabaseAnonKey() {
    return read("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  },
  get supabaseServiceRoleKey() {
    return read("SUPABASE_SERVICE_ROLE_KEY", "");
  },
  get storageBackend(): "local" | "supabase" {
    return read("BLOOM_STORAGE_BACKEND", "local") === "supabase" ? "supabase" : "local";
  },
  get localUploadDir() {
    return read("BLOOM_UPLOAD_DIR", ".data/uploads");
  },
  /** AI runs live only when a key is configured and simulation is not forced. */
  get aiMode(): AiMode {
    if (read("BLOOM_AI_MODE", "auto") === "simulated") return "simulated";
    return process.env.ANTHROPIC_API_KEY ? "live" : "simulated";
  },
  get anthropicApiKey() {
    return read("ANTHROPIC_API_KEY", "");
  },
  /** Model names are configuration, never hard-coded defaults in workflows. */
  get aiModels() {
    const base = read("BLOOM_AI_MODEL", "claude-sonnet-5-5");
    return {
      facilitator: read("BLOOM_AI_MODEL_FACILITATOR", base),
      tutor: read("BLOOM_AI_MODEL_TUTOR", base),
      synthesis: read("BLOOM_AI_MODEL_SYNTHESIS", base),
      lesson: read("BLOOM_AI_MODEL_LESSON", base),
      report: read("BLOOM_AI_MODEL_REPORT", base),
    };
  },
  get aiTimeoutMs() {
    return Number(read("BLOOM_AI_TIMEOUT_MS", "20000"));
  },
  get demoMode() {
    return read("BLOOM_DEMO_MODE", "true") === "true";
  },
  get joinCodeTtlMinutes() {
    return Number(read("BLOOM_JOIN_CODE_TTL_MINUTES", "120"));
  },
};
