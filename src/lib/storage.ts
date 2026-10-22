import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

/**
 * Private object storage. Files are never public: they are always streamed
 * back through an API route that checks the caller's access first.
 *
 *  local    — files on disk under BLOOM_UPLOAD_DIR (development / demo)
 *  supabase — a private Supabase Storage bucket accessed with the service role
 *             key on the server only (not exercised by the local test-suite)
 */
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const ALLOWED_MATERIAL_TYPES = [...ALLOWED_IMAGE_TYPES, "application/pdf", "text/plain"];
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const BUCKET = process.env.BLOOM_STORAGE_BUCKET ?? "bloom-private";

const EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf", "text/plain": "txt",
};

/** Check the leading bytes so a renamed file can't pose as an image. */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.length >= 6 && buf.subarray(0, 3).toString() === "GIF") return "image/gif";
  if (buf.length >= 4 && buf.subarray(0, 4).toString() === "%PDF") return "application/pdf";
  return null;
}

function supabase() {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, { auth: { persistSession: false } });
}

export async function putObject(prefix: string, data: Buffer, mime: string): Promise<string> {
  const key = `${prefix.replace(/[^a-z0-9/_-]/gi, "")}/${randomUUID()}.${EXT[mime] ?? "bin"}`;
  if (config.storageBackend === "supabase") {
    const { error } = await supabase().storage.from(BUCKET).upload(key, data, { contentType: mime, upsert: false });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    return key;
  }
  const full = path.resolve(config.localUploadDir, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return key;
}

export async function getObject(key: string): Promise<Buffer> {
  if (key.includes("..")) throw new Error("Invalid key");
  if (config.storageBackend === "supabase") {
    const { data, error } = await supabase().storage.from(BUCKET).download(key);
    if (error || !data) throw new Error("Not found");
    return Buffer.from(await data.arrayBuffer());
  }
  const root = path.resolve(config.localUploadDir);
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid key");
  return readFile(full);
}
