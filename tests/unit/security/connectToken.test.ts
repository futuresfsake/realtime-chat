import { describe, expect, it } from "vitest";
import { FakeClock } from "../../../src/lib/clock.js";
import { ConnectTokens } from "../../../src/security/connectToken.js";

const TTL = 30_000;
const DAY = 24 * 60 * 60 * 1000;

describe("ConnectTokens", () => {
  it("accepts a fresh token from the same IP hash", () => {
    const tokens = new ConnectTokens(new FakeClock(), TTL);
    expect(tokens.verify(tokens.issue("ip-a"), "ip-a")).toEqual({ ok: true });
  });

  it("refuses a token used twice (replay)", () => {
    const tokens = new ConnectTokens(new FakeClock(), TTL);
    const token = tokens.issue("ip-a");
    tokens.verify(token, "ip-a");
    expect(tokens.verify(token, "ip-a")).toEqual({ ok: false, reason: "replayed" });
  });

  it("refuses an expired token", () => {
    const clock = new FakeClock();
    const tokens = new ConnectTokens(clock, TTL);
    const token = tokens.issue("ip-a");
    clock.advance(TTL - 1);
    const stillValid = tokens.issue("ip-a");
    clock.advance(1);
    expect(tokens.verify(token, "ip-a")).toEqual({ ok: false, reason: "expired" });
    expect(tokens.verify(stillValid, "ip-a")).toEqual({ ok: true });
  });

  it("refuses a token presented from a different IP hash", () => {
    const tokens = new ConnectTokens(new FakeClock(), TTL);
    expect(tokens.verify(tokens.issue("ip-a"), "ip-b")).toEqual({ ok: false, reason: "ip_mismatch" });
  });

  it("refuses a tampered payload", () => {
    const tokens = new ConnectTokens(new FakeClock(), TTL);
    const [, signature] = tokens.issue("ip-a").split(".");
    const forged = Buffer.from(JSON.stringify({ n: "x", iat: 0, exp: 9e15, ip: "ip-b" })).toString("base64url");
    expect(tokens.verify(`${forged}.${signature}`, "ip-b")).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("refuses a token signed by another server instance", () => {
    const clock = new FakeClock();
    const other = new ConnectTokens(clock, TTL);
    const tokens = new ConnectTokens(clock, TTL);
    expect(tokens.verify(other.issue("ip-a"), "ip-a")).toEqual({ ok: false, reason: "bad_signature" });
  });

  it.each([undefined, null, 42, {}, "", "abc", "a.b.c", "x".repeat(600)])("refuses malformed input %#", (bad) => {
    const tokens = new ConnectTokens(new FakeClock(), TTL);
    const result = tokens.verify(bad, "ip-a");
    expect(result.ok).toBe(false);
  });

  it("rotates its key daily but honours tokens issued just before rotation", () => {
    const clock = new FakeClock();
    const tokens = new ConnectTokens(clock, TTL);
    clock.advance(DAY - 1000);
    const justBefore = tokens.issue("ip-a");
    clock.advance(2000); // rotation happens here
    expect(tokens.verify(justBefore, "ip-a")).toEqual({ ok: true });
  });

  it("stops honouring the old key once its tokens would have expired anyway", () => {
    const clock = new FakeClock();
    const tokens = new ConnectTokens(clock, TTL);
    const old = tokens.issue("ip-a");
    clock.advance(DAY);
    tokens.issue("ip-a"); // triggers rotation
    clock.advance(TTL + 1);
    expect(tokens.verify(old, "ip-a")).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("keeps its replay memory bounded", () => {
    const clock = new FakeClock();
    const tokens = new ConnectTokens(clock, TTL, 2);
    expect(tokens.verify(tokens.issue("a"), "a").ok).toBe(true);
    expect(tokens.verify(tokens.issue("a"), "a").ok).toBe(true);
    expect(tokens.verify(tokens.issue("a"), "a").ok).toBe(false); // full: fail closed
    clock.advance(TTL); // earlier nonces expire and are dropped
    expect(tokens.verify(tokens.issue("a"), "a").ok).toBe(true);
  });
});
