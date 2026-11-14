import { afterEach, describe, expect, it } from "vitest";
import {
  arrivesWithin,
  command,
  connect,
  exchangeKeys,
  next,
  nextText,
  pair,
  send,
  sendRaw,
  startServer,
} from "./helpers.js";
import type { Matched, TestServer } from "./helpers.js";

let server: TestServer;
afterEach(async () => {
  await server?.close();
});

type Info = Record<string, any>;

// US-36: no chat gets stuck or corrupted by awkward timing.
describe("edge cases", () => {
  it("both partners press /next at the same moment: nobody is orphaned and they are not put back together", async () => {
    server = await startServer();
    const { a, b, sessionId } = await pair(server);
    const rematchA = arrivesWithin(a, "session:matched", 300);
    const rematchB = arrivesWithin(b, "session:matched", 300);

    const [ackA, ackB] = await Promise.all([command(a, "session:next"), command(b, "session:next")]);
    expect(ackA).toEqual({ ok: true });
    expect(ackB).toEqual({ ok: true });

    // Both are searching, and neither is handed back to the other.
    expect(await rematchA).toBe(false);
    expect(await rematchB).toBe(false);

    // A newcomer is paired with whoever has waited longest, and it really works.
    const c = await connect(server);
    const matchedA = next<Matched>(a, "session:matched");
    const matchedC = next<Matched>(c, "session:matched");
    await command(c, "session:start");
    const [infoA, infoC] = await Promise.all([matchedA, matchedC]);
    expect(infoA.sessionId).toBe(infoC.sessionId);
    expect(infoA.sessionId).not.toBe(sessionId);
    await exchangeKeys(a, c, infoA, infoC);
    const toC = next<Info>(c, "e2e:envelope");
    expect(await send(a, "after the double skip")).toEqual({ ok: true });
    expect((await toC).seq).toBe(1);
    const toA = nextText(a);
    expect(await send(c, "and back")).toEqual({ ok: true });
    expect(await toA).toBe("and back");
    // B is still waiting for someone else, not stuck in a half-made session.
    expect(await command(b, "session:start")).toEqual({ ok: false, error: { code: "INVALID_STATE" } });
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

    // They are idle again and can search. They just parted, so they are not
    // paired with each other: a third person is.
    const c = await connect(server);
    const matched = next(a, "session:matched");
    expect(await command(a, "session:start")).toEqual({ ok: true });
    expect(await command(b, "session:start")).toEqual({ ok: true });
    expect(await arrivesWithin(a, "session:matched", 200)).toBe(false);
    expect(await command(c, "session:start")).toEqual({ ok: true });
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
    const got = nextText(b);
    expect(await send(a, "x".repeat(500))).toEqual({ ok: true });
    expect(await got).toHaveLength(500);
    // The length is checked where the message can still be read: in the
    // sender's browser, before encryption. Nothing leaves it.
    const nothing = arrivesWithin(b, "e2e:envelope");
    await expect(send(a, "x".repeat(501))).rejects.toMatchObject({ code: "TOO_LONG" });
    expect(await nothing).toBe(false);
    // The server cannot count characters; it limits the envelope's size instead.
    const oversized = { seq: 99, ct: "A".repeat(3001) };
    expect(await sendRaw(a, oversized)).toEqual({ ok: false, error: { code: "VALIDATION" } });
    const after = nextText(b);
    expect(await send(a, "still fine")).toEqual({ ok: true });
    expect(await after).toBe("still fine");
  });

  it("the longest message in a 3-byte script (500 CJK characters) fits through the server", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    const got = nextText(b);
    expect(await send(a, "好".repeat(500))).toEqual({ ok: true });
    expect(await got).toBe("好".repeat(500));
  });

  it("a client that reconnects too late gets a clean 'ended' and no stale session", async () => {
    server = await startServer({}, { reconnectGraceMs: 150 });
    const { a, b } = await pair(server, { b: { reconnectAfterMs: 500 } });
    const ended = next<Info>(b, "session:ended");
    const back = next(b, "connect");
    b.io.engine.close();
    expect((await ended).reason).toBe("timeout");
    await back;
    expect(await send(b, "hello?")).toEqual({ ok: false, error: { code: "NOT_IN_SESSION" } });
    // A was told already; its chat is over, so /leave just returns it to idle.
    expect(await command(a, "session:leave")).toEqual({ ok: true });
    expect(await command(a, "session:leave")).toEqual({ ok: false, error: { code: "INVALID_STATE" } });
  });
});
