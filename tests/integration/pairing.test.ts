import { afterEach, describe, expect, it } from "vitest";
import { command, connect, next, pair, send, startServer } from "./helpers.js";
import type { TestServer } from "./helpers.js";

let server: TestServer;
afterEach(async () => {
  await server?.close();
});

// Resolves true if the event arrives within `ms`, false otherwise.
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

describe("1:1 pairing", () => {
  it("pairs two clients that /start and gives each a different random name", async () => {
    server = await startServer();
    const a = await connect(server);
    const b = await connect(server);
    const matchedA = next<Record<string, string>>(a, "session:matched");
    const matchedB = next<Record<string, string>>(b, "session:matched");

    expect(await command(a, "session:start")).toEqual({ ok: true });
    expect(await command(b, "session:start")).toEqual({ ok: true });
    const [infoA, infoB] = await Promise.all([matchedA, matchedB]);

    expect(infoA.sessionId).toBe(infoB.sessionId);
    expect(infoA.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(infoA.myName).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);
    expect(infoA.myName).not.toBe(infoA.partnerName);
    expect(infoA.partnerName).toBe(infoB.myName);
    expect(infoB.partnerName).toBe(infoA.myName);
  });

  it("delivers A's message to B only, never to a waiting C", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    const c = await connect(server);
    await command(c, "session:start");

    const toB = next<Record<string, any>>(b, "chat:message");
    const cHears = arrivesWithin(c, "chat:message");
    expect(await send(a, { text: "psst" })).toEqual({ ok: true });
    expect((await toB).text).toBe("psst");
    expect(await cHears).toBe(false);
  });

  it("leaves C searching, not paired with A or B", async () => {
    server = await startServer();
    await pair(server);
    const c = await connect(server);
    const matchedC = arrivesWithin(c, "session:matched");
    expect(await command(c, "session:start")).toEqual({ ok: true });
    expect(await matchedC).toBe(false);
  });

  it("pairs C with the next person to start", async () => {
    server = await startServer();
    await pair(server);
    server.clock.advance(10_000); // refill the handshake limiter
    const c = await connect(server);
    const d = await connect(server);
    const matched = next(c, "session:matched");
    await command(c, "session:start");
    await command(d, "session:start");
    expect(await matched).toBeDefined();
  });

  it("refuses chat:send with NOT_IN_SESSION before being paired", async () => {
    server = await startServer();
    const a = await connect(server);
    expect(await send(a, { text: "hello?" })).toEqual({ ok: false, error: { code: "NOT_IN_SESSION" } });
    await command(a, "session:start");
    expect(await send(a, { text: "still waiting" })).toEqual({ ok: false, error: { code: "NOT_IN_SESSION" } });
  });

  it("refuses /start while searching or chatting with INVALID_STATE", async () => {
    server = await startServer();
    const { a } = await pair(server);
    expect(await command(a, "session:start")).toEqual({ ok: false, error: { code: "INVALID_STATE" } });
  });

  it("rejects /start with extra fields", async () => {
    server = await startServer();
    const a = await connect(server);
    expect(await command(a, "session:start", { evil: true })).toEqual({ ok: false, error: { code: "VALIDATION" } });
  });

  it("lets a waiting client cancel with /leave and not get paired later", async () => {
    server = await startServer();
    const a = await connect(server);
    const b = await connect(server);
    await command(a, "session:start");
    const ended = next<Record<string, string>>(a, "session:ended");
    expect(await command(a, "session:leave")).toEqual({ ok: true });
    expect((await ended).reason).toBe("left");

    const matchedB = arrivesWithin(b, "session:matched");
    await command(b, "session:start");
    expect(await matchedB).toBe(false);
  });
});
