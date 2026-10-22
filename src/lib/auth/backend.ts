import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { config } from "@/lib/config";
import { asServer } from "@/lib/db";
import { verifyPassword } from "./password";
import { clearSessionCookie, readSessionUserId, setSessionCookie } from "./session";

/**
 * Authentication backends.
 *
 *  - local    (default): credentials in the local_auth schema, signed cookie
 *             session. Used for development, demos and the test-suite.
 *  - supabase: Supabase Auth via @supabase/ssr. Students have teacher-managed
 *             accounts whose emails are synthetic (<username>@students.bloom.demo
 *             in the demo, or your school's convention).
 *             NOTE: implemented against the documented @supabase/ssr API but not
 *             exercised in this repository's automated tests (no Supabase
 *             project was available).
 */
export interface AuthBackend {
  signIn(username: string, password: string): Promise<string | null>;
  signOut(): Promise<void>;
  currentUserId(): Promise<string | null>;
}

const DUMMY_HASH = `scrypt$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(64).toString("base64")}`;

const localBackend: AuthBackend = {
  async signIn(username, password) {
    const row = await asServer((db) =>
      db.maybeOne<{ id: string; password_hash: string }>(
        `select p.id, c.password_hash from public.profiles p
         join local_auth.credentials c on c.user_id = p.id
         where p.username = $1`,
        [username.trim().toLowerCase()],
      ),
    );
    // Hash anyway on unknown users to keep timing uniform.
    const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !ok) return null;
    await setSessionCookie(row.id);
    return row.id;
  },
  async signOut() {
    await clearSessionCookie();
  },
  currentUserId: readSessionUserId,
};

async function supabaseServerClient() {
  const store = await cookies();
  return createServerClient(config.supabaseUrl, config.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component render; the proxy refreshes cookies.
        }
      },
    },
  });
}

const supabaseBackend: AuthBackend = {
  async signIn(username, password) {
    const profile = await asServer((db) =>
      db.maybeOne<{ id: string; email: string }>(
        "select p.id, u.email from public.profiles p join auth.users u on u.id = p.id where p.username = $1",
        [username.trim().toLowerCase()],
      ),
    );
    if (!profile) return null;
    const client = await supabaseServerClient();
    const { data, error } = await client.auth.signInWithPassword({ email: profile.email, password });
    if (error || !data.user) return null;
    return data.user.id;
  },
  async signOut() {
    const client = await supabaseServerClient();
    await client.auth.signOut();
  },
  async currentUserId() {
    const client = await supabaseServerClient();
    const { data } = await client.auth.getUser();
    return data.user?.id ?? null;
  },
};

export function authBackend(): AuthBackend {
  return config.authBackend === "supabase" ? supabaseBackend : localBackend;
}
