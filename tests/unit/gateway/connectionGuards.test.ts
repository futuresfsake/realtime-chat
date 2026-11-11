import { describe, expect, it } from "vitest";
import { IpSocketCap, checkOrigin } from "../../../src/gateway/connectionGuards.js";

describe("checkOrigin", () => {
  const allowed = ["https://chat.example", "http://localhost:3000"];

  it("accepts an exact match", () => {
    expect(checkOrigin("https://chat.example", allowed)).toBe(true);
    expect(checkOrigin("http://localhost:3000", allowed)).toBe(true);
  });

  it("refuses other origins", () => {
    expect(checkOrigin("https://evil.example", allowed)).toBe(false);
  });

  it("refuses a missing or null origin", () => {
    expect(checkOrigin(undefined, allowed)).toBe(false);
    expect(checkOrigin("", allowed)).toBe(false);
    expect(checkOrigin("null", allowed)).toBe(false);
  });

  it("refuses look-alikes: subdomain, suffix, scheme, port, trailing slash", () => {
    expect(checkOrigin("https://evil.chat.example", allowed)).toBe(false);
    expect(checkOrigin("https://chat.example.evil.com", allowed)).toBe(false);
    expect(checkOrigin("http://chat.example", allowed)).toBe(false);
    expect(checkOrigin("https://chat.example:8443", allowed)).toBe(false);
    expect(checkOrigin("https://chat.example/", allowed)).toBe(false);
  });
});

describe("IpSocketCap", () => {
  it("allows up to the maximum and refuses one more", () => {
    const cap = new IpSocketCap(5);
    for (let i = 0; i < 5; i++) expect(cap.add("ip-a", `s${i}`)).toBe(true);
    expect(cap.add("ip-a", "s5")).toBe(false);
    expect(cap.count("ip-a")).toBe(5);
  });

  it("frees a slot when a socket leaves", () => {
    const cap = new IpSocketCap(1);
    cap.add("ip-a", "s1");
    cap.remove("ip-a", "s1");
    expect(cap.add("ip-a", "s2")).toBe(true);
  });

  it("tracks each IP hash independently", () => {
    const cap = new IpSocketCap(1);
    expect(cap.add("ip-a", "s1")).toBe(true);
    expect(cap.add("ip-b", "s2")).toBe(true);
  });

  it("ignores removal of unknown sockets", () => {
    const cap = new IpSocketCap(1);
    cap.remove("ip-a", "nope");
    expect(cap.count("ip-a")).toBe(0);
  });
});
