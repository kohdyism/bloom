import { getCurrentUser } from "@/lib/auth/current-user";
import { asServer, asUser } from "@/lib/db";
import { uuid } from "@/lib/api";
import { getObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Serve an uploaded image after an access check:
 *  - group members and the session teacher (via RLS), or
 *  - anyone in the session while that image is part of the submission being
 *    presented (or the classroom display, via its token).
 */
export async function GET(req: Request, ctx: { params: Promise<{ mediaId: string }> }) {
  const parsed = uuid.safeParse((await ctx.params).mediaId);
  if (!parsed.success) return new Response("Not found", { status: 404 });
  const mediaId = parsed.data;
  const displayToken = new URL(req.url).searchParams.get("display");

  let media: { storage_path: string; mime_type: string } | null = null;
  const user = await getCurrentUser();
  if (user) {
    media = await asUser(user.id, (db) => db.maybeOne<{ storage_path: string; mime_type: string }>("select storage_path, mime_type from media_uploads where id = $1", [mediaId]));
  }
  if (!media) {
    // Presentation access: the media must belong to the currently presented submission.
    media = await asServer(async (db) => {
      const row = await db.maybeOne<{ storage_path: string; mime_type: string; session_id: string; display_token: string }>(
        `select m.storage_path, m.mime_type, s.id as session_id, s.display_token
         from media_uploads m
         join activity_sessions s on s.presentation ->> 'groupId' = m.group_id::text
         join submissions sub on sub.id::text = s.presentation ->> 'submissionId'
         where m.id = $1 and sub.content -> 'media' @> jsonb_build_array(jsonb_build_object('id', $1::text))`,
        [mediaId],
      );
      if (!row) return null;
      if (displayToken && displayToken === row.display_token) return row;
      if (user) {
        const participant = await db.maybeOne("select 1 from session_participants where session_id = $1 and student_id = $2", [row.session_id, user.id]);
        if (participant) return row;
      }
      return null;
    });
  }
  if (!media) return new Response("Not found", { status: 404 });
  try {
    const data = await getObject(media.storage_path);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": media.mime_type,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
