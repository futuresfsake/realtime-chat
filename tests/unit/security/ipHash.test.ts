import { describe, expect, it } from "vitest";
import { FakeClock } from "../../../src/lib/clock.js";
import { createIpHasher, ipHashPrefix } from "../../../src/security/ipHash.js";

const DAY = 24 * 60 * 60 * 1000;
const SECRET = "test-only-".padEnd(32, "x"); // not a real secret

describe.each([
  ["random in-memory key", undefined],
  ["key derived from IP_HASH_SECRET", SECRET],
])("createIpHasher (%s)", (_name, secret) => {
  it("gives the same hash for the same IP on the same day", () => {
    const hasher = createIpHasher({ clock: new FakeClock(DAY), secret });
    expect(hasher.hash("203.0.113.7")).toBe(hasher.hash("203.0.113.7"));
  });

  it("gives different hashes for different IPs", () => {
    const hasher = createIpHasher({ clock: new FakeClock(DAY), secret });
    expect(hasher.hash("203.0.113.7")).not.toBe(hasher.hash("203.0.113.8"));
  });

  it("returns 64 hex characters that do not contain the IP", () => {
    const hash = createIpHasher({ clock: new FakeClock(DAY), secret }).hash("203.0.113.7");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("203.0.113.7");
  });

  it("changes after 24 hours, so old hashes cannot be linked", () => {
    const clock = new FakeClock(DAY);
    const hasher = createIpHasher({ clock, secret });
    const before = hasher.hash("203.0.113.7");
    clock.advance(DAY);
    expect(hasher.hash("203.0.113.7")).not.toBe(before);
  });
});

describe("createIpHasher with a secret", () => {
  it("survives a restart within the same day", () => {
    const first = createIpHasher({ clock: new FakeClock(DAY + 5), secret: SECRET });
    const second = createIpHasher({ clock: new FakeClock(DAY + 9999), secret: SECRET });
    expect(first.hash("203.0.113.7")).toBe(second.hash("203.0.113.7"));
  });

  it("differs between secrets", () => {
    const a = createIpHasher({ clock: new FakeClock(DAY), secret: SECRET });
    const b = createIpHasher({ clock: new FakeClock(DAY), secret: `${SECRET}x` });
    expect(a.hash("203.0.113.7")).not.toBe(b.hash("203.0.113.7"));
  });
});

describe("ipHashPrefix", () => {
  it("keeps only the first 8 characters", () => {
    expect(ipHashPrefix("abcdef0123456789")).toBe("abcdef01");
  });
});
