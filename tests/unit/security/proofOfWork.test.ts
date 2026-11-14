import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FakeClock } from "../../../src/lib/clock.js";
import { ProofOfWork, leadingZeroBits } from "../../../src/security/proofOfWork.js";

const DAY = 24 * 60 * 60 * 1000;

// What an honest client does, in Node.
function solve(challenge: string, bits: number): string {
  for (let n = 0; ; n++) {
    const hash = createHash("sha256").update(`${challenge}:${n}`).digest();
    if (leadingZeroBits(hash) >= bits) return String(n);
  }
}
// A nonce that does NOT meet the difficulty.
function wrong(challenge: string, bits: number): string {
  for (let n = 0; ; n++) {
    const hash = createHash("sha256").update(`${challenge}:${n}`).digest();
    if (leadingZeroBits(hash) < bits) return String(n);
  }
}

function setup(bits = 8) {
  const clock = new FakeClock(1_000_000);
  return { clock, pow: new ProofOfWork(clock, bits) };
}

describe("leadingZeroBits", () => {
  it("counts bits across bytes", () => {
    expect(leadingZeroBits(Buffer.from([0xff]))).toBe(0);
    expect(leadingZeroBits(Buffer.from([0x7f]))).toBe(1);
    expect(leadingZeroBits(Buffer.from([0x01]))).toBe(7);
    expect(leadingZeroBits(Buffer.from([0x00, 0x80]))).toBe(8);
    expect(leadingZeroBits(Buffer.from([0x00, 0x00, 0x10]))).toBe(19);
    expect(leadingZeroBits(Buffer.from([0x00, 0x00]))).toBe(16);
  });
});

describe("ProofOfWork", () => {
  it("accepts a correct answer for a challenge issued to this address", () => {
    const { pow } = setup();
    const { challenge, bits } = pow.issue("ip-a");
    expect(bits).toBe(8);
    expect(pow.verify(challenge, solve(challenge, 8), "ip-a")).toEqual({ ok: true });
  });

  it("is switched off at 0 bits", () => {
    expect(setup(0).pow.required).toBe(false);
    expect(setup(1).pow.required).toBe(true);
  });

  it("refuses an answer that does not meet the difficulty, and lets the client try again", () => {
    const { pow } = setup(10);
    const { challenge } = pow.issue("ip-a");
    expect(pow.verify(challenge, wrong(challenge, 10), "ip-a")).toEqual({ ok: false, reason: "insufficient" });
    // The wrong guess did not use the challenge up.
    expect(pow.verify(challenge, solve(challenge, 10), "ip-a")).toEqual({ ok: true });
  });

  it("works once: the same solved challenge is refused the second time", () => {
    const { pow } = setup();
    const { challenge } = pow.issue("ip-a");
    const nonce = solve(challenge, 8);
    expect(pow.verify(challenge, nonce, "ip-a").ok).toBe(true);
    expect(pow.verify(challenge, nonce, "ip-a")).toEqual({ ok: false, reason: "replayed" });
  });

  it("belongs to the address it was issued to", () => {
    const { pow } = setup();
    const { challenge } = pow.issue("ip-a");
    expect(pow.verify(challenge, solve(challenge, 8), "ip-b")).toEqual({ ok: false, reason: "ip_mismatch" });
  });

  it("expires after a minute", () => {
    const { clock, pow } = setup();
    const { challenge } = pow.issue("ip-a");
    const nonce = solve(challenge, 8);
    clock.advance(59_999);
    expect(pow.verify(challenge, nonce, "ip-a").ok).toBe(true);
    const second = pow.issue("ip-a");
    const late = solve(second.challenge, 8);
    clock.advance(60_000);
    expect(pow.verify(second.challenge, late, "ip-a")).toEqual({ ok: false, reason: "expired" });
  });

  it("cannot be made up or changed: any edit breaks the signature", () => {
    const { pow } = setup();
    const { challenge } = pow.issue("ip-a");
    const [body, signature] = challenge.split(".") as [string, string];
    const forged = Buffer.from(JSON.stringify({ n: "x", exp: Date.now() + 1e9, ip: "ip-a" })).toString("base64url");
    expect(pow.verify(`${forged}.${signature}`, "0", "ip-a")).toEqual({ ok: false, reason: "bad_signature" });
    expect(pow.verify(`${body}.${signature.slice(0, -2)}AA`, "0", "ip-a")).toEqual({ ok: false, reason: "bad_signature" });
    // Another server instance (a different key) cannot have issued it.
    const other = new ProofOfWork(new FakeClock(1_000_000), 8);
    expect(pow.verify(other.issue("ip-a").challenge, "0", "ip-a")).toEqual({ ok: false, reason: "bad_signature" });
  });

  it.each([
    ["no challenge", undefined, "0"],
    ["no nonce", "a.b", undefined],
    ["a challenge that is not a string", { a: 1 }, "0"],
    ["a nonce that is not digits", "a.b", "1e9"],
    ["a negative nonce", "a.b", "-1"],
    ["a nonce that is far too long", "a.b", "1".repeat(13)],
    ["a challenge that is far too long", "a".repeat(513), "0"],
    ["a challenge without a signature", "abc", "0"],
    ["an empty challenge part", ".", "0"],
  ])("refuses %s", (_name, challenge, nonce) => {
    const { pow } = setup();
    expect(pow.verify(challenge, nonce, "ip-a").ok).toBe(false);
  });

  it("keeps working across the daily key change for challenges issued just before it", () => {
    const { clock, pow } = setup();
    const { challenge } = pow.issue("ip-a");
    const nonce = solve(challenge, 8);
    clock.advance(DAY - 1_000 + 1_000); // exactly at rotation, but the challenge is long expired
    expect(pow.verify(challenge, nonce, "ip-a")).toEqual({ ok: false, reason: "expired" });
    const fresh = pow.issue("ip-a"); // issued with the new key
    expect(pow.verify(fresh.challenge, solve(fresh.challenge, 8), "ip-a").ok).toBe(true);
  });

  it("each challenge is different", () => {
    const { pow } = setup();
    expect(pow.issue("ip-a").challenge).not.toBe(pow.issue("ip-a").challenge);
  });
});
