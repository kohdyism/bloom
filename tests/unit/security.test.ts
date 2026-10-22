import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));

import { decodeSession, encodeSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { sniffMime } from "@/lib/storage";
import { CRDT_GUARD } from "./crdt-guard";

describe("session cookies", () => {
  const uid = "11111111-2222-3333-4444-555555555555";
  it("round-trips a valid token", () => {
    expect(decodeSession(encodeSession(uid))).toBe(uid);
  });
  it("rejects tampered and expired tokens", () => {
    const token = encodeSession(uid);
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "99999999-2222-3333-4444-555555555555", exp: 9999999999 })).toString("base64url");
    expect(decodeSession(`${forged}.${sig}`)).toBeNull();
    expect(decodeSession(`${body}.${sig.slice(0, -2)}xx`)).toBeNull();
    expect(decodeSession(encodeSession(uid, Date.now() - 13 * 3600 * 1000))).toBeNull();
  });
});

describe("passwords", () => {
  it("hashes with a salt and verifies", async () => {
    const a = await hashPassword("bloom-student");
    const b = await hashPassword("bloom-student");
    expect(a).not.toEqual(b);
    expect(await verifyPassword("bloom-student", a)).toBe(true);
    expect(await verifyPassword("wrong", a)).toBe(false);
  });
});

describe("uploads", () => {
  it("identifies real images by content, not by name", () => {
    expect(sniffMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe("image/png");
    expect(sniffMime(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
  });
});

describe("CRDT merge guarantee", () => {
  it("concurrent edits from two students both survive", () => {
    expect(CRDT_GUARD()).toEqual(expect.arrayContaining(["Poe presents loneliness.", "Nature mirrors it."]));
  });
});
