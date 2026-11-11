import { describe, expect, it } from "vitest";
import { FakeClock } from "../../../src/lib/clock.js";
import { KeyedLimiter, TokenBucket } from "../../../src/security/tokenBucket.js";

describe("TokenBucket", () => {
  it("allows a burst up to capacity, then rejects", () => {
    const bucket = new TokenBucket(5, 0.5, new FakeClock());
    for (let i = 0; i < 5; i++) expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(false);
  });

  it("refills over time: 0.5/s gives one token after 2 s", () => {
    const clock = new FakeClock();
    const bucket = new TokenBucket(5, 0.5, clock);
    for (let i = 0; i < 5; i++) bucket.consume();
    clock.advance(1999);
    expect(bucket.consume()).toBe(false);
    clock.advance(1);
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(false);
  });

  it("never holds more than capacity", () => {
    const clock = new FakeClock();
    const bucket = new TokenBucket(5, 0.5, clock);
    clock.advance(60 * 60 * 1000);
    for (let i = 0; i < 5; i++) expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(false);
  });

  it("reports how long to wait", () => {
    const clock = new FakeClock();
    const bucket = new TokenBucket(5, 0.5, clock);
    expect(bucket.retryAfterMs()).toBe(0);
    for (let i = 0; i < 5; i++) bucket.consume();
    expect(bucket.retryAfterMs()).toBe(2000);
    clock.advance(500);
    expect(bucket.retryAfterMs()).toBe(1500);
  });

  it("is not confused by a clock that goes backwards", () => {
    const clock = new FakeClock(10_000);
    const bucket = new TokenBucket(1, 1, clock);
    bucket.consume();
    clock.set(5_000);
    expect(bucket.consume()).toBe(false);
  });
});

describe("KeyedLimiter", () => {
  it("tracks each key separately", () => {
    const limiter = new KeyedLimiter(2, 1, new FakeClock());
    expect(limiter.consume("a")).toBe(true);
    expect(limiter.consume("a")).toBe(true);
    expect(limiter.consume("a")).toBe(false);
    expect(limiter.consume("b")).toBe(true);
    expect(limiter.retryAfterMs("a")).toBe(1000);
    expect(limiter.retryAfterMs("never-seen")).toBe(0);
  });

  it("stays bounded: drops idle keys, refuses new keys when still full", () => {
    const clock = new FakeClock();
    const limiter = new KeyedLimiter(1, 1, clock, 2);
    limiter.consume("a");
    limiter.consume("b");
    expect(limiter.consume("c")).toBe(false); // full, nothing idle yet
    expect(limiter.size).toBe(2);
    clock.advance(1000); // a and b have refilled, so they are idle
    expect(limiter.consume("c")).toBe(true);
    expect(limiter.size).toBe(1);
  });
});
