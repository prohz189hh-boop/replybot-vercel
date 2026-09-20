import { NextResponse } from "next/server";

/**
 * The public chat/widget-config APIs are the only routes that need CORS
 * at all — everything under /api/dashboard is same-origin, cookie-based,
 * and should NEVER send Access-Control-Allow-Origin.
 *
 * CORS here is authorization-adjacent but not a substitute for it: it
 * only controls which *browsers* will hand a response to *page
 * JavaScript*. A curl/server-to-server request ignores CORS entirely,
 * so the actual security boundary is still the visitor-token check and
 * businessId scoping in the route handler — this just stops a
 * malicious third-party page from silently reading responses via a
 * victim's browser.
 */

const LOCALHOST_ORIGINS = [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/];

function isAllowedOrigin(origin: string, allowedDomains: string[]): boolean {
  if (process.env.NODE_ENV !== "production" && LOCALHOST_ORIGINS.some((re) => re.test(origin))) {
    return true;
  }
  return allowedDomains.includes(origin);
}

/**
 * Call at the top of a public route handler. Returns the origin to echo
 * back if allowed, or null if this origin should not receive CORS
 * headers (the request can still be processed — browsers that get no
 * ACAO header simply won't expose the response to page JS, which is the
 * correct outcome for an unconfigured/unrecognized origin).
 */
export function resolveCorsOrigin(req: Request, allowedDomains: string[]): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null; // non-browser request; nothing to do
  return isAllowedOrigin(origin, allowedDomains) ? origin : null;
}

export function withCors(res: NextResponse, allowedOrigin: string | null): NextResponse {
  if (allowedOrigin) {
    res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    res.headers.set("Vary", "Origin");
    // No Access-Control-Allow-Credentials — the widget uses a bearer
    // visitor token in the request body/header, not cookies, so
    // credentialed CORS is never needed here and staying without it
    // keeps the allowed-origin list from becoming a cookie-theft vector.
  }
  return res;
}

/**
 * Handles an OPTIONS preflight for a public route. `allowedDomains`
 * should come from the specific agent being addressed where the route
 * can resolve one; pass `[]` if the agent isn't known yet (e.g. widget
 * config fetch before init) — in that case only localhost passes in dev
 * and nothing passes in production, which is the safe default the
 * dashboard's per-agent domain setting is meant to override.
 */
export function handlePreflight(req: Request, allowedDomains: string[]): NextResponse {
  const allowedOrigin = resolveCorsOrigin(req, allowedDomains);
  const res = new NextResponse(null, { status: allowedOrigin ? 204 : 403 });
  if (allowedOrigin) {
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.headers.set("Access-Control-Max-Age", "600");
  }
  return withCors(res, allowedOrigin);
}
