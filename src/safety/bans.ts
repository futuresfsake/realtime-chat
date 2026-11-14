import type { Clock } from "../lib/clock.js";

// Connections that may not be matched for a while (US-20). Identified by the
// keyed IP hash only; the hash changes every day with the salt rotation, so a
// block can never outlive a day even if the period is longer. Memory only.
//
// Known limit: everyone behind one shared address shares one hash, so a block
// reaches the whole network. That is why it takes three different reporters,
// and why it is temporary.
export class BanList {
  private readonly until = new Map<string, number>(); // ip hash -> expiry (epoch ms)

  constructor(
    private readonly clock: Clock,
    private readonly durationMs: number,
    private readonly maxEntries = 5_000,
  ) {}

  get size(): number {
    return this.until.size;
  }

  ban(ipHash: string): void {
    this.purge();
    this.until.delete(ipHash); // re-insert, so insertion order is also expiry order
    this.until.set(ipHash, this.clock.now() + this.durationMs);
    while (this.until.size > this.maxEntries) {
      const oldest = this.until.keys().next().value;
      if (oldest === undefined) break;
      this.until.delete(oldest);
    }
  }

  isBanned(ipHash: string): boolean {
    const expiry = this.until.get(ipHash);
    if (expiry === undefined) return false;
    if (expiry <= this.clock.now()) {
      this.until.delete(ipHash);
      return false;
    }
    return true;
  }

  // Entries are in expiry order, so this stops at the first live one.
  private purge(): void {
    const now = this.clock.now();
    for (const [hash, expiry] of this.until) {
      if (expiry > now) break;
      this.until.delete(hash);
    }
  }
}
