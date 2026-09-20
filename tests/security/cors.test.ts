import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveCorsOrigin, handlePreflight } from "@/lib/security/cors";

function reqWithOrigin(origin: string | null) {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  return new Request("https://app.replypilot.example/api/public/chat", { headers });
}

describe("CORS origin resolution", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("allows an origin present in the agent's allowedDomains", () => {
    const result = resolveCorsOrigin(reqWithOrigin("https://acme.com"), ["https://acme.com"]);
    expect(result).toBe("https://acme.com");
  });

  it("rejects an origin NOT present in allowedDomains", () => {
    const result = resolveCorsOrigin(reqWithOrigin("https://evil.example"), ["https://acme.com"]);
    expect(result).toBeNull();
  });

  it("rejects every origin when allowedDomains is empty, in production", () => {
    process.env.NODE_ENV = "production";
    const result = resolveCorsOrigin(reqWithOrigin("https://acme.com"), []);
    expect(result).toBeNull();
  });

  it("allows localhost in non-production even with empty allowedDomains", () => {
    process.env.NODE_ENV = "development";
    const result = resolveCorsOrigin(reqWithOrigin("http://localhost:3000"), []);
    expect(result).toBe("http://localhost:3000");
  });

  it("does NOT allow localhost in production", () => {
    process.env.NODE_ENV = "production";
    const result = resolveCorsOrigin(reqWithOrigin("http://localhost:3000"), []);
    expect(result).toBeNull();
  });

  it("returns null (no CORS headers) for a non-browser request with no Origin header", () => {
    const result = resolveCorsOrigin(reqWithOrigin(null), ["https://acme.com"]);
    expect(result).toBeNull();
  });

  it("never treats a wildcard-like configured domain as matching everything", () => {
    // allowedDomains is an exact-match allowlist, not a pattern matcher
    // — "https://acme.com" must not match "https://acme.com.evil.example".
    const result = resolveCorsOrigin(reqWithOrigin("https://acme.com.evil.example"), ["https://acme.com"]);
    expect(result).toBeNull();
  });

  it("preflight response includes ACAO only for an allowed origin", async () => {
    const res = handlePreflight(reqWithOrigin("https://acme.com"), ["https://acme.com"]);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://acme.com");
  });

  it("preflight response rejects (403, no ACAO) for a disallowed origin", async () => {
    const res = handlePreflight(reqWithOrigin("https://evil.example"), ["https://acme.com"]);
    expect(res.status).toBe(403);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("never sets Access-Control-Allow-Credentials", async () => {
    const res = handlePreflight(reqWithOrigin("https://acme.com"), ["https://acme.com"]);
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });
});
