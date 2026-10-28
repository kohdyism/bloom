import { z } from "zod";

/**
 * Rich media a teacher puts straight into a stage's instructions: pictures,
 * videos (YouTube / Vimeo), web links or simulations, and uploaded files.
 * Shown inline to students, separate from the lesson's general materials.
 */
export const stageAttachmentSchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(["image", "video", "link", "file"]),
  title: z.string().max(160).default(""),
  /** http(s) address for images, videos and links. */
  url: z.string().max(2000).default(""),
  /** Uploaded file (lesson file id) for kind "file" or an uploaded image. */
  fileId: z.string().uuid().optional(),
  mime: z.string().max(100).optional(),
  /** Links: show the page inside the task (e.g. a simulation), not just a link. */
  embed: z.boolean().default(false),
});
export type StageAttachment = z.infer<typeof stageAttachmentSchema>;

export function safeHttpUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** A privacy-friendly embed address for YouTube or Vimeo, or null. */
export function videoEmbedUrl(raw: string): string | null {
  const url = safeHttpUrl(raw);
  if (!url) return null;
  const u = new URL(url);
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] || null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(embed|shorts|live)\/([\w-]{6,})/);
      id = m ? m[2] : null;
    }
  }
  if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/(\d{6,})/);
    if (m) return `https://player.vimeo.com/video/${m[1]}`;
  }
  return null;
}

/** Guess what a pasted address is, so the teacher only has to paste it. */
export function classifyUrl(raw: string): "image" | "video" | "link" | null {
  const url = safeHttpUrl(raw);
  if (!url) return null;
  if (videoEmbedUrl(url)) return "video";
  if (/\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(new URL(url).pathname)) return "image";
  return "link";
}
