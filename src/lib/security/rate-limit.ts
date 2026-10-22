import "server-only";
import { asServer } from "@/lib/db";

export class RateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Too many requests. Please wait a moment and try again.");
    this.name = "RateLimitError";
  }
}

/**
 * Fixed-window rate limit stored in Postgres so it holds across server
 * instances. Used for sign-in, join attempts, AI calls and help requests.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const row = await asServer((db) =>
    db.one<{ count: number; window_start: Date }>(
      `insert into rate_limits(key, window_start, count) values ($1, now(), 1)
       on conflict (key) do update set
         count = case when rate_limits.window_start < now() - make_interval(secs => $2) then 1 else rate_limits.count + 1 end,
         window_start = case when rate_limits.window_start < now() - make_interval(secs => $2) then now() else rate_limits.window_start end
       returning count, window_start`,
      [key, windowSeconds],
    ),
  );
  if (row.count > limit) {
    const elapsed = (Date.now() - new Date(row.window_start).getTime()) / 1000;
    throw new RateLimitError(Math.max(1, Math.ceil(windowSeconds - elapsed)));
  }
}
