import { afterEach, describe, expect, it } from "vitest";
import {
  NOISE_ENVELOPE,
  arrivesWithin,
  channelOf,
  command,
  connect,
  exchangeKeys,
  next,
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

const NOT_IN_SESSION = { ok: false, error: { code: "NOT_IN_SESSION" } };
const VALIDATION = { ok: false, error: { code: "VALIDATION" } };

describe("session isolation", () => {
  it("refuses a third client: an envelope goes to the sender's own partner or nowhere", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    const c = await connect(server);
    const reachedA = arrivesWithin(a, "e2e:envelope");
    const reachedB = arrivesWithin(b, "e2e:envelope");
    expect(await sendRaw(c, NOISE_ENVELOPE)).toEqual(NOT_IN_SESSION);
    expect(await reachedA).toBe(false);
    expect(await reachedB).toBe(false);
  });

  it("has no way to name a session: an envelope carrying a session id is rejected outright", async () => {
    server = await startServer();
    const { a, b, sessionId } = await pair(server);
    const c = await connect(server);
    const reachedB = arrivesWithin(b, "e2e:envelope");
    expect(await sendRaw(c, { ...NOISE_ENVELOPE, sessionId })).toEqual(VALIDATION);
    expect(await sendRaw(a, { ...NOISE_ENVELOPE, sessionId })).toEqual(VALIDATION); // even a member's
    expect(await reachedB).toBe(false);
  });

  it("an envelope lifted from one chat is relayed nowhere else, and would not decrypt there anyway", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    server.clock.advance(10_000);
    const { a: c, b: d } = await pair(server);

    // C replays an envelope that A really sent to B.
    const captured = next<{ seq: number; ct: string }>(b, "e2e:envelope");
    await send(a, "for B only");
    const stolen = await captured;
    const toD = next<{ seq: number; ct: string }>(d, "e2e:envelope");
    const toB = arrivesWithin(b, "e2e:envelope");
    expect(await sendRaw(c, stolen)).toEqual({ ok: true }); // the server cannot tell: it is just ciphertext
    expect(await toB).toBe(false); // it never goes back to the chat it came from
    await expect(channelOf(d).open(await toD)).rejects.toMatchObject({ code: "AUTH_FAILED" }); // and D cannot read it
  });

  it("tells B when A leaves, and neither can send any more", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    const endedForB = next<Record<string, string>>(b, "session:ended");
    const endedForA = next<Record<string, string>>(a, "session:ended");

    expect(await command(a, "session:leave")).toEqual({ ok: true });
    expect((await endedForB).reason).toBe("partner_left");
    expect((await endedForA).reason).toBe("left");

    expect(await send(b, "anyone?")).toEqual(NOT_IN_SESSION);
    expect(await send(a, "bye")).toEqual(NOT_IN_SESSION);
  });

  it("tells B when A disconnects", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    const endedForB = next<Record<string, string>>(b, "session:ended");
    a.disconnect();
    expect((await endedForB).reason).toBe("partner_left");
    expect(await send(b, "hello?")).toEqual(NOT_IN_SESSION);
  });

  it("never lets an ended session be rejoined: a new /start makes a new session", async () => {
    server = await startServer();
    const { a, b, sessionId } = await pair(server);
    await command(a, "session:leave");
    const matchedA = next<Record<string, string>>(a, "session:matched");
    await command(a, "session:start");
    await command(b, "session:start");
    const info = await matchedA;
    expect(info.sessionId).not.toBe(sessionId);
  });

  it("the keys of an ended chat are useless in the next one, even with the same partner", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    const oldKeysOfA = channelOf(a);
    await command(a, "session:leave");

    // The same two people meet again.
    const matchedA = next<Matched>(a, "session:matched");
    const matchedB = next<Matched>(b, "session:matched");
    await command(a, "session:start");
    await command(b, "session:start");
    const [infoA, infoB] = await Promise.all([matchedA, matchedB]);
    // The server relays nothing until NEW keys have crossed...
    const early = await oldKeysOfA.seal({ t: "msg", text: "with old keys, too early" });
    expect(await sendRaw(a, early)).toEqual({ ok: false, error: { code: "INVALID_STATE" } });
    // ...and after that, what the old keys encrypt cannot be read with the new ones.
    await exchangeKeys(a, b, infoA, infoB);
    const toB = next<{ seq: number; ct: string }>(b, "e2e:envelope");
    const stale = await oldKeysOfA.seal({ t: "msg", text: "with old keys" });
    expect(await sendRaw(a, stale)).toEqual({ ok: true });
    await expect(channelOf(b).open(await toB)).rejects.toMatchObject({ code: "AUTH_FAILED" });
  });
});
