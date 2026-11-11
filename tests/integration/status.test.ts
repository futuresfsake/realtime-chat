import { afterEach, describe, expect, it } from "vitest";
import { arrivesWithin, command, connect, next, pair, send, startServer } from "./helpers.js";
import type { TestServer } from "./helpers.js";

let server: TestServer;
afterEach(async () => {
  await server?.close();
});

const NOT_IN_SESSION = { ok: false, error: { code: "NOT_IN_SESSION" } };
type Info = Record<string, any>;

function react(socket: Parameters<typeof next>[0], payload: unknown): Promise<any> {
  return socket.timeout(2000).emitWithAck("chat:react", payload);
}
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
    expect(await send(a, { text: "still can talk" })).toEqual({ ok: true });
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
  it("numbers messages 1, 2, 3 in a session, for both directions, and restarts in a new one", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    const seen: number[] = [];
    b.on("chat:message", (m: { seq: number }) => seen.push(m.seq));
    a.on("chat:message", (m: { seq: number }) => seen.push(m.seq));

    await send(a, { text: "one" });
    await send(b, { text: "two" });
    await send(a, { text: "three" });
    await expect.poll(() => seen.length).toBe(6); // each message reaches both sides
    expect(new Set(seen)).toEqual(new Set([1, 2, 3]));

    await command(a, "session:next");
    const matched = next(a, "session:matched");
    await command(b, "session:start");
    await matched;
    const first = next<Info>(b, "chat:message");
    await send(a, { text: "fresh start" });
    expect((await first).seq).toBe(1);
  });
});

describe("reactions", () => {
  it("relays a reaction to both sides with the reactor's name", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    const msg = next<Info>(b, "chat:message");
    await send(a, { text: "funny" });
    const { seq, from: author } = await msg;

    const toA = next<Info>(a, "chat:reaction");
    const toB = next<Info>(b, "chat:reaction");
    expect(await react(b, { ref: seq, emoji: "😂" })).toEqual({ ok: true });
    const [forA, forB] = await Promise.all([toA, toB]);
    expect(forA).toEqual(forB);
    expect(forA).toMatchObject({ ref: seq, emoji: "😂" });
    expect(forA.from).not.toBe(author); // B reacted, so it is B's name
    expect(forA.from).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);
  });

  it("never reaches a third client", async () => {
    server = await startServer();
    const { a } = await pair(server);
    const c = await connect(server);
    await command(c, "session:start");
    const cHears = arrivesWithin(c, "chat:reaction");
    await react(a, { ref: 1, emoji: "👍" });
    expect(await cHears).toBe(false);
  });

  it.each(["👍", "❤️", "😂", "😮", "😢", "🙏"])("accepts %s", async (emoji) => {
    server = await startServer();
    const { a } = await pair(server);
    expect(await react(a, { ref: 1, emoji })).toEqual({ ok: true });
  });

  it("is refused with NOT_IN_SESSION outside a chat", async () => {
    server = await startServer();
    const a = await connect(server);
    expect(await react(a, { ref: 1, emoji: "👍" })).toEqual(NOT_IN_SESSION);
    await command(a, "session:start");
    expect(await react(a, { ref: 1, emoji: "👍" })).toEqual(NOT_IN_SESSION);
  });

  it("is refused after the chat ended", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    await command(a, "session:leave");
    expect(await react(b, { ref: 1, emoji: "👍" })).toEqual(NOT_IN_SESSION);
  });

  it.each([
    ["an emoji that is not allowed", { ref: 1, emoji: "🔥" }],
    ["ref 0", { ref: 0, emoji: "👍" }],
    ["a fractional ref", { ref: 1.5, emoji: "👍" }],
    ["extra fields", { ref: 1, emoji: "👍", text: "hi" }],
    ["no emoji", { ref: 1 }],
    ["a string", "👍"],
  ])("rejects %s with VALIDATION", async (_name, payload) => {
    server = await startServer();
    const { a } = await pair(server);
    expect(await react(a, payload)).toEqual({ ok: false, error: { code: "VALIDATION" } });
  });

  it("shares the message limit, so reactions cannot flood", async () => {
    server = await startServer();
    const { a } = await pair(server);
    for (let i = 0; i < 5; i++) expect(await react(a, { ref: 1, emoji: "👍" })).toEqual({ ok: true });
    const refused = await react(a, { ref: 1, emoji: "👍" });
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
