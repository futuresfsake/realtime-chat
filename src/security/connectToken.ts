import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Clock } from "../lib/clock.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TOKEN_LENGTH = 512;

export type TokenFailure = "malformed" | "bad_signature" | "expired" | "ip_mismatch" | "replayed";
export type TokenResult = { ok: true } | { ok: false; reason: TokenFailure };

interface Payload {
  n: string; // nonce
  iat: number;
  exp: number;
  ip: string; // IP hash the token was issued to
}

// Short-lived, single-use proof that a client fetched /connect-token over
// HTTPS from the same network just before opening its WebSocket.
//   token = base64url(payload) + "." + base64url(HMAC-SHA-256(key, payload))
// It carries no user identity. The signing key lives only in memory and is
// replaced every 24 hours.
export class ConnectTokens {
  private key = randomBytes(32);
  private previousKey: Buffer | null = null;
  private rotatedAt: number;
  private readonly usedNonces = new Map<string, number>(); // nonce -> expiry

  constructor(
    private readonly clock: Clock,
    private readonly ttlMs: number,
    private readonly maxTrackedNonces = 50_000,
  ) {
    this.rotatedAt = clock.now();
  }

  issue(ipHash: string): string {
    this.rotateIfDue();
    const now = this.clock.now();
    const payload: Payload = { n: randomUUID(), iat: now, exp: now + this.ttlMs, ip: ipHash };
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${body}.${this.sign(body, this.key)}`;
  }

  verify(token: unknown, ipHash: string): TokenResult {
    this.rotateIfDue();
    if (typeof token !== "string" || token.length > MAX_TOKEN_LENGTH) {
      return { ok: false, reason: "malformed" };
    }
    const [body, signature, ...rest] = token.split(".");
    if (!body || !signature || rest.length > 0) return { ok: false, reason: "malformed" };

    // Check the signature BEFORE parsing, so we never parse attacker JSON.
    const now = this.clock.now();
    const previousStillValid = this.previousKey !== null && now - this.rotatedAt <= this.ttlMs;
    const signedByUs =
      safeEqual(signature, this.sign(body, this.key)) ||
      (previousStillValid && this.previousKey !== null && safeEqual(signature, this.sign(body, this.previousKey)));
    if (!signedByUs) return { ok: false, reason: "bad_signature" };

    let payload: Payload;
    try {
      payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
    } catch {
      return { ok: false, reason: "malformed" };
    }
    if (now >= payload.exp) return { ok: false, reason: "expired" };
    if (payload.ip !== ipHash) return { ok: false, reason: "ip_mismatch" };

    if (this.usedNonces.has(payload.n)) return { ok: false, reason: "replayed" };
    if (this.usedNonces.size >= this.maxTrackedNonces) this.dropExpiredNonces();
    if (this.usedNonces.size >= this.maxTrackedNonces) return { ok: false, reason: "replayed" };
    this.usedNonces.set(payload.n, payload.exp);
    return { ok: true };
  }

  private sign(body: string, key: Buffer): string {
    return createHmac("sha256", key).update(body).digest("base64url");
  }

  private rotateIfDue(): void {
    const now = this.clock.now();
    if (now - this.rotatedAt < DAY_MS) return;
    this.previousKey = this.key;
    this.key = randomBytes(32);
    this.rotatedAt = now;
    this.dropExpiredNonces();
  }

  private dropExpiredNonces(): void {
    const now = this.clock.now();
    for (const [nonce, exp] of this.usedNonces) {
      if (exp <= now) this.usedNonces.delete(nonce);
    }
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
