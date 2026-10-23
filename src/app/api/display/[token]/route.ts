import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { z } from "zod";
import { displaySetSlide, displayState } from "@/lib/modules/sessions/state";
import { publishPresentation } from "@/lib/modules/sessions/teacher";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/** Public classroom display projection (token-scoped, allow-listed fields only). */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(await displayState(token));
  } catch (err) {
    return errorResponse(err);
  }
}

/** Move the slides on the classroom screen (token-scoped; slide number only). */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await rateLimit(`display-slide:${token}`, 240, 600);
    const { slide } = z.object({ slide: z.number().int().min(0).max(200) }).parse(await req.json());
    const sessionId = await displaySetSlide(token, slide);
    await publishPresentation(sessionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
