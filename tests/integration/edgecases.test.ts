import { afterEach, describe, expect, it } from "vitest";
import { arrivesWithin, command, connect, next, pair, send, startServer } from "./helpers.js";
import type { TestServer } from "./helpers.js";

let server: TestServer;
afterEach(async () => {
  await server?.close();
});

type Info = Record<string, any>;

// US-36: no chat gets stuck or corrupted by awkward timing.
describe("edge cases", () => {
  it("both partners press /next at the same moment: one new session, nothing orphaned", async () => {
    server = await startServer();
    const { a, b, sessionId } = await pair(server);
    const matchedA = next<Info>(a, "session:matched");
    const matchedB = next<Info>(b, "session:matched");

    const [ackA, ackB] = await Promise.all([command(a, "session:next"), command(b, "session:next")]);
    expect(ackA).toEqual({ ok: true });
    expect(ackB).toEqual({ ok: true });

    // They end up together in ONE new session, not in two or in a stale one.
    const [infoA, infoB] = await Promise.all([matchedA, matchedB]);
    expect(infoA.sessionId).toBe(infoB.sessionId);
    expect(infoA.sessionId).not.toBe(sessionId);

    // And it really works, for both directions.
    const toB = next<Info>(b, "chat:message");
    expect(await send(a, { text: "after the double skip" })).toEqual({ ok: true });
    expect((await toB).seq).toBe(1);
  });

  it("a double /next from one client does not create two searches", async () => {
    server = await startServer();
    const { a } = await pair(server);
    const [first, second] = await Promise.all([command(a, "session:next"), command(a, "session:next")]);
    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true }); // already searching: stays searching

    // Two newcomers: only ONE of them can be paired with A.
    server.clock.advance(10_000);
    const c = await connect(server);
    const d = await connect(server);
    const matchedA = next<Info>(a, "session:matched");
    const matchedC = arrivesWithin(c, "session:matched", 300);
    const matchedD = arrivesWithin(d, "session:matched", 300);
    await command(c, "session:start");
    await matchedA.catch(() => {});
    await command(d, "session:start");
    const [gotC, gotD] = await Promise.all([matchedC, matchedD]);
    expect(gotC).toBe(true);
    expect(gotD).toBe(false); // D waits: A is already chatting with C
  });

  it("both partners /leave at the same moment: both end up idle and can start again", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    const [ackA, ackB] = await Promise.all([command(a, "session:leave"), command(b, "session:leave")]);
    expect(ackA).toEqual({ ok: true });
    expect(ackB).toEqual({ ok: true });

    const matched = next(a, "session:matched");
    expect(await command(a, "session:start")).toEqual({ ok: true });
    expect(await command(b, "session:start")).toEqual({ ok: true });
    expect(await matched).toBeDefined();
  });

  it("both partners drop at the same moment: the chat ends and nobody is left holding it", async () => {
    server = await startServer({}, { reconnectGraceMs: 100 });
    const { a, b } = await pair(server);
    a.io.engine.close();
    b.io.engine.close();
    await expect
      .poll(() => server.logs.filter((line) => line.includes('"reason":"timeout"')).length, { timeout: 2000 })
      .toBeGreaterThan(0);
    await expect
      .poll(() => server.logs.some((line) => line.includes('"reason":"timeout"') && line.includes('"activeSessions":0')))
      .toBe(true);
  });

  it("a message of exactly 500 characters is delivered, 501 is refused, and the chat carries on", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    const got = next<Info>(b, "chat:message");
    expect(await send(a, { text: "x".repeat(500) })).toEqual({ ok: true });
    expect((await got).text).toHaveLength(500);
    expect(await send(a, { text: "x".repeat(501) })).toEqual({ ok: false, error: { code: "VALIDATION" } });
    const after = next<Info>(b, "chat:message");
    expect(await send(a, { text: "still fine" })).toEqual({ ok: true });
    expect((await after).text).toBe("still fine");
  });

  it("a client that reconnects too late gets a clean 'ended' and no stale session", async () => {
    server = await startServer({}, { reconnectGraceMs: 150 });
    const { a, b } = await pair(server, { b: { reconnectAfterMs: 500 } });
    const ended = next<Info>(b, "session:ended");
    const back = next(b, "connect");
    b.io.engine.close();
    expect((await ended).reason).toBe("timeout");
    await back;
    expect(await send(b, { text: "hello?" })).toEqual({ ok: false, error: { code: "NOT_IN_SESSION" } });
    // A was told already; its chat is over, so /leave just returns it to idle.
    expect(await command(a, "session:leave")).toEqual({ ok: true });
    expect(await command(a, "session:leave")).toEqual({ ok: false, error: { code: "INVALID_STATE" } });
  });
});
