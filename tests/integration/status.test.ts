import { afterEach, describe, expect, it } from "vitest";
import {
  arrivesWithin,
  command,
  connect,
  exchangeKeys,
  next,
  nextPlain,
  pair,
  react,
  send,
  startServer,
} from "./helpers.js";
import type { Matched, TestServer } from "./helpers.js";

let server: TestServer;
afterEach(async () => {
  await server?.close();
});

const NOT_IN_SESSION = { ok: false, error: { code: "NOT_IN_SESSION" } };
type Info = Record<string, any>;

function typing(socket: Parameters<typeof next>[0], payload: unknown): Promise<any> {
  return socket.timeout(2000).emitWithAck("typing", payload);
}

describe("typing indicator", () => {
  it("tells only the partner when someone starts and stops typing", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    const c = await connect(server);
    await command(c, "session:start");

    const started = next<Info>(b, "partner:status");
    const cHears = arrivesWithin(c, "partner:status");
    expect(await typing(a, { isTyping: true })).toEqual({ ok: true });
    expect(await started).toEqual({ state: "typing" });
    expect(await cHears).toBe(false);

    const stopped = next<Info>(b, "partner:status");
    expect(await typing(a, { isTyping: false })).toEqual({ ok: true });
    expect(await stopped).toEqual({ state: "idle" });
  });

  it("does not echo typing back to the sender", async () => {
    server = await startServer();
    const { a } = await pair(server);
    const echoed = arrivesWithin(a, "partner:status");
    await typing(a, { isTyping: true });
    expect(await echoed).toBe(false);
  });

  it("is ignored, without an error, when not in a chat", async () => {
    server = await startServer();
    const a = await connect(server);
    expect(await typing(a, { isTyping: true })).toEqual({ ok: true });
    await command(a, "session:start");
    expect(await typing(a, { isTyping: true })).toEqual({ ok: true });
  });

  it("rejects bad payloads, and anything that could carry text", async () => {
    server = await startServer();
    const { a } = await pair(server);
    for (const payload of [{}, { isTyping: "yes" }, { isTyping: true, text: "secret" }, null, "typing"]) {
      expect(await typing(a, payload)).toEqual({ ok: false, error: { code: "VALIDATION" } });
    }
  });

  it("allows a burst of 10, then says slow down, then recovers", async () => {
    server = await startServer();
    const { a } = await pair(server);
    for (let i = 0; i < 10; i++) expect(await typing(a, { isTyping: i % 2 === 0 })).toEqual({ ok: true });
    const refused = await typing(a, { isTyping: true });
    expect(refused.ok).toBe(false);
    expect(refused.error.code).toBe("RATE_LIMITED");
    server.clock.advance(500); // 2 per second
    expect(await typing(a, { isTyping: true })).toEqual({ ok: true });
  });

  it("does not use up the message limit", async () => {
    server = await startServer();
    const { a } = await pair(server);
    for (let i = 0; i < 10; i++) await typing(a, { isTyping: true });
    expect(await send(a, "still can talk")).toEqual({ ok: true });
  });

  it("is not replayed to a partner that was offline (a stale 'typing...' would mislead)", async () => {
    server = await startServer({}, { reconnectGraceMs: 3000 });
    const { a, b } = await pair(server, { b: { reconnectAfterMs: 200 } });
    const states: string[] = [];
    b.on("partner:status", (info: { state: string }) => states.push(info.state));
    const reconnecting = next(a, "partner:status");
    const back = next(b, "connect");
    b.io.engine.close();
    await reconnecting;
    await typing(a, { isTyping: true });
    await back;
    expect(b.recovered).toBe(true);
    expect(states).not.toContain("typing");
  });
});

describe("message numbers", () => {
  it("each side numbers its own envelopes 1, 2, 3, and a new chat starts again at 1", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    const fromA: number[] = [];
    const fromB: number[] = [];
    b.on("e2e:envelope", (e: { seq: number }) => fromA.push(e.seq));
    a.on("e2e:envelope", (e: { seq: number }) => fromB.push(e.seq));

    await send(a, "one");
    await send(b, "two");
    await send(a, "three");
    await expect.poll(() => fromA.length + fromB.length).toBe(3); // each envelope reaches the partner only
    expect(fromA).toEqual([1, 2]);
    expect(fromB).toEqual([1]);

    const matchedA = next<Matched>(a, "session:matched");
    const matchedB = next<Matched>(b, "session:matched");
    await command(a, "session:next");
    server.clock.advance(24 * 60 * 60 * 1000 + 1); // the no-rematch period is over
    await command(b, "session:start");
    await exchangeKeys(a, b, await matchedA, await matchedB);
    const first = next<Info>(b, "e2e:envelope");
    await send(a, "fresh start");
    expect((await first).seq).toBe(1);
  });
});

describe("reactions (encrypted, like messages)", () => {
  it("reaches the partner, who can read which message it is for", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    const envelope = next<Info>(b, "e2e:envelope");
    await send(a, "funny");
    const { seq } = await envelope;

    const toA = nextPlain(a);
    const echoed = arrivesWithin(b, "e2e:envelope");
    expect(await react(b, seq, "😂")).toEqual({ ok: true });
    expect(await toA).toEqual({ t: "react", ref: seq, emoji: "😂" });
    expect(await echoed).toBe(false); // the one who reacted shows it locally
  });

  it("looks exactly like a short message to the server: same event, same fields, same size", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    const first = next<Info>(b, "e2e:envelope");
    await send(a, "hi");
    const message = await first;
    const second = next<Info>(b, "e2e:envelope");
    await react(a, 1, "👍");
    const reaction = await second;
    expect(Object.keys(reaction)).toEqual(Object.keys(message));
    expect(reaction.ct).toHaveLength(message.ct.length);
  });

  it("never reaches a third client", async () => {
    server = await startServer();
    const { a } = await pair(server);
    const c = await connect(server);
    await command(c, "session:start");
    const cHears = arrivesWithin(c, "e2e:envelope");
    await react(a, 1, "👍");
    expect(await cHears).toBe(false);
  });

  it.each(["👍", "❤️", "😂", "😮", "😢", "🙏"])("carries %s", async (emoji) => {
    server = await startServer();
    const { a, b } = await pair(server);
    const toB = nextPlain(b);
    expect(await react(a, 1, emoji)).toEqual({ ok: true });
    expect(await toB).toEqual({ t: "react", ref: 1, emoji });
  });

  it("is refused after the chat ended", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    await command(a, "session:leave");
    expect(await react(b, 1, "👍")).toEqual(NOT_IN_SESSION);
  });

  it("shares the message limit, so reactions cannot flood", async () => {
    server = await startServer();
    const { a } = await pair(server);
    for (let i = 0; i < 5; i++) expect(await react(a, 1, "👍")).toEqual({ ok: true });
    const refused = await react(a, 1, "👍");
    expect(refused.error.code).toBe("RATE_LIMITED");
  });
});

describe("partner status", () => {
  it("tells the partner 'reconnecting' on a drop and 'connected' on return", async () => {
    server = await startServer({}, { reconnectGraceMs: 3000 });
    const { a, b } = await pair(server, { b: { reconnectAfterMs: 100 } });
    const dropped = next<Info>(a, "partner:status");
    b.io.engine.close();
    expect(await dropped).toEqual({ state: "reconnecting" });
    const back = next<Info>(a, "partner:status");
    expect((await back).state).toBe("connected");
  });

  it("ends the chat when the partner is gone for longer than the grace period", async () => {
    server = await startServer({}, { reconnectGraceMs: 150 });
    const { a, b } = await pair(server);
    const ended = next<Info>(a, "session:ended");
    b.io.engine.close();
    expect((await ended).reason).toBe("partner_timeout");
  });
});
