import { afterEach, describe, expect, it } from "vitest";
import {
  arrivesWithin,
  collectTexts,
  command,
  connect,
  dropConnection,
  keepChannel,
  next,
  nextText,
  pair,
  recoveryAuth,
  send,
  startServer,
} from "./helpers.js";
import type { TestServer } from "./helpers.js";

let server: TestServer;
afterEach(async () => {
  await server?.close();
});

const NOT_IN_SESSION = { ok: false, error: { code: "NOT_IN_SESSION" } };
type Info = Record<string, string>;

describe("network drop recovery", () => {
  it("keeps the chat when B drops and comes back in time, and tells A both times", async () => {
    server = await startServer({}, { reconnectGraceMs: 3000 });
    const { a, b } = await pair(server, { b: { reconnectAfterMs: 100 } });
    const idBefore = b.id;

    const reconnecting = next<Info>(a, "partner:status");
    const back = next(b, "connect");
    dropConnection(b);
    expect((await reconnecting).state).toBe("reconnecting");

    const connected = next<Info>(a, "partner:status");
    await back;
    expect(b.recovered).toBe(true);
    expect(b.id).toBe(idBefore);
    expect((await connected).state).toBe("connected");

    // Both directions still work, with the same names as before.
    // And the keys both sides already had: nothing is exchanged again.
    const toA = nextText(a);
    expect(await send(b, "back again")).toEqual({ ok: true });
    expect(await toA).toBe("back again");
    const toB = nextText(b);
    expect(await send(a, "welcome back")).toEqual({ ok: true });
    expect(await toB).toBe("welcome back");
  });

  it("delivers the messages B missed while it was away", async () => {
    server = await startServer({}, { reconnectGraceMs: 3000 });
    const { a, b } = await pair(server, { b: { reconnectAfterMs: 300 } });

    const reconnecting = next(a, "partner:status");
    const missed = collectTexts(b);
    const back = next(b, "connect");
    dropConnection(b);
    await reconnecting;

    expect(await send(a, "are you there?")).toEqual({ ok: true });
    expect(await send(a, "hello??")).toEqual({ ok: true });
    expect(missed).toEqual([]); // B is offline right now

    await back;
    expect(b.recovered).toBe(true);
    // Replayed in order, and still readable: B's keys stayed in its memory.
    await expect.poll(() => missed).toEqual(["are you there?", "hello??"]);
  });

  it("ends the chat for A with partner_timeout when B stays away too long", async () => {
    server = await startServer({}, { reconnectGraceMs: 200 });
    const { a, b } = await pair(server);

    const reconnecting = next<Info>(a, "partner:status");
    const ended = next<Info>(a, "session:ended");
    dropConnection(b);
    expect((await reconnecting).state).toBe("reconnecting");
    // During the grace period the chat is still open for A.
    expect(await send(a, "waiting for you")).toEqual({ ok: true });

    expect((await ended).reason).toBe("partner_timeout");
    expect(await send(a, "gone?")).toEqual(NOT_IN_SESSION);
    expect(await command(a, "session:start")).toEqual({ ok: true }); // A can move on
  });

  it("tells a client that returns too late that its chat is over, and lets it start again", async () => {
    server = await startServer({}, { reconnectGraceMs: 150 });
    const { a, b } = await pair(server, { b: { reconnectAfterMs: 600 } });

    const endedForA = next<Info>(a, "session:ended");
    const endedForB = next<Info>(b, "session:ended");
    const back = next(b, "connect");
    dropConnection(b);

    expect((await endedForA).reason).toBe("partner_timeout");
    expect((await endedForB).reason).toBe("timeout"); // replayed when B returned
    await back;
    expect(await send(b, "still here?")).toEqual(NOT_IN_SESSION);
    expect(await command(b, "session:start")).toEqual({ ok: true });
  });

  it("replays partner_left to a client whose partner left while it was away", async () => {
    server = await startServer({}, { reconnectGraceMs: 3000 });
    const { a, b } = await pair(server, { b: { reconnectAfterMs: 300 } });

    const reconnecting = next(a, "partner:status");
    const endedForB = next<Info>(b, "session:ended");
    const back = next(b, "connect");
    dropConnection(b);
    await reconnecting;
    expect(await command(a, "session:leave")).toEqual({ ok: true });

    await back;
    expect((await endedForB).reason).toBe("partner_left");
    expect(await send(b, "hello?")).toEqual(NOT_IN_SESSION);
    expect(await command(b, "session:start")).toEqual({ ok: true });
  });

  it("ends the chat at once on a deliberate disconnect (no waiting period)", async () => {
    server = await startServer({}, { reconnectGraceMs: 60_000 });
    const { a, b } = await pair(server);
    const status = arrivesWithin(a, "partner:status");
    const ended = next<Info>(a, "session:ended");
    b.disconnect();
    expect((await ended).reason).toBe("partner_left");
    expect(await status).toBe(false);
  });

  it("does not hold anything for a client that was only searching", async () => {
    server = await startServer({}, { reconnectGraceMs: 3000 });
    const a = await connect(server, { reconnectAfterMs: 50 });
    await command(a, "session:start");
    const back = next(a, "connect");
    dropConnection(a);
    await back;

    // The search was cancelled by the drop: nobody is paired with a ghost.
    const b = await connect(server);
    const matchedB = arrivesWithin(b, "session:matched");
    await command(b, "session:start");
    expect(await matchedB).toBe(false);
    // ...and A is idle again, so it can simply /start (and meets B).
    const matchedA = next(a, "session:matched");
    expect(await command(a, "session:start")).toEqual({ ok: true });
    expect(await matchedA).toBeDefined();
  });

  it("releases and re-takes the per-address socket slot across drops", async () => {
    server = await startServer({ MAX_SOCKETS_PER_IP: "2" }, { reconnectGraceMs: 3000 });
    const { a, b } = await pair(server, { b: { reconnectAfterMs: 50 } });
    for (let i = 0; i < 2; i++) {
      const back = next(b, "connect");
      dropConnection(b);
      await back;
      expect(b.recovered).toBe(true);
    }
    server.clock.advance(10_000); // refill the handshake limiter: this test is about the cap
    // Still exactly two sockets counted: a third is refused, and after A
    // leaves there is room for exactly one more.
    await expect(connect(server)).rejects.toThrow("TOO_MANY_CONNECTIONS");
    a.disconnect();
    await expect.poll(() => server.logs.some((line) => line.includes("client namespace disconnect"))).toBe(true);
    await expect(connect(server)).resolves.toBeDefined();
  });

  it("does not hold chats open when the server shuts down", async () => {
    server = await startServer({}, { reconnectGraceMs: 60_000 });
    const { a, b } = await pair(server);
    const closedA = next(a, "disconnect");
    const closedB = next(b, "disconnect");
    server.sockets.length = 0; // let the server close them, as a deploy would
    await server.close();
    await Promise.all([closedA, closedB]);
    expect(server.logs.some((line) => line.includes('"held":true'))).toBe(false);
  });
});

describe("reconnecting before the server noticed the drop", () => {
  it("closes the stale connection, asks for one retry, then restores the chat", async () => {
    server = await startServer({}, { reconnectGraceMs: 3000 });
    const { a, b } = await pair(server);
    const oldId = b.id;
    const auth = recoveryAuth(b);
    expect(auth.pid).toBeTruthy();
    expect(auth.offset).toBeTruthy();

    // B's old link is still open on the server when its "new network" connects.
    const kicked = next(b, "disconnect");
    const reconnecting = next<Info>(a, "partner:status");
    await expect(connect(server, { authOverrides: auth })).rejects.toThrow("RETRY");
    await kicked;
    expect((await reconnecting).state).toBe("reconnecting");

    const connected = next<Info>(a, "partner:status");
    const again = await connect(server, { authOverrides: auth });
    expect(again.id).toBe(oldId);
    expect((await connected).state).toBe("connected");

    keepChannel(b, again); // the same page, on a new link: its keys are still in memory
    const toA = nextText(a);
    expect(await send(again, "switched to mobile data")).toEqual({ ok: true });
    expect(await toA).toBe("switched to mobile data");
  });

  it("ignores an unknown private id and connects normally", async () => {
    server = await startServer();
    const socket = await connect(server, { authOverrides: { pid: "not-a-real-private-id", offset: "nope" } });
    expect(socket.connected).toBe(true);
    expect(socket.recovered).toBeFalsy();
  });

  it("rejects malformed recovery fields at the handshake", async () => {
    server = await startServer();
    await expect(connect(server, { authOverrides: { pid: 42 } })).rejects.toThrow("VALIDATION");
    await expect(connect(server, { authOverrides: { pid: "x".repeat(65) } })).rejects.toThrow("VALIDATION");
    await expect(connect(server, { authOverrides: { offset: "" } })).rejects.toThrow("VALIDATION");
  });
});

describe("online counter", () => {
  it("sends the count on connect and then on a timer, with no other data", async () => {
    server = await startServer({}, { onlineBroadcastMs: 40 });
    const a = await connect(server);
    const b = await connect(server);
    const first = await next<Record<string, unknown>>(a, "stats:online");
    expect(first).toEqual({ count: 2 });
    expect((await next<Record<string, unknown>>(b, "stats:online")).count).toBe(2);

    b.disconnect();
    await expect.poll(() => server.logs.some((line) => line.includes("ws_disconnect"))).toBe(true);
    await expect
      .poll(async () => (await next<Record<string, number>>(a, "stats:online")).count, { timeout: 2000 })
      .toBe(1);
  });

  it("tells a new socket the count straight away", async () => {
    server = await startServer({}, { onlineBroadcastMs: 60_000 });
    const a = await connect(server);
    // No broadcast will happen during this test, so only the event sent on
    // connect can have set this. It is what makes a socket restorable at all.
    await expect.poll(() => recoveryAuth(a).offset).toBeTruthy();
  });
});
