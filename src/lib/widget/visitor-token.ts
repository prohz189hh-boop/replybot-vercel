import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * The widget's old approach — a browser-generated `Math.random()` string
 * echoed straight into `externalId` — let anyone impersonate any other
 * visitor's conversation just by sending a different string. This
 * replaces it with a stateless, signed token:
 *
 *   token = base64url(payload) + "." + base64url(hmac(payload))
 *   payload = { v: visitorId, a: agentPublicId, iat }
 *
 * The server mints it once (POST /api/public/visitor/init), the widget
 * stores the opaque token and sends it back on every request, and the
 * server verifies the signature before trusting `visitorId` or
 * `agentPublicId` from it. A forged/tampered token fails verification;
 * a token minted for agent X can't be replayed against agent Y because
 * the agent id is inside the signed payload, not a separate field the
 * client could swap independently.
 *
 * No server-side session storage is required (stateless), so this
 * scales the same way the rest of the public API does — but it is NOT
 * a bearer credential for anything except "which anonymous visitor
 * record to attach messages to." It grants no dashboard/auth access.
 */

interface VisitorPayload {
  v: string; // visitorId
  a: string; // agentPublicId this token is scoped to
  iat: number; // issued-at, epoch seconds
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 180; // 180 days — long-lived widget session

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // Fail loudly rather than silently signing with an empty/guessable
    // key — an unsigned or weakly-signed visitor token defeats the
    // entire point of this module.
    throw new Error(
      "AUTH_SECRET is not set. Visitor tokens cannot be issued or verified without it.",
    );
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function issueVisitorToken(agentPublicId: string): { token: string; visitorId: string } {
  const visitorId = randomBytes(24).toString("base64url");
  const payload: VisitorPayload = { v: visitorId, a: agentPublicId, iat: Math.floor(Date.now() / 1000) };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(payloadStr);
  return { token: `${payloadStr}.${signature}`, visitorId };
}

export interface VerifiedVisitor {
  visitorId: string;
  agentPublicId: string;
}

/**
 * Verifies signature, expiry, and that the token was issued for
 * `expectedAgentPublicId` — callers must pass the agent id from the
 * request body/URL and confirm it matches, so a token can't be reused
 * against a different agent even if signature verification alone would
 * pass (it wouldn't, since the agent id is part of the signed payload,
 * but this makes the binding explicit and fails closed either way).
 */
export function verifyVisitorToken(
  token: string,
  expectedAgentPublicId: string,
): VerifiedVisitor | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadStr, signature] = parts;
  if (!payloadStr || !signature) return null;

  const expectedSignature = sign(payloadStr);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  let payload: VisitorPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadStr, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!payload.v || !payload.a || !payload.iat) return null;
  if (payload.a !== expectedAgentPublicId) return null;

  const ageSeconds = Math.floor(Date.now() / 1000) - payload.iat;
  if (ageSeconds < 0 || ageSeconds > TOKEN_TTL_SECONDS) return null;

  return { visitorId: payload.v, agentPublicId: payload.a };
}
