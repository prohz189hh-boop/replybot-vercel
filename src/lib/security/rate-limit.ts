/**
 * Rate limiting via a pluggable adapter. The previous version was a bare
 * in-memory Map — correct for a single dev process, silently useless
 * across multiple serverless/container instances in production (each
 * instance has its own Map, so limits reset per-instance and can be
 * trivially bypassed by load-balanced requests landing on different
 * instances).
 *
 * This keeps the in-memory adapter for local dev (explicit, not a
 * silent fallback — it logs a warning once) and adds a Redis-backed
 * adapter used automatically when UPSTASH_REDIS_REST_URL is configured.
 * Callers never see the difference.
 */

export interface RateLimitAdapter {
  /** Atomically increments the counter for `key` and returns the new count. */
  increment(key: string, windowSeconds: number): Promise<number>;
}

class InMemoryRateLimitAdapter implements RateLimitAdapter {
  private buckets = new Map<string, { count: number; resetAt: number }>();
  private warned = false;

  async increment(key: string, windowSeconds: number): Promise<number> {
    if (!this.warned && process.env.NODE_ENV === "production") {
      console.warn(
        "[rate-limit] Using in-memory adapter in production — limits are per-instance, " +
          "not global. Set UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN to fix this.",
      );
      this.warned = true;
    }

    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return 1;
    }
    bucket.count += 1;
    return bucket.count;
  }
}

/**
 * Upstash's REST API (works from any serverless runtime without a
 * persistent TCP connection, unlike ioredis). Uses INCR + EXPIRE NX so
 * the counter is atomic and self-expiring — no separate cleanup job.
 */
class UpstashRedisRateLimitAdapter implements RateLimitAdapter {
  constructor(private baseUrl: string, private token: string) {}

  async increment(key: string, windowSeconds: number): Promise<number> {
    const res = await fetch(`${this.baseUrl}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(windowSeconds), "NX"],
      ]),
    });

    if (!res.ok) {
      // Fail open on the rate limiter's OWN infra failure rather than
      // taking the whole app down — a deliberate tradeoff, logged
      // loudly so it gets fixed rather than silently relied upon.
      console.error("[rate-limit] Upstash request failed, failing open:", res.status);
      return 1;
    }

    const [incrResult] = await res.json();
    return Number(incrResult?.result ?? 1);
  }
}

let adapter: RateLimitAdapter | null = null;

function getAdapter(): RateLimitAdapter {
  if (adapter) return adapter;

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  adapter =
    upstashUrl && upstashToken
      ? new UpstashRedisRateLimitAdapter(upstashUrl, upstashToken)
      : new InMemoryRateLimitAdapter();

  return adapter;
}

export async function checkRateLimit(
  key: string,
  opts: { max: number; windowSeconds: number },
): Promise<{ allowed: boolean; remaining: number }> {
  const count = await getAdapter().increment(key, opts.windowSeconds);
  return { allowed: count <= opts.max, remaining: Math.max(0, opts.max - count) };
}

export const RATE_LIMITS = {
  login: { max: 10, windowSeconds: 60 },
  signup: { max: 5, windowSeconds: 60 * 15 },
  passwordReset: { max: 5, windowSeconds: 60 * 15 },
  chat: { max: 20, windowSeconds: 60 },
  aiGeneration: { max: 60, windowSeconds: 60 },
  crawling: { max: 5, windowSeconds: 60 },
  uploads: { max: 10, windowSeconds: 60 },
};

/**
 * Extracts a trustworthy client IP. `X-Forwarded-For` is attacker-
 * controlled unless the platform guarantees it strips/overwrites
 * inbound values before appending the real one. The named
 * platform-specific headers (Vercel/Cloudflare/Fly) are safe to read
 * unconditionally because those platforms set them themselves. A bare
 * `X-Forwarded-For` is NOT read unless TRUST_PROXY=true is explicitly
 * set — that's an operator asserting "I run behind a proxy I control
 * that sanitizes this header," which isn't true by default and
 * shouldn't be assumed.
 */
export function getTrustedClientIp(req: Request): string {
  const platformHeaders = ["cf-connecting-ip", "x-vercel-forwarded-for", "fly-client-ip", "x-real-ip"];
  for (const h of platformHeaders) {
    const value = req.headers.get(h);
    if (value) return value.split(",")[0].trim();
  }

  if (process.env.TRUST_PROXY === "true") {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
  }

  return "unknown";
}
