import { getCurrentUser } from "@/lib/auth/current-user";
import { asUser } from "@/lib/db";
import { uuid } from "@/lib/api";
import { getObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Lesson file materials: the lesson's teacher, or students in a session of that lesson (RLS). */
export async function GET(_req: Request, ctx: { params: Promise<{ materialId: string }> }) {
  const parsed = uuid.safeParse((await ctx.params).materialId);
  const user = await getCurrentUser();
  if (!parsed.success || !user) return new Response("Not found", { status: 404 });
  const row = await asUser(user.id, (db) =>
    db.maybeOne<{ storage_path: string | null; mime_type: string | null; title: string }>("select storage_path, mime_type, title from lesson_materials where id = $1", [parsed.data]),
  );
  if (!row?.storage_path) return new Response("Not found", { status: 404 });
  try {
    const data = await getObject(row.storage_path);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": row.mime_type ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${row.title.replace(/[^\w .-]/g, "_")}"`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Material file is missing. Ask your teacher to re-upload it.", { status: 404 });
  }
}
