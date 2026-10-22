import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { config } from "@/lib/config";

/**
 * Signed, httpOnly session cookie used by the local auth backend.
 * Format: base64url(JSON payload) "." base64url(HMAC-SHA256).
 */
const COOKIE = "bloom_session";
const MAX_AGE_SECONDS = 60 * 60 * 12; // a school day

type Payload = { uid: string; exp: number };

function sign(data: string) {
  return createHmac("sha256", config.sessionSecret).update(data).digest("base64url");
}

export function encodeSession(uid: string, now = Date.now()): string {
  const payload: Payload = { uid, exp: Math.floor(now / 1000) + MAX_AGE_SECONDS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (typeof payload.uid !== "string" || payload.exp * 1000 < now) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

export async function setSessionCookie(uid: string) {
  (await cookies()).set(COOKIE, encodeSession(uid), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}

export async function readSessionUserId(): Promise<string | null> {
  return decodeSession((await cookies()).get(COOKIE)?.value);
}
