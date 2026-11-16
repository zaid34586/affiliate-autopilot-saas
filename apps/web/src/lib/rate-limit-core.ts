/**
 * Phase 4 — Rate limiting core (pure logic).
 *
 * Fixed-window in-memory limiter for auth endpoints (login/signup).
 * The clock is injectable so tests are deterministic.
 *
 * NOTE: per-instance memory — in serverless each instance keeps its own
 * map. This still caps brute force per instance; a shared store (Redis /
 * Upstash) is an owner decision if global limits are ever required.
 */

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

export type RateLimitOptions = {
  /** Max hits allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Injectable clock (defaults to Date.now). */
  now?: () => number;
  /** Safety cap on tracked keys (oldest/expired evicted beyond this). */
  maxKeys?: number;
};

type Bucket = { count: number; resetAt: number };

export function createFixedWindowLimiter(options: RateLimitOptions) {
  const { limit, windowMs, now = () => Date.now(), maxKeys = 10_000 } = options;
  const buckets = new Map<string, Bucket>();

  return function hit(key: string): RateLimitResult {
    const t = now();

    const existing = buckets.get(key);
    if (existing && existing.resetAt > t) {
      if (existing.count >= limit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - t) / 1000)),
          remaining: 0,
        };
      }
      existing.count += 1;
      return { allowed: true, retryAfterSeconds: 0, remaining: Math.max(0, limit - existing.count) };
    }

    // New (or expired) bucket — keep memory bounded by evicting OTHER keys
    // (the key being counted is never in the map on this path).
    if (buckets.size >= maxKeys) {
      for (const [k, b] of buckets) {
        if (b.resetAt <= t) buckets.delete(k);
      }
      // Map preserves insertion order → drop oldest live keys if still full
      while (buckets.size >= maxKeys) {
        const oldest = buckets.keys().next();
        if (oldest.done) break;
        buckets.delete(oldest.value);
      }
    }

    buckets.set(key, { count: 1, resetAt: t + windowMs });
    return { allowed: true, retryAfterSeconds: 0, remaining: Math.max(0, limit - 1) };
  };
}
