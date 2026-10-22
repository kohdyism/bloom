import { ApiError, badRequest, conflict, errorResponse, uuid } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";
import { asUser } from "@/lib/db";
import { rateLimit } from "@/lib/security/rate-limit";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, putObject, sniffMime } from "@/lib/storage";
import { studentContext } from "@/lib/modules/sessions/student";
import { notifyGroup } from "@/lib/modules/sessions/engine";
import { NextResponse } from "next/server";

/** Upload a photo of physical work (or an image for the board/slides). */
export async function POST(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") throw new ApiError(401, "unauthenticated", "Please sign in again.");
    const sessionId = uuid.parse((await ctx.params).sessionId);
    await rateLimit(`upload:${user.id}`, 20, 600);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    const caption = String(form?.get("caption") ?? "").slice(0, 200);
    if (!(file instanceof File) || file.size === 0) throw badRequest("Choose a photo to upload.");
    if (file.size > MAX_UPLOAD_BYTES) throw badRequest("That photo is over 8 MB. Try taking it at a lower resolution.");
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = sniffMime(buf);
    if (!mime || !ALLOWED_IMAGE_TYPES.includes(mime)) throw badRequest("Upload a PNG, JPEG, WebP or GIF image.");

    const { group } = await asUser(user.id, (db) => studentContext(db, user.id, sessionId));
    if (!group) throw conflict("You aren't in a group yet.");
    const key = await putObject(`groups/${group.id}`, buf, mime);
    const row = await asUser(user.id, (db) =>
      db.one<{ id: string }>(
        "insert into media_uploads(group_id, uploader_id, storage_path, mime_type, size_bytes, caption) values ($1,$2,$3,$4,$5,$6) returning id",
        [group.id, user.id, key, mime, buf.length, caption],
      ),
    );
    await notifyGroup(group, "media.updated");
    return NextResponse.json({ id: row.id });
  } catch (err) {
    return errorResponse(err);
  }
}
