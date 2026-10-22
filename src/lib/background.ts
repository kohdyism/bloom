import "server-only";
import { after } from "next/server";

/**
 * Run slow follow-up work (AI calls, synthesis) after the response is sent.
 * Outside a Next.js request scope (scripts, tests) it runs immediately.
 * Errors are logged and never surface to the user who triggered the work.
 */
export function background(task: () => Promise<unknown>) {
  const safe = async () => {
    try {
      await task();
    } catch (err) {
      console.error("[bloom:background] task failed", err);
    }
  };
  try {
    after(safe);
  } catch {
    void safe();
  }
}
