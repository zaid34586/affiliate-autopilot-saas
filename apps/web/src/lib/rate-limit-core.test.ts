/**
 * Phase 4 — Rate Limit Core Tests
 */

import { describe, it, expect } from "vitest";
import { createFixedWindowLimiter } from "./rate-limit-core";

describe("createFixedWindowLimiter", () => {
  it("allows up to the limit, then blocks with retryAfter", () => {
    const t = 1_000_000;
    const limiter = createFixedWindowLimiter({ limit: 3, windowMs: 60_000, now: () => t });

    expect(limiter("k").allowed).toBe(true);
    expect(limiter("k").allowed).toBe(true);
    const third = limiter("k");
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const fourth = limiter("k");
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);
    expect(fourth.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("resets after the window passes", () => {
    let t = 0;
    const limiter = createFixedWindowLimiter({ limit: 1, windowMs: 1_000, now: () => t });

    expect(limiter("k").allowed).toBe(true);
    expect(limiter("k").allowed).toBe(false);

    t = 1_000; // window over → fresh bucket
    expect(limiter("k").allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const limiter = createFixedWindowLimiter({ limit: 1, windowMs: 60_000, now: () => 0 });

    expect(limiter("a").allowed).toBe(true);
    expect(limiter("b").allowed).toBe(true);
    expect(limiter("a").allowed).toBe(false);
    expect(limiter("b").allowed).toBe(false);
  });

  it("reports decreasing remaining count", () => {
    const limiter = createFixedWindowLimiter({ limit: 5, windowMs: 60_000, now: () => 0 });

    expect(limiter("k").remaining).toBe(4);
    expect(limiter("k").remaining).toBe(3);
    expect(limiter("k").remaining).toBe(2);
  });

  it("evicts oldest keys beyond maxKeys, keeping live counts intact", () => {
    const limiter = createFixedWindowLimiter({
      limit: 1,
      windowMs: 60_000,
      now: () => 0,
      maxKeys: 2,
    });

    expect(limiter("a").allowed).toBe(true); // {a}
    expect(limiter("b").allowed).toBe(true); // {a,b}
    limiter("c"); // evicts oldest "a" → {b,c}
    limiter("d"); // evicts oldest "b" → {c,d}

    // Evicted key comes back with a fresh bucket
    expect(limiter("a").allowed).toBe(true);
    // Live keys keep their counts despite the cap
    expect(limiter("d").allowed).toBe(false);
  });

  it("retryAfterSeconds is at least 1 while blocked", () => {
    const limiter = createFixedWindowLimiter({ limit: 1, windowMs: 500, now: () => 0 });
    limiter("k");
    const blocked = limiter("k");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});
