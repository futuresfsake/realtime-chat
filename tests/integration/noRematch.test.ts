import { afterEach, describe, expect, it } from "vitest";
import { FakeCountryLookup } from "../../src/geo/countryLookup.js";
import { arrivesWithin, command, connect, dropConnection, next, pair, startServer } from "./helpers.js";
import type { Matched, TestServer } from "./helpers.js";

let server: TestServer;
afterEach(async () => {
  await server?.close();
});

const DAY = 24 * 60 * 60 * 1000;
const start = (s: Parameters<typeof command>[0]) => command(s, "session:start");

describe("no rematch", () => {
  it("someone you skip is not handed back to you, and the skipper meets someone else", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    await command(a, "session:next");
    await start(b); // both searching now: they must not meet each other
    expect(await arrivesWithin(a, "session:matched", 300)).toBe(false);
    expect(await arrivesWithin(b, "session:matched", 100)).toBe(false);

    const c = await connect(server);
    const matched = next<Matched>(a, "session:matched");
    await start(c);
    expect((await matched).partnerName).toBeTruthy(); // a (waiting longest) gets c, not b
  });

  it("someone who walks away with /leave is not handed back either", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    await command(a, "session:leave");
    await start(a);
    await start(b);
    expect(await arrivesWithin(a, "session:matched", 300)).toBe(false);
  });

  it("applies to the person who was skipped as well as the one who skipped", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    await command(a, "session:next");
    const c = await connect(server);
    await start(c);
    await start(b); // b was skipped: b is not matched to a (already in a chat with c) and cannot be re-paired later
    await command(a, "session:leave");
    await start(a);
    expect(await arrivesWithin(a, "session:matched", 300)).toBe(false); // a and b still blocked
  });

  it("lets the two meet again after 24 hours", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    await command(a, "session:leave");
    server.clock.advance(DAY + 1);
    const matched = next<Matched>(a, "session:matched");
    await start(a);
    await start(b);
    expect(await matched).toBeDefined();
  });

  it("is not triggered by a dropped connection or a timeout: nobody chose to leave", async () => {
    server = await startServer({}, { reconnectGraceMs: 150 });
    const { a, b } = await pair(server);
    const ended = next(a, "session:ended");
    dropConnection(b); // b never comes back: the chat times out
    await ended;
    const b2 = await connect(server);
    const matched = next<Matched>(a, "session:matched");
    await start(a);
    await start(b2);
    expect(await matched).toBeDefined();
  });

  it("does not block neighbours on the same address, only the two who parted", async () => {
    server = await startServer();
    const { a, b } = await pair(server); // all test clients share one address
    await command(a, "session:next");
    const c = await connect(server);
    const matchedA = next<Matched>(a, "session:matched");
    await start(c);
    expect(await matchedA).toBeDefined(); // a and c share an address with the blocked pair, yet pair freely
    void b;
  });

  it("recognises people by address across a reconnect: a new tab does not get around it", async () => {
    const countries = new FakeCountryLookup({});
    server = await startServer({ TRUST_PROXY_HOPS: "1" }, {}, countries);
    const a = await connect(server, { forwardedFor: "5.5.5.5" });
    const b = await connect(server, { forwardedFor: "6.6.6.6" });
    const first = next<Matched>(a, "session:matched");
    await start(a);
    await start(b);
    await first;
    await command(a, "session:next");
    b.disconnect();

    // b opens a fresh connection from the same address, and a is still looking.
    const b2 = await connect(server, { forwardedFor: "6.6.6.6" });
    const heard = arrivesWithin(a, "session:matched", 300);
    await start(b2);
    expect(await heard).toBe(false);
  });

  it("never logs who was blocked", async () => {
    server = await startServer({ TRUST_PROXY_HOPS: "1" }, {}, new FakeCountryLookup({}));
    const a = await connect(server, { forwardedFor: "5.5.5.5" });
    const b = await connect(server, { forwardedFor: "6.6.6.6" });
    const matched = next<Matched>(a, "session:matched");
    await start(a);
    await start(b);
    await matched;
    await command(a, "session:next");
    const all = server.logs.join("\n");
    expect(all).not.toContain("5.5.5.5");
    expect(all).not.toContain("6.6.6.6");
    expect(all).not.toMatch(/rematch/i);
  });
});
