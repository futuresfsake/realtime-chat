import { describe, expect, it } from "vitest";
import { clientIp } from "../../../src/security/clientIp.js";

describe("clientIp", () => {
  it("uses the socket address when no proxy is trusted", () => {
    expect(clientIp("1.1.1.1", "203.0.113.7", 0)).toBe("203.0.113.7");
  });

  it("uses the rightmost forwarded entry behind one proxy", () => {
    expect(clientIp("203.0.113.7", "10.0.0.1", 1)).toBe("203.0.113.7");
  });

  it("ignores entries a client spoofed in front of the real one", () => {
    expect(clientIp("6.6.6.6, 9.9.9.9, 203.0.113.7", "10.0.0.1", 1)).toBe("203.0.113.7");
  });

  it("respects the hop count with several proxies", () => {
    expect(clientIp("203.0.113.7, 10.0.0.2", "10.0.0.1", 2)).toBe("203.0.113.7");
  });

  it("falls back to the first entry when there are fewer entries than hops", () => {
    expect(clientIp("203.0.113.7", "10.0.0.1", 3)).toBe("203.0.113.7");
  });

  it("falls back to the socket address when the header is missing or empty", () => {
    expect(clientIp(undefined, "10.0.0.1", 1)).toBe("10.0.0.1");
    expect(clientIp(" , ", "10.0.0.1", 1)).toBe("10.0.0.1");
  });

  it("accepts a repeated header (array form)", () => {
    expect(clientIp(["6.6.6.6", "203.0.113.7"], "10.0.0.1", 1)).toBe("203.0.113.7");
  });

  it("strips the IPv4-in-IPv6 prefix", () => {
    expect(clientIp(undefined, "::ffff:203.0.113.7", 0)).toBe("203.0.113.7");
  });

  it("returns a constant when nothing is known", () => {
    expect(clientIp(undefined, undefined, 0)).toBe("unknown");
  });
});
