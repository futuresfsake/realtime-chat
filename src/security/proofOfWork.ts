import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Clock } from "../lib/clock.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CHALLENGE_LENGTH = 512;
const MAX_NONCE_DIGITS = 12;
const MAX_USED = 10_000; // memory bound

export type PowFailure =
  | "missing"
  | "malformed"
  | "bad_signature"
  | "expired"
  | "ip_mismatch"
  | "replayed"
  | "bad_nonce"
  | "insufficient";
export type PowResult = { ok: true } | { ok: false; reason: PowFailure };

// How many leading zero bits a hash starts with.
export function leadingZeroBits(hash: Buffer): number {
  let bits = 0;
  for (const byte of hash) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    bits += Math.clz32(byte) - 24;
    break;
  }
  return bits;
}

// The work a client must do: find a number `nonce` so that
// SHA-256(challenge + ":" + nonce) starts with `bits` zero bits (US-39).
// It costs a browser a fraction of a second once, and costs a script that opens
// many connections that work for every one of them.
//
//   challenge = base64url(payload) + "." + base64url(HMAC-SHA-256(key, payload))
//
// A challenge is signed by us (so it cannot be made up), bound to the network
// address it was issued to (so it cannot be handed to a bot farm), expires
// quickly, and works once. The key lives only in memory and rotates daily.
// This slows bots down; it is not a lock (see docs/00-overview/limits-and-roadmap.md).
export class ProofOfWork {
  private key = randomBytes(32);
  private previousKey: Buffer | null = null;
  private rotatedAt: number;
  private readonly used = new Map<string, number>(); // challenge nonce -> expiry

  constructor(
    private readonly clock: Clock,
    readonly bits: number, // 0 switches the check off
    private readonly ttlMs = 60_000,
  ) {
    this.rotatedAt = clock.now();
  }

  get required(): boolean {
    return this.bits > 0;
  }

  issue(ipHash: string): { challenge: string; bits: number } {
    this.rotateIfDue();
    const now = this.clock.now();
    const payload = Buffer.from(JSON.stringify({ n: randomBytes(16).toString("hex"), exp: now + this.ttlMs, ip: ipHash }));
    const body = payload.toString("base64url");
    const signature = createHmac("sha256", this.key).update(body).digest("base64url");
    return { challenge: `${body}.${signature}`, bits: this.bits };
  }

  verify(challenge: unknown, nonce: unknown, ipHash: string): PowResult {
    if (typeof challenge !== "string" || typeof nonce !== "string") return { ok: false, reason: "missing" };
    if (challenge.length > MAX_CHALLENGE_LENGTH || !/^\d+$/.test(nonce) || nonce.length > MAX_NONCE_DIGITS) {
      return { ok: false, reason: "malformed" };
    }
    this.rotateIfDue();
    const parts = challenge.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: "malformed" };
    const [body, signature] = parts as [string, string];

    const signedBy = [this.key, this.previousKey].some(
      (key) => key !== null && sameString(createHmac("sha256", key).update(body).digest("base64url"), signature),
    );
    if (!signedBy) return { ok: false, reason: "bad_signature" };

    let payload: { n?: unknown; exp?: unknown; ip?: unknown };
    try {
      payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as typeof payload;
    } catch {
      return { ok: false, reason: "malformed" };
    }
    if (typeof payload.n !== "string" || typeof payload.exp !== "number" || typeof payload.ip !== "string") {
      return { ok: false, reason: "malformed" };
    }
    const now = this.clock.now();
    if (payload.exp <= now) return { ok: false, reason: "expired" };
    if (payload.ip !== ipHash) return { ok: false, reason: "ip_mismatch" };
    this.purge(now);
    if (this.used.has(payload.n)) return { ok: false, reason: "replayed" };

    const hash = createHash("sha256").update(`${challenge}:${nonce}`).digest();
    if (leadingZeroBits(hash) < this.bits) return { ok: false, reason: "insufficient" };

    // Only a correct answer uses the challenge up: a wrong guess can be retried.
    this.used.set(payload.n, payload.exp);
    while (this.used.size > MAX_USED) {
      const oldest = this.used.keys().next().value;
      if (oldest === undefined) break;
      this.used.delete(oldest);
    }
    return { ok: true };
  }

  private purge(now: number): void {
    for (const [nonce, expiry] of this.used) {
      if (expiry > now) continue;
      this.used.delete(nonce);
    }
  }

  private rotateIfDue(): void {
    if (this.clock.now() - this.rotatedAt < DAY_MS) return;
    this.previousKey = this.key; // challenges issued just before rotation still verify
    this.key = randomBytes(32);
    this.rotatedAt = this.clock.now();
  }
}

function sameString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
