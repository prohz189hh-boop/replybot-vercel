import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { issueVisitorToken, verifyVisitorToken } from "@/lib/widget/visitor-token";

/**
 * These are pure unit tests — no database or network required, so they
 * genuinely can run in this environment. (Run with: npx vitest run
 * tests/security/visitor-token.test.ts — requires `npm install` to have
 * completed, which this environment cannot do; see final report.)
 */

describe("visitor token", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = "test-secret-do-not-use-in-production";
  });

  it("issues a token that verifies successfully for the same agent", () => {
    const { token, visitorId } = issueVisitorToken("agent_abc123");
    const verified = verifyVisitorToken(token, "agent_abc123");

    expect(verified).not.toBeNull();
    expect(verified?.visitorId).toBe(visitorId);
    expect(verified?.agentPublicId).toBe("agent_abc123");
  });

  it("rejects a token when checked against a different agent", () => {
    // Prevents a token minted for agent A being replayed against
    // agent B, even though the signature itself is valid.
    const { token } = issueVisitorToken("agent_abc123");
    const verified = verifyVisitorToken(token, "agent_XYZ999");

    expect(verified).toBeNull();
  });

  it("rejects a token with a tampered payload", () => {
    const { token } = issueVisitorToken("agent_abc123");
    const [payload, signature] = token.split(".");

    // Flip the visitorId inside the payload without re-signing —
    // simulates a customer editing localStorage to impersonate someone
    // else's conversation.
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    decoded.v = "someone-elses-visitor-id";
    const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    const tamperedToken = `${tamperedPayload}.${signature}`;

    expect(verifyVisitorToken(tamperedToken, "agent_abc123")).toBeNull();
  });

  it("rejects a token with a tampered signature", () => {
    const { token } = issueVisitorToken("agent_abc123");
    const [payload] = token.split(".");
    const forged = `${payload}.${"a".repeat(43)}`; // wrong signature, same length family

    expect(verifyVisitorToken(forged, "agent_abc123")).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(verifyVisitorToken("not-a-real-token", "agent_abc123")).toBeNull();
    expect(verifyVisitorToken("", "agent_abc123")).toBeNull();
    expect(verifyVisitorToken("a.b.c", "agent_abc123")).toBeNull();
  });

  it("rejects an expired token", () => {
    const { token } = issueVisitorToken("agent_abc123");
    const [payload, signature] = token.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

    // Back-date issuance by 181 days (TTL is 180).
    decoded.iat = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 181;
    const backdatedPayload = Buffer.from(JSON.stringify(decoded)).toString("base64url");

    // Re-sign with the real secret so this test isolates the expiry
    // check, not the signature check.
    const { createHmac } = require("crypto");
    const realSignature = createHmac("sha256", process.env.AUTH_SECRET!).update(backdatedPayload).digest("base64url");

    expect(verifyVisitorToken(`${backdatedPayload}.${realSignature}`, "agent_abc123")).toBeNull();
    void signature; // unused, kept for clarity that we deliberately re-signed instead
  });

  it("two calls issue different visitorIds (no collisions from weak randomness)", () => {
    const a = issueVisitorToken("agent_abc123");
    const b = issueVisitorToken("agent_abc123");
    expect(a.visitorId).not.toBe(b.visitorId);
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "test-secret-do-not-use-in-production";
  });
});
