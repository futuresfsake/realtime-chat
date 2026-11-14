import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  NOISE_ENVELOPE,
  arrivesWithin,
  channelOf,
  command,
  connect,
  e2ee,
  next,
  nextText,
  pair,
  send,
  sendKey,
  sendRaw,
  startServer,
} from "./helpers.js";
import type { Matched, TestServer } from "./helpers.js";

let server: TestServer;
afterEach(async () => {
  await server?.close();
});

const KEY = "B".repeat(87);

describe("key exchange", () => {
  it("relays each public key to the partner only, unchanged", async () => {
    server = await startServer();
    const { a, b } = await pair(server, { secure: false });
    const c = await connect(server);
    const keyForB = next<{ publicKey: string }>(b, "e2e:key");
    const cHears = arrivesWithin(c, "e2e:key");
    const echoed = arrivesWithin(a, "e2e:key");
    expect(await sendKey(a, { publicKey: KEY })).toEqual({ ok: true });
    expect(await keyForB).toEqual({ publicKey: KEY });
    expect(await cHears).toBe(false);
    expect(await echoed).toBe(false);
  });

  it("accepts one key per side: a second one is refused and never relayed", async () => {
    server = await startServer();
    const { a, b } = await pair(server, { secure: false });
    expect(await sendKey(a, { publicKey: KEY })).toEqual({ ok: true });
    const relayed = arrivesWithin(b, "e2e:key");
    expect(await sendKey(a, { publicKey: "C".repeat(87) })).toEqual({ ok: false, error: { code: "INVALID_STATE" } });
    expect(await relayed).toBe(false);
  });

  it.each([
    ["too short", { publicKey: "B".repeat(86) }],
    ["not base64url", { publicKey: `${"B".repeat(86)}+` }],
    ["extra fields", { publicKey: KEY, role: "admin" }],
    ["a string", KEY],
  ])("rejects a key that is %s", async (_name, payload) => {
    server = await startServer();
    const { a, b } = await pair(server, { secure: false });
    const relayed = arrivesWithin(b, "e2e:key");
    expect(await sendKey(a, payload)).toEqual({ ok: false, error: { code: "VALIDATION" } });
    expect(await relayed).toBe(false);
  });

  it("refuses a key from a client that is not in a chat", async () => {
    server = await startServer();
    const a = await connect(server);
    expect(await sendKey(a, { publicKey: KEY })).toEqual({ ok: false, error: { code: "NOT_IN_SESSION" } });
    await command(a, "session:start");
    expect(await sendKey(a, { publicKey: KEY })).toEqual({ ok: false, error: { code: "NOT_IN_SESSION" } });
  });

  it("gives the two partners opposite roles and the same safety code", async () => {
    server = await startServer();
    const { a, b, infoA, infoB } = await pair(server);
    expect(new Set([infoA.role, infoB.role])).toEqual(new Set(["initiator", "responder"]));
    expect(channelOf(a).safetyCode).toMatch(/^\d{5} \d{5} \d{5} \d{5}$/);
    expect(channelOf(a).safetyCode).toBe(channelOf(b).safetyCode);
  });

  it("a server that swaps the keys is caught: the two safety codes differ (T-08)", async () => {
    server = await startServer();
    const { infoA, infoB } = await pair(server, { secure: false });
    const mk = (info: Matched) => e2ee.createChannel({ sessionId: info.sessionId, role: info.role });
    const chA = mk(infoA);
    const chB = mk(infoB);
    // Mallory sits between them with one channel facing each, and relays her own keys.
    const facingA = e2ee.createChannel({ sessionId: infoA.sessionId, role: infoB.role });
    const facingB = e2ee.createChannel({ sessionId: infoA.sessionId, role: infoA.role });
    const codeA = await chA.receiveKey(await facingA.publicKey());
    const codeB = await chB.receiveKey(await facingB.publicKey());
    expect(codeA).not.toBe(codeB);
  });
});

describe("no message before the chat is secured", () => {
  it("refuses envelopes until both keys have crossed, in both directions", async () => {
    server = await startServer();
    const { a, b } = await pair(server, { secure: false });
    const relayed = arrivesWithin(b, "e2e:envelope");
    expect(await sendRaw(a, NOISE_ENVELOPE)).toEqual({ ok: false, error: { code: "INVALID_STATE" } });
    await sendKey(a, { publicKey: KEY });
    expect(await sendRaw(a, NOISE_ENVELOPE)).toEqual({ ok: false, error: { code: "INVALID_STATE" } }); // one key is not enough
    expect(await sendRaw(b, NOISE_ENVELOPE)).toEqual({ ok: false, error: { code: "INVALID_STATE" } });
    expect(await relayed).toBe(false);
    await sendKey(b, { publicKey: "C".repeat(87) });
    expect(await sendRaw(a, NOISE_ENVELOPE)).toEqual({ ok: true });
  });
});

describe("no plaintext path (T-25)", () => {
  it("has no handler for the old plaintext events: nothing is relayed, nothing is acked", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    const heard: string[] = [];
    b.onAny((event: string) => heard.push(event));
    const acked = await Promise.race([
      a.timeout(300).emitWithAck("chat:send", { text: "plaintext" }).then(() => true, () => false),
      a.timeout(300).emitWithAck("chat:react", { ref: 1, emoji: "👍" }).then(() => true, () => false),
    ]);
    expect(acked).toBe(false); // unknown events get no answer at all
    await new Promise((r) => setTimeout(r, 100));
    expect(heard).not.toContain("chat:message");
    expect(heard.filter((e) => e.startsWith("chat:"))).toEqual([]);
  });

  it("the server never sends a readable message event", () => {
    // Compile-time and source-level guard: the contract has no chat:* events.
    const events = readFileSync("src/types/events.ts", "utf8");
    expect(events).not.toMatch(/"chat:(message|reaction|send|react)":/);
  });
});

describe("blind relay: the server only ever sees ciphertext", () => {
  it("every payload that crosses the server for a chat contains none of its words", async () => {
    server = await startServer();
    const seen: string[] = [];
    // Spy on everything the server hands out, over all sockets.
    server.io.on("connection", (socket) => {
      socket.onAny((event: string, ...args: unknown[]) => {
        if (event.startsWith("e2e:")) seen.push(JSON.stringify(args.filter((x) => typeof x !== "function")));
      });
    });
    const { a, b } = await pair(server);
    const words = ["tumbleweed-9917", "hunter2-secret", "meet-at-the-mall"];
    for (const word of words) {
      const got = nextText(b);
      expect(await send(a, word)).toEqual({ ok: true });
      expect(await got).toBe(word); // the partner reads it fine...
    }
    expect(seen.length).toBeGreaterThanOrEqual(5); // 2 keys + 3 envelopes at least
    const everything = seen.join("\n");
    for (const word of words) {
      expect(everything).not.toContain(word);
      expect(everything).not.toContain(Buffer.from(word).toString("base64"));
      expect(everything).not.toContain(Buffer.from(word).toString("base64url"));
      expect(everything).not.toContain(Buffer.from(word).toString("hex"));
    }
  });

  it("the source of the relay never reads, stores or logs envelope contents", async () => {
    const relay = readFileSync("src/gateway/registerHandlers.ts", "utf8");
    expect(relay).not.toMatch(/\.(push|set|add|unshift)\([^)]*\b(ct|publicKey|envelope)\b/);
    expect(relay).not.toMatch(/logger\.\w+\([^)]*\b(ct|publicKey|envelope)\b/);
    const sessions = readFileSync("src/sessions/sessionManager.ts", "utf8");
    expect(sessions).not.toMatch(/\b(ct|ciphertext|publicKey)\b/);
  });
});

describe("key exchange timeout (US-37)", () => {
  it("ends a chat for both sides with crypto_timeout if the keys never cross", async () => {
    server = await startServer({}, { keyExchangeTimeoutMs: 150 });
    const { a, b } = await pair(server, { secure: false });
    const endedA = next<{ reason: string }>(a, "session:ended");
    const endedB = next<{ reason: string }>(b, "session:ended");
    expect((await endedA).reason).toBe("crypto_timeout");
    expect((await endedB).reason).toBe("crypto_timeout");
    expect(await send(a, "hello?")).toEqual({ ok: false, error: { code: "NOT_IN_SESSION" } });
    // Both are free to try again.
    expect(await command(a, "session:start")).toEqual({ ok: true });
  });

  it("also ends it when only one side sent its key (half-keyed)", async () => {
    server = await startServer({}, { keyExchangeTimeoutMs: 150 });
    const { a, b } = await pair(server, { secure: false });
    await sendKey(a, { publicKey: KEY });
    const endedB = next<{ reason: string }>(b, "session:ended");
    expect((await endedB).reason).toBe("crypto_timeout");
  });

  it("leaves a chat alone once it is secured, however long it lasts", async () => {
    server = await startServer({}, { keyExchangeTimeoutMs: 150 });
    const { a, b } = await pair(server);
    const ended = arrivesWithin(a, "session:ended", 400);
    expect(await ended).toBe(false);
    const got = nextText(b);
    expect(await send(a, "still here")).toEqual({ ok: true });
    expect(await got).toBe("still here");
  });

  it("does not end a newer chat when an old one's deadline fires", async () => {
    server = await startServer({}, { keyExchangeTimeoutMs: 200 });
    const { a, b } = await pair(server, { secure: false });
    await command(a, "session:leave"); // first chat over before its deadline
    const c = await connect(server);
    const matchedB = next<Matched>(b, "session:matched");
    await command(b, "session:start");
    await command(c, "session:start");
    const info = await matchedB;
    const endedEarly = arrivesWithin(b, "session:ended", 120);
    expect(await endedEarly).toBe(false); // the old deadline (200 ms) has not fired yet for this one
    const ended = next<{ reason: string }>(b, "session:ended");
    expect((await ended).reason).toBe("crypto_timeout"); // its own deadline does
    expect(info.sessionId).toBeTruthy();
  });

  it("is on by default at 10 seconds", async () => {
    const { loadConfig } = await import("../../src/config.js");
    expect(loadConfig({}).keyExchangeTimeoutMs).toBe(10_000);
  });
});
