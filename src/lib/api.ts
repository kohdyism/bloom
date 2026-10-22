import "server-only";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCurrentUser, type CurrentUser, type Role } from "@/lib/auth/current-user";
import { NotFoundError } from "@/lib/db";
import { RateLimitError } from "@/lib/security/rate-limit";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const forbidden = (message = "You don't have access to this.") => new ApiError(403, "forbidden", message);
export const badRequest = (message: string, code = "bad_request") => new ApiError(400, code, message);
export const conflict = (message: string, code = "conflict") => new ApiError(409, code, message);

type Ctx<P> = { user: CurrentUser; params: P; req: Request };

/**
 * Wraps a route handler with authentication, role checks, body validation and
 * safe error handling. Errors never leak stack traces or SQL to the client.
 */
export function route<S extends z.ZodTypeAny | undefined, P = Record<string, string>>(
  opts: { role?: Role; body?: S },
  handler: (ctx: Ctx<P> & { body: S extends z.ZodTypeAny ? z.infer<S> : undefined }) => Promise<unknown>,
) {
  return async (req: Request, routeCtx: { params: Promise<P> }) => {
    try {
      const user = await getCurrentUser();
      if (!user) throw new ApiError(401, "unauthenticated", "Please sign in again.");
      if (opts.role && user.role !== opts.role) throw forbidden();
      let body: unknown = undefined;
      if (opts.body) {
        const json = await req.json().catch(() => {
          throw badRequest("Request body must be JSON.");
        });
        body = opts.body.parse(json);
      }
      const params = await routeCtx.params;
      const result = await handler({ user, params, req, body: body as never });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "invalid", message: "Some of the information wasn't valid.", issues: err.issues.map((i) => ({ path: i.path, message: i.message })) },
      { status: 400 },
    );
  }
  if (err instanceof RateLimitError) {
    return NextResponse.json({ error: "rate_limited", message: err.message }, { status: 429, headers: { "Retry-After": String(err.retryAfterSeconds) } });
  }
  if (err instanceof NotFoundError) {
    return NextResponse.json({ error: "not_found", message: "We couldn't find that." }, { status: 404 });
  }
  const pgCode = (err as { code?: string })?.code;
  if (pgCode === "42501") {
    // Row-level security rejected the write.
    return NextResponse.json({ error: "forbidden", message: "You don't have access to this." }, { status: 403 });
  }
  if (pgCode === "23505") {
    return NextResponse.json({ error: "duplicate", message: "That already exists." }, { status: 409 });
  }
  console.error("[bloom] unhandled API error", err);
  return NextResponse.json({ error: "server_error", message: "Something went wrong on our side. Your work is safe — please try again." }, { status: 500 });
}

export const uuid = z.string().uuid();
