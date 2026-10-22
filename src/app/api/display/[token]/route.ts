import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { displayState } from "@/lib/modules/sessions/state";

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
