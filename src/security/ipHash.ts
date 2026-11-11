import { createHmac, randomBytes } from "node:crypto";
import type { Clock } from "../lib/clock.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface IpHasher {
  hash(ip: string): string; // 64 hex chars
}

// Pseudonymises an IP with a keyed hash (HMAC-SHA-256). The key changes every
// 24 hours, so yesterday's hashes cannot be linked to today's.
//  - With a secret (IP_HASH_SECRET): the daily key is derived from it, so
//    hashes stay stable across restarts within the same day.
//  - Without a secret: a random in-memory key, replaced every 24 hours.
export function createIpHasher(options: { clock: Clock; secret?: string | undefined }): IpHasher {
  const { clock, secret } = options;
  let randomKey = randomBytes(32);
  let randomKeyCreatedAt = clock.now();

  function dailyKey(): Buffer {
    if (secret) {
      const day = Math.floor(clock.now() / DAY_MS);
      return createHmac("sha256", secret).update(`ip-hash-day:${day}`).digest();
    }
    if (clock.now() - randomKeyCreatedAt >= DAY_MS) {
      randomKey = randomBytes(32);
      randomKeyCreatedAt = clock.now();
    }
    return randomKey;
  }

  return {
    hash(ip: string): string {
      return createHmac("sha256", dailyKey()).update(ip).digest("hex");
    },
  };
}

// Logs only ever carry this short prefix: enough to correlate events from one
// connection, not enough to act as a stable identifier.
export function ipHashPrefix(ipHash: string): string {
  return ipHash.slice(0, 8);
}
