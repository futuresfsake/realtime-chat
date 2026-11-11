import type { Clock } from "../lib/clock.js";

// Token bucket: allows a short burst, then a steady rate.
//   tokens = min(capacity, tokens + elapsedSec * refillPerSec)
//   tokens >= 1 -> spend one and allow, otherwise reject
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
    private readonly clock: Clock,
  ) {
    this.tokens = capacity;
    this.lastRefill = clock.now();
  }

  consume(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  // How long until the next message would be allowed (0 = allowed now).
  retryAfterMs(): number {
    this.refill();
    if (this.tokens >= 1) return 0;
    return Math.ceil(((1 - this.tokens) / this.refillPerSec) * 1000);
  }

  isFull(): boolean {
    this.refill();
    return this.tokens >= this.capacity;
  }

  private refill(): void {
    const now = this.clock.now();
    const elapsedSec = Math.max(0, now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.refillPerSec);
    this.lastRefill = now;
  }
}

// One bucket per key (an IP hash). The map is bounded so an attacker rotating
// addresses cannot grow memory without limit: idle (full) buckets are dropped
// first, and if the map is still full new keys are refused (fail closed).
export class KeyedLimiter {
  private readonly buckets = new Map<string, TokenBucket>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
    private readonly clock: Clock,
    private readonly maxKeys = 10_000,
  ) {}

  consume(key: string): boolean {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= this.maxKeys) this.sweep();
      if (this.buckets.size >= this.maxKeys) return false;
      bucket = new TokenBucket(this.capacity, this.refillPerSec, this.clock);
      this.buckets.set(key, bucket);
    }
    return bucket.consume();
  }

  retryAfterMs(key: string): number {
    return this.buckets.get(key)?.retryAfterMs() ?? 0;
  }

  get size(): number {
    return this.buckets.size;
  }

  sweep(): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.isFull()) this.buckets.delete(key);
    }
  }
}
