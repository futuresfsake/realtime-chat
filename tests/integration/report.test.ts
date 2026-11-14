import { afterEach, describe, expect, it } from "vitest";
import { arrivesWithin, command, connect, next, pair, send, startServer } from "./helpers.js";
import type { Matched, TestServer } from "./helpers.js";

let server: TestServer;
afterEach(async () => {
  await server?.close();
});

type Socket = Parameters<typeof command>[0];
type Info = Record<string, any>;

const DAY = 24 * 60 * 60 * 1000;
const ENV = { TRUST_PROXY_HOPS: "1" }; // so each test client can be a different address
const from = (address: string) => ({ forwardedFor: address });
const start = (s: Socket, prefs: unknown = {}) => command(s, "session:start", prefs);
const report = (s: Socket, payload: unknown) => s.timeout(2000).emitWithAck("session:report", payload);

// `reporter` and `target` meet, on different addresses.
async function meet(reporterIp: string, targetIp: string) {
  return pair(server, { a: from(reporterIp), b: from(targetIp) });
}

describe("reporting a stranger (US-18)", () => {
  it("ends the chat for both, tells the reporter it was sent, and tells the other only that it ended", async () => {
    server = await startServer(ENV);
    const { a, b } = await meet("1.0.0.1", "1.0.0.2");
    const endedA = next<Info>(a, "session:ended");
    const endedB = next<Info>(b, "session:ended");
    expect(await report(a, { reason: "harassment" })).toEqual({ ok: true });
    expect((await endedA).reason).toBe("reported");
    expect((await endedB).reason).toBe("partner_left"); // never "you were reported"
    expect(await send(a, "anyone?")).toEqual({ ok: false, error: { code: "NOT_IN_SESSION" } });
    expect(await send(b, "anyone?")).toEqual({ ok: false, error: { code: "NOT_IN_SESSION" } });
  });

  it("keeps the two apart: they are never matched with each other again", async () => {
    server = await startServer(ENV);
    const { a, b } = await meet("1.0.0.1", "1.0.0.2");
    await report(a, { reason: "spam" });
    await start(a);
    await start(b);
    expect(await arrivesWithin(a, "session:matched", 300)).toBe(false);
    expect(await arrivesWithin(b, "session:matched", 100)).toBe(false);
  });

  it.each(["harassment", "sexual", "spam", "hate", "minor", "threats", "other"])("accepts the category %s", async (reason) => {
    server = await startServer(ENV);
    const { a } = await meet("1.0.0.1", "1.0.0.2");
    expect(await report(a, { reason })).toEqual({ ok: true });
  });

  it.each([
    ["a category that does not exist", { reason: "rude" }],
    ["free text", { reason: "other", text: "he asked for my phone number" }],
    ["a transcript", { reason: "other", transcript: ["hi", "send nudes"] }],
    ["no reason", {}],
    ["a bare string", "harassment"],
    ["null", null],
  ])("refuses %s with VALIDATION and leaves the chat alone", async (_name, payload) => {
    server = await startServer(ENV);
    const { a, b } = await meet("1.0.0.1", "1.0.0.2");
    expect(await report(a, payload)).toEqual({ ok: false, error: { code: "VALIDATION" } });
    expect(await send(a, "still here")).toEqual({ ok: true });
    void b;
  });

  it("refuses a report from someone who is not in a chat, without disturbing their search", async () => {
    server = await startServer(ENV);
    const a = await connect(server, from("1.0.0.1"));
    expect(await report(a, { reason: "spam" })).toEqual({ ok: false, error: { code: "NOT_IN_SESSION" } });
    await start(a);
    expect(await report(a, { reason: "spam" })).toEqual({ ok: false, error: { code: "NOT_IN_SESSION" } });
    // Still searching: the next person is paired with them.
    const b = await connect(server, from("1.0.0.2"));
    const matched = next<Matched>(a, "session:matched");
    await start(b);
    expect(await matched).toBeDefined();
  });

  it("allows three reports an hour from one address, then says slow down", async () => {
    server = await startServer(ENV);
    const reporter = await connect(server, from("2.0.0.1"));
    for (let i = 1; i <= 3; i++) {
      const target = await connect(server, from(`2.0.1.${i}`));
      const matched = next<Matched>(reporter, "session:matched");
      await start(reporter);
      await start(target);
      await matched;
      const ack = await report(reporter, { reason: "spam" });
      expect(ack, `report ${i}`).toEqual({ ok: true });
    }
    const fourth = await connect(server, from("2.0.1.4"));
    const matched = next<Matched>(reporter, "session:matched");
    await start(reporter);
    await start(fourth);
    await matched;
    const refused = await report(reporter, { reason: "spam" });
    expect(refused.ok).toBe(false);
    expect(refused.error.code).toBe("RATE_LIMITED");
    // The refused report did not end the chat: they are still in it.
    expect(await start(reporter)).toEqual({ ok: false, error: { code: "INVALID_STATE" } });
  });
});

// B is reported by three different people, one after another.
async function reportThreeTimes(target: Socket, reporters: string[]): Promise<void> {
  for (const ip of reporters) {
    const reporter = await connect(server, from(ip));
    const matched = next<Matched>(target, "session:matched");
    await start(target);
    await start(reporter);
    await matched;
    expect(await report(reporter, { reason: "harassment" })).toEqual({ ok: true });
  }
}

describe("temporary blocks (US-20)", () => {
  it("three different people reporting the same connection block it from matching", async () => {
    server = await startServer(ENV);
    const bad = await connect(server, from("9.9.9.9"));
    await reportThreeTimes(bad, ["3.0.0.1", "3.0.0.2", "3.0.0.3"]);
    expect(await start(bad)).toEqual({ ok: false, error: { code: "BANNED" } });
    expect(await command(bad, "session:next")).toEqual({ ok: false, error: { code: "BANNED" } });
  });

  it("two reports are not enough", async () => {
    server = await startServer(ENV);
    const bad = await connect(server, from("9.9.9.9"));
    await reportThreeTimes(bad, ["3.0.0.1", "3.0.0.2"]);
    expect(await start(bad)).toEqual({ ok: true });
  });

  it("the same person cannot meet the same connection again from a new tab, so cannot report it twice", async () => {
    server = await startServer(ENV);
    const bad = await connect(server, from("9.9.9.9"));
    const tab1 = await connect(server, from("3.0.0.1"));
    const matched = next<Matched>(bad, "session:matched");
    await start(bad);
    await start(tab1);
    await matched;
    await report(tab1, { reason: "harassment" });
    // A new tab from the same address is kept apart from them too.
    const tab2 = await connect(server, from("3.0.0.1"));
    await start(bad);
    const heard = arrivesWithin(bad, "session:matched", 300);
    await start(tab2);
    expect(await heard).toBe(false);
  });

  it("a blocked connection is never matched, even by someone who was already waiting", async () => {
    server = await startServer(ENV);
    const bad = await connect(server, from("9.9.9.9"));
    await reportThreeTimes(bad, ["3.0.0.1", "3.0.0.2"]);
    // bad's neighbour (same address) is searching when the third report lands.
    const neighbour = await connect(server, from("9.9.9.9"));
    await start(neighbour, { interests: ["gaming"] });
    const reporter = await connect(server, from("3.0.0.3"));
    const matched = next<Matched>(bad, "session:matched");
    await start(bad);
    await start(reporter);
    await matched;
    const told = next<Info>(neighbour, "session:ended");
    await report(reporter, { reason: "threats" });
    expect((await told).reason).toBe("blocked");
    expect(await start(neighbour)).toEqual({ ok: false, error: { code: "BANNED" } });
  });

  it("lasts 24 hours and then ends by itself", async () => {
    server = await startServer(ENV);
    const bad = await connect(server, from("9.9.9.9"));
    await reportThreeTimes(bad, ["3.0.0.1", "3.0.0.2", "3.0.0.3"]);
    expect(await start(bad)).toEqual({ ok: false, error: { code: "BANNED" } });
    server.clock.advance(DAY - 1);
    expect(await start(bad)).toEqual({ ok: false, error: { code: "BANNED" } });
    server.clock.advance(1);
    expect(await start(bad)).toEqual({ ok: true });
  });

  it("does not affect other people", async () => {
    server = await startServer(ENV);
    const bad = await connect(server, from("9.9.9.9"));
    await reportThreeTimes(bad, ["3.0.0.1", "3.0.0.2", "3.0.0.3"]);
    const other = await connect(server, from("4.0.0.1"));
    expect(await start(other)).toEqual({ ok: true });
    const another = await connect(server, from("4.0.0.2"));
    const matched = next<Matched>(other, "session:matched");
    await start(another);
    expect(await matched).toBeDefined();
  });

  it("the count starts again once someone is blocked", async () => {
    server = await startServer(ENV);
    const bad = await connect(server, from("9.9.9.9"));
    await reportThreeTimes(bad, ["3.0.0.1", "3.0.0.2", "3.0.0.3"]);
    server.clock.advance(DAY + 1); // the block is over, and so is the report window
    await reportThreeTimes(bad, ["3.0.0.4", "3.0.0.5"]);
    expect(await start(bad)).toEqual({ ok: true }); // two new reports are not three
  });
});

describe("what is logged about reports", () => {
  it("records the category and a short hash prefix, flags minor and threats, and nothing else", async () => {
    server = await startServer(ENV);
    const { a } = await meet("1.0.0.1", "1.0.0.2");
    await report(a, { reason: "minor" });
    const b = await connect(server, from("1.0.0.3"));
    const c = await connect(server, from("1.0.0.4"));
    const matched = next<Matched>(b, "session:matched");
    await start(b);
    await start(c);
    await matched;
    await report(b, { reason: "harassment" });

    const reportLines = server.logs.filter((l) => JSON.parse(l).event === "report");
    expect(reportLines).toHaveLength(2);
    for (const line of reportLines) {
      const entry = JSON.parse(line);
      expect(Object.keys(entry.data).sort()).toEqual(["reason", "targetIpHashPrefix"]);
      expect(entry.data.targetIpHashPrefix).toMatch(/^[0-9a-f]{8}$/);
    }
    // Only the "minor" report is a priority; "harassment" is not.
    const priority = server.logs.filter((l) => JSON.parse(l).event === "report_priority");
    expect(priority).toHaveLength(1);
    expect(JSON.parse(priority[0]!).data).toEqual({ reason: "minor" });

    const all = server.logs.join("\n");
    for (const address of ["1.0.0.1", "1.0.0.2", "1.0.0.3", "1.0.0.4"]) expect(all).not.toContain(address);
    expect(all).not.toMatch(/[0-9a-f]{64}/); // no full hash
  });

  it("logs a block with a hash prefix only", async () => {
    server = await startServer(ENV);
    const bad = await connect(server, from("9.9.9.9"));
    await reportThreeTimes(bad, ["3.0.0.1", "3.0.0.2", "3.0.0.3"]);
    const line = server.logs.find((l) => JSON.parse(l).event === "connection_blocked");
    expect(line).toBeDefined();
    expect(JSON.parse(line!).data.ipHashPrefix).toMatch(/^[0-9a-f]{8}$/);
    expect(server.logs.join("\n")).not.toContain("9.9.9.9");
  });
});
