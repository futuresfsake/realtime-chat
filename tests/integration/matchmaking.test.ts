import { afterEach, describe, expect, it } from "vitest";
import { FakeCountryLookup } from "../../src/geo/countryLookup.js";
import { arrivesWithin, command, connect, next, startServer } from "./helpers.js";
import type { Matched, TestServer } from "./helpers.js";

let server: TestServer;
afterEach(async () => {
  await server?.close();
});

type Info = Record<string, any>;
const start = (s: Parameters<typeof command>[0], prefs: unknown = {}) => command(s, "session:start", prefs);

// Quick sweeps and a short interest wait, so the fallback can be tested for real.
const FAST = { matchSweepMs: 25, interestWaitMs: 1000 };

describe("interests (US-14)", () => {
  it("pairs two people who share an interest at once, and tells both which", async () => {
    server = await startServer();
    const a = await connect(server);
    const b = await connect(server);
    const matchedA = next<Matched>(a, "session:matched");
    const matchedB = next<Matched>(b, "session:matched");
    await start(a, { interests: ["gaming", "music"] });
    await start(b, { interests: ["music", "travel"] });
    const [infoA, infoB] = await Promise.all([matchedA, matchedB]);
    expect(infoA.sessionId).toBe(infoB.sessionId);
    expect(infoA.sharedInterests).toEqual(["music"]);
    expect(infoB.sharedInterests).toEqual(["music"]);
  });

  it("an interest beats a random stranger: gaming meets gaming while music keeps waiting", async () => {
    server = await startServer();
    const [music, gamer1, gamer2] = [await connect(server), await connect(server), await connect(server)];
    await start(music, { interests: ["music"] });
    await start(gamer1, { interests: ["gaming"] });
    const musicHears = arrivesWithin(music, "session:matched", 200);
    const matched = next<Matched>(gamer1, "session:matched");
    await start(gamer2, { interests: ["gaming"] });
    expect((await matched).sharedInterests).toEqual(["gaming"]);
    expect(await musicHears).toBe(false);
  });

  it("a person with no interests is not paired with someone still waiting for a shared interest", async () => {
    server = await startServer();
    const [picky, plain] = [await connect(server), await connect(server)];
    await start(picky, { interests: ["gaming"] });
    const heard = arrivesWithin(plain, "session:matched", 250);
    await start(plain, {});
    expect(await heard).toBe(false);
  });

  it("works on /next too: skipping looks again with the interests given", async () => {
    server = await startServer();
    const [a, b, c] = [await connect(server), await connect(server), await connect(server)];
    const first = next<Matched>(a, "session:matched");
    await start(a, { interests: ["gaming"] });
    await start(b, { interests: ["gaming"] });
    await first;
    await start(c, { interests: ["music"] });
    const matched = next<Matched>(a, "session:matched");
    await command(a, "session:next", { interests: ["music"] });
    expect((await matched).sharedInterests).toEqual(["music"]);
  });

  it.each([
    ["an interest that is not on the list", { interests: ["politics"] }],
    ["free text", { interests: ["my phone is 0917"] }],
    ["six interests", { interests: ["anime", "art", "books", "cars", "coding", "dance"] }],
    ["a repeated interest", { interests: ["anime", "anime"] }],
    ["interests that are not a list", { interests: "anime" }],
    ["an unknown scope", { scope: "nearby" }],
    ["a country claimed by the client", { country: "PH" }],
    ["extra fields", { interests: [], admin: true }],
  ])("refuses %s with VALIDATION and does not start a search", async (_name, prefs) => {
    server = await startServer();
    const a = await connect(server);
    expect(await start(a, prefs)).toEqual({ ok: false, error: { code: "VALIDATION" } });
    expect(await start(a, {})).toEqual({ ok: true }); // still idle, so a valid search is accepted
  });
});

describe("fallback to a random stranger (US-16)", () => {
  it("pairs people with different interests once the wait is over, and says nothing is shared", async () => {
    server = await startServer({}, FAST);
    const [a, b] = [await connect(server), await connect(server)];
    const matchedA = next<Matched>(a, "session:matched");
    const matchedB = next<Matched>(b, "session:matched");
    await start(a, { interests: ["gaming"] });
    await start(b, { interests: ["music"] });
    // Not yet: they are still in their interest phase.
    expect(await arrivesWithin(a, "session:matched", 150)).toBe(false);
    server.clock.advance(1000); // the wait is over (the sweep runs every 25 ms)
    const [infoA, infoB] = await Promise.all([matchedA, matchedB]);
    expect(infoA.sessionId).toBe(infoB.sessionId);
    expect(infoA.sharedInterests).toEqual([]);
  });

  it("tells a person who is still alone that the search is now open to anyone", async () => {
    server = await startServer({}, FAST);
    const a = await connect(server);
    await start(a, { interests: ["gaming"] });
    const status = next<Info>(a, "search:status");
    server.clock.advance(1000);
    expect(await status).toEqual({ state: "open" });
    // And they are then paired with whoever arrives without interests.
    const b = await connect(server);
    const matched = next<Matched>(a, "session:matched");
    await start(b, {});
    expect((await matched).sharedInterests).toEqual([]);
  });

  it("does not match someone who gave up (/leave) before the wait ended", async () => {
    server = await startServer({}, FAST);
    const [a, b] = [await connect(server), await connect(server)];
    await start(a, { interests: ["gaming"] });
    await start(b, { interests: ["music"] });
    await command(a, "session:leave");
    const heard = arrivesWithin(b, "session:matched", 300);
    server.clock.advance(1000);
    expect(await heard).toBe(false);
  });

  it("does not match someone who disconnected", async () => {
    server = await startServer({}, FAST);
    const [a, b] = [await connect(server), await connect(server)];
    await start(a, { interests: ["gaming"] });
    await start(b, { interests: ["music"] });
    a.disconnect();
    const heard = arrivesWithin(b, "session:matched", 300);
    server.clock.advance(1000);
    expect(await heard).toBe(false);
  });

  it("a chat that started by fallback still gets its key exchange deadline", async () => {
    server = await startServer({}, { ...FAST, keyExchangeTimeoutMs: 200 });
    const [a, b] = [await connect(server), await connect(server)];
    await start(a, { interests: ["gaming"] });
    await start(b, { interests: ["music"] });
    const ended = next<Info>(a, "session:ended");
    server.clock.advance(1000);
    expect((await ended).reason).toBe("crypto_timeout");
  });
});

describe("country (US-15)", () => {
  const countries = new FakeCountryLookup({ "1.1.1.1": "PH", "1.1.1.2": "PH", "2.2.2.2": "JP", "3.3.3.3": "JP" });
  const env = { TRUST_PROXY_HOPS: "1" };
  const from = (address: string) => ({ forwardedFor: address });

  it("'my country' pairs two people in the same country", async () => {
    server = await startServer(env, {}, countries);
    const [a, b] = [await connect(server, from("1.1.1.1")), await connect(server, from("1.1.1.2"))];
    const matched = next<Matched>(b, "session:matched");
    await start(a, { scope: "local" });
    await start(b, { scope: "local" });
    expect((await matched).partnerName).toBeTruthy();
  });

  it("'my country' is never paired across countries, even with a shared interest or after the fallback", async () => {
    server = await startServer(env, FAST, countries);
    const [ph, jp] = [await connect(server, from("1.1.1.1")), await connect(server, from("2.2.2.2"))];
    await start(ph, { scope: "local", interests: ["gaming"] });
    const heard = arrivesWithin(ph, "session:matched", 300);
    await start(jp, { scope: "world", interests: ["gaming"] });
    expect(await heard).toBe(false);
    server.clock.advance(5000);
    expect(await arrivesWithin(ph, "session:matched", 300)).toBe(false);
  });

  it("worldwide people are matched across countries", async () => {
    server = await startServer(env, {}, countries);
    const [ph, jp] = [await connect(server, from("1.1.1.1")), await connect(server, from("2.2.2.2"))];
    const matched = next<Matched>(ph, "session:matched");
    await start(ph, {});
    await start(jp, { scope: "world" });
    expect(await matched).toBeDefined();
  });

  it("a Japanese worldwide user skips a Filipino 'my country' user and matches the Japanese one", async () => {
    server = await startServer(env, {}, countries);
    const [ph, jp, jp2] = [
      await connect(server, from("1.1.1.1")),
      await connect(server, from("2.2.2.2")),
      await connect(server, from("3.3.3.3")),
    ];
    await start(ph, { scope: "local" });
    const phHears = arrivesWithin(ph, "session:matched", 250);
    const matched = next<Matched>(jp, "session:matched");
    await start(jp, { scope: "world" });
    await start(jp2, { scope: "local" });
    expect(await matched).toBeDefined();
    expect(await phHears).toBe(false);
  });

  it("refuses 'my country' with COUNTRY_UNKNOWN when the country could not be detected, and stays idle", async () => {
    server = await startServer(env, {}, countries);
    const a = await connect(server, from("9.9.9.9")); // not in the table
    expect(await start(a, { scope: "local" })).toEqual({ ok: false, error: { code: "COUNTRY_UNKNOWN" } });
    expect(await command(a, "session:next", { scope: "local" })).toEqual({ ok: false, error: { code: "COUNTRY_UNKNOWN" } });
    expect(await start(a, { scope: "world" })).toEqual({ ok: true }); // worldwide still works
  });

  it("without any country database everyone is unknown, and worldwide matching works as before", async () => {
    server = await startServer();
    const a = await connect(server);
    expect(await start(a, { scope: "local" })).toEqual({ ok: false, error: { code: "COUNTRY_UNKNOWN" } });
    const b = await connect(server);
    const matched = next<Matched>(a, "session:matched");
    await start(a, {});
    await start(b, {});
    expect(await matched).toBeDefined();
  });
});

describe("privacy", () => {
  it("never logs a country, an address or which interests were chosen", async () => {
    const countries = new FakeCountryLookup({ "1.1.1.1": "PH", "2.2.2.2": "JP" });
    server = await startServer({ TRUST_PROXY_HOPS: "1" }, {}, countries);
    const [a, b] = [await connect(server, { forwardedFor: "1.1.1.1" }), await connect(server, { forwardedFor: "2.2.2.2" })];
    const matched = next<Matched>(a, "session:matched");
    await start(a, { interests: ["gaming", "photography"] });
    await start(b, { interests: ["photography"] });
    await matched;
    const all = server.logs.join("\n");
    expect(all).toContain("session_start");
    for (const secret of ["1.1.1.1", "2.2.2.2", "gaming", "photography", '"PH"', '"JP"', "country"]) {
      expect(all, secret).not.toContain(secret);
    }
    // Only how many were shared is recorded.
    expect(server.logs.find((l) => l.includes("session_start"))).toContain('"sharedInterests":1');
  });
});
