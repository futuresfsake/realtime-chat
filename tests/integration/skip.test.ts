import { afterEach, describe, expect, it } from "vitest";
import { command, connect, next, pair, send, startServer } from "./helpers.js";
import type { TestServer } from "./helpers.js";

let server: TestServer;
afterEach(async () => {
  await server?.close();
});

function arrivesWithin(socket: Parameters<typeof next>[0], event: string, ms = 150): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(false);
    }, ms);
    const handler = () => {
      clearTimeout(timer);
      resolve(true);
    };
    socket.once(event, handler);
  });
}

describe("/next", () => {
  it("tells the partner, ends the chat and puts the skipper back in the queue", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    const endedForB = next<Record<string, string>>(b, "session:ended");
    const endedForA = next<Record<string, string>>(a, "session:ended");

    expect(await command(a, "session:next")).toEqual({ ok: true });
    expect((await endedForB).reason).toBe("partner_left");
    expect((await endedForA).reason).toBe("skipped");

    // B is no longer in a chat, A is searching (so /start is refused).
    expect(await send(b, { text: "hi" })).toEqual({ ok: false, error: { code: "NOT_IN_SESSION" } });
    expect(await command(a, "session:start")).toEqual({ ok: false, error: { code: "INVALID_STATE" } });
  });

  it("pairs the skipper with a waiting client, with a new session and name", async () => {
    server = await startServer();
    const { a, b, sessionId } = await pair(server);
    const c = await connect(server);
    await command(c, "session:start");

    const matchedA = next<Record<string, string>>(a, "session:matched");
    const matchedC = next<Record<string, string>>(c, "session:matched");
    await command(a, "session:next");
    const [infoA, infoC] = await Promise.all([matchedA, matchedC]);

    expect(infoA.sessionId).toBe(infoC.sessionId);
    expect(infoA.sessionId).not.toBe(sessionId);
    expect(infoA.partnerName).toBe(infoC.myName);

    // The old partner hears nothing from the new chat.
    const bHears = arrivesWithin(b, "chat:message");
    await send(a, { text: "new chat" });
    expect(await bHears).toBe(false);
  });

  it("works while searching (re-enqueues without pairing with itself)", async () => {
    server = await startServer();
    const a = await connect(server);
    await command(a, "session:start");
    const ended = next<Record<string, string>>(a, "session:ended");
    expect(await command(a, "session:next")).toEqual({ ok: true });
    expect((await ended).reason).toBe("skipped");
    const matched = arrivesWithin(a, "session:matched");
    expect(await matched).toBe(false);
  });

  it("is refused with INVALID_STATE when idle", async () => {
    server = await startServer();
    const a = await connect(server);
    expect(await command(a, "session:next")).toEqual({ ok: false, error: { code: "INVALID_STATE" } });
  });

  it("is limited to 10 searches per minute (shared with /start), then recovers", async () => {
    server = await startServer();
    const { a } = await pair(server); // two /start calls from this address
    let accepted = 0;
    let refused: any;
    for (let i = 0; i < 12; i++) {
      const ack = await command(a, "session:next");
      if (ack.ok) accepted++;
      else {
        refused = ack;
        break;
      }
    }
    expect(accepted).toBe(8);
    expect(refused.error.code).toBe("RATE_LIMITED");
    expect(refused.error.retryAfterMs).toBeGreaterThan(0);

    server.clock.advance(6000); // 10 per minute = one token per 6 s
    expect(await command(a, "session:next")).toEqual({ ok: true });
  });
});

describe("/leave", () => {
  it("ends the chat and goes idle without searching again", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    const c = await connect(server);
    await command(c, "session:start");
    const matchedC = arrivesWithin(c, "session:matched");

    expect(await command(a, "session:leave")).toEqual({ ok: true });
    // A is idle: /leave again is INVALID_STATE, /next is INVALID_STATE, /start works.
    expect(await command(a, "session:leave")).toEqual({ ok: false, error: { code: "INVALID_STATE" } });
    expect(await command(a, "session:next")).toEqual({ ok: false, error: { code: "INVALID_STATE" } });
    // C is not paired with A or with B, because nobody was re-enqueued.
    expect(await matchedC).toBe(false);
    expect(await command(b, "session:leave")).toEqual({ ok: true }); // ENDED -> READY
  });

  it("is not rate limited", async () => {
    server = await startServer();
    const a = await connect(server);
    for (let i = 0; i < 15; i++) {
      expect(await command(a, "session:leave")).toEqual({ ok: false, error: { code: "INVALID_STATE" } });
    }
  });
});
