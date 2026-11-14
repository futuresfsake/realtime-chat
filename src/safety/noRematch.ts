import type { Clock } from "../lib/clock.js";

// One side of a pair: who it is on the network and which connection it is.
export interface Party {
  ipHash: string; // keyed hash of the address (never the address itself)
  id: string; // the connection's socket id
}

// Two people who have just parted are not paired again for a while: if you
// skip someone, you should not meet them again straight away (and if someone
// skips you, they should not be handed back to you).
//
// People are anonymous, so a pair is identified like this:
//   - on different addresses: by the two IP hashes, so a reconnect or a new
//     tab does not get around it;
//   - on the same address (a shared network, a school, mobile data): by the
//     two connections only. Using the address would block everyone on that
//     network from meeting each other, which is wrong.
// Everything lives in memory and nothing is written anywhere. The daily salt
// rotation (see ipHash.ts) changes every hash, so no address record outlives a
// day even if the time-to-live is longer.
export class NoRematch {
  private readonly until = new Map<string, number>(); // pair key -> expiry (epoch ms)

  constructor(
    private readonly clock: Clock,
    private readonly ttlMs: number,
    private readonly maxPairs = 10_000, // memory bound on a small instance
  ) {}

  get size(): number {
    return this.until.size;
  }

  // Order does not matter: (a, b) and (b, a) are the same pair.
  private key(a: Party, b: Party): string {
    if (a.ipHash !== b.ipHash) {
      return a.ipHash < b.ipHash ? `ip:${a.ipHash}|${b.ipHash}` : `ip:${b.ipHash}|${a.ipHash}`;
    }
    return a.id <= b.id ? `id:${a.id}|${b.id}` : `id:${b.id}|${a.id}`;
  }

  add(a: Party, b: Party): void {
    this.purge();
    const key = this.key(a, b);
    this.until.delete(key); // re-insert, so insertion order is also expiry order
    this.until.set(key, this.clock.now() + this.ttlMs);
    // Over the bound: forget the oldest records first rather than grow without limit.
    while (this.until.size > this.maxPairs) {
      const oldest = this.until.keys().next().value;
      if (oldest === undefined) break;
      this.until.delete(oldest);
    }
  }

  blocked(a: Party, b: Party): boolean {
    const key = this.key(a, b);
    const expiry = this.until.get(key);
    if (expiry === undefined) return false;
    if (expiry <= this.clock.now()) {
      this.until.delete(key);
      return false;
    }
    return true;
  }

  // Drops expired records. Entries are in expiry order, so it stops at the first live one.
  private purge(): void {
    const now = this.clock.now();
    for (const [key, expiry] of this.until) {
      if (expiry > now) break;
      this.until.delete(key);
    }
  }
}
