import { describe, it, expect, vi, afterEach } from "vitest";
import { checkRateLimit, getTrustedClientIp } from "@/lib/security/rate-limit";

describe("rate limiting (in-memory adapter)", () => {
  it("allows requests up to the configured max", async () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      const result = await checkRateLimit(key, { max: 5, windowSeconds: 60 });
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks requests once the max is exceeded", async () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(key, { max: 5, windowSeconds: 60 });
    }
    const sixth = await checkRateLimit(key, { max: 5, windowSeconds: 60 });
    expect(sixth.allowed).toBe(false);
    expect(sixth.remaining).toBe(0);
  });

  it("cannot be bypassed by an unrelated header change — the key is what matters", async () => {
    // Simulates a client changing headers but the caller still deriving
    // the same rate-limit key (e.g. from a signed visitor token). Two
    // calls with the identical key must share one bucket regardless of
    // what else differs about the request.
    const key = `test:${Math.random()}`;
    const first = await checkRateLimit(key, { max: 1, windowSeconds: 60 });
    const second = await checkRateLimit(key, { max: 1, windowSeconds: 60 });
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
  });

  it("tracks distinct keys independently", async () => {
    const keyA = `test:a:${Math.random()}`;
    const keyB = `test:b:${Math.random()}`;
    await checkRateLimit(keyA, { max: 1, windowSeconds: 60 });
    const resultB = await checkRateLimit(keyB, { max: 1, windowSeconds: 60 });
    expect(resultB.allowed).toBe(true);
  });
});

describe("trusted client IP extraction", () => {
  afterEach(() => vi.unstubAllEnvs());

  function reqWithHeaders(headers: Record<string, string>) {
    return new Request("https://app.replypilot.example/api/public/chat", { headers });
  }

  it("prefers cf-connecting-ip over a spoofable X-Forwarded-For", () => {
    const req = reqWithHeaders({
      "cf-connecting-ip": "1.2.3.4",
      "x-forwarded-for": "9.9.9.9, 1.2.3.4", // attacker-prepended entry
    });
    expect(getTrustedClientIp(req)).toBe("1.2.3.4");
  });

  it("uses the first X-Forwarded-For entry only when TRUST_PROXY=true", () => {
    vi.stubEnv("TRUST_PROXY", "true");
    const req = reqWithHeaders({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" });
    expect(getTrustedClientIp(req)).toBe("5.6.7.8");
  });

  it("ignores caller-provided X-Forwarded-For unless a trusted proxy is configured", () => {
    vi.stubEnv("TRUST_PROXY", "false");
    const req = reqWithHeaders({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" });
    expect(getTrustedClientIp(req)).toBe("unknown");
  });

  it("returns 'unknown' rather than throwing when no IP information is present", () => {
    const req = reqWithHeaders({});
    expect(getTrustedClientIp(req)).toBe("unknown");
  });
});
