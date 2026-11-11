import { afterEach, describe, expect, it } from "vitest";
import { command, connect, next, pair, send, startServer } from "./helpers.js";
import type { TestServer } from "./helpers.js";

let server: TestServer;
afterEach(async () => {
  await server?.close();
});

const NOT_IN_SESSION = { ok: false, error: { code: "NOT_IN_SESSION" } };

describe("session isolation", () => {
  it("refuses a third client that sends with A and B's session id", async () => {
    server = await startServer();
    const { sessionId } = await pair(server);
    const c = await connect(server);
    expect(await send(c, { text: "let me in", sessionId })).toEqual(NOT_IN_SESSION);
  });

  it("refuses a chatting client that names someone else's session id", async () => {
    server = await startServer();
    const { sessionId } = await pair(server);
    server.clock.advance(10_000);
    const c = await connect(server);
    const d = await connect(server);
    await command(c, "session:start");
    await command(d, "session:start");
    expect(await send(c, { text: "hijack", sessionId })).toEqual(NOT_IN_SESSION);
  });

  it("refuses a forged (random) session id", async () => {
    server = await startServer();
    const { a } = await pair(server);
    expect(await send(a, { text: "hi", sessionId: "6f1c2b0e-0000-4000-8000-000000000000" })).toEqual(NOT_IN_SESSION);
  });

  it("accepts the real session id", async () => {
    server = await startServer();
    const { a, sessionId } = await pair(server);
    expect(await send(a, { text: "hi", sessionId })).toEqual({ ok: true });
  });

  it("tells B when A leaves, and B can no longer send", async () => {
    server = await startServer();
    const { a, b, sessionId } = await pair(server);
    const endedForB = next<Record<string, string>>(b, "session:ended");
    const endedForA = next<Record<string, string>>(a, "session:ended");

    expect(await command(a, "session:leave")).toEqual({ ok: true });
    expect((await endedForB).reason).toBe("partner_left");
    expect((await endedForA).reason).toBe("left");

    expect(await send(b, { text: "anyone?" })).toEqual(NOT_IN_SESSION);
    expect(await send(b, { text: "anyone?", sessionId })).toEqual(NOT_IN_SESSION);
    expect(await send(a, { text: "bye" })).toEqual(NOT_IN_SESSION);
  });

  it("tells B when A disconnects", async () => {
    server = await startServer();
    const { a, b } = await pair(server);
    const endedForB = next<Record<string, string>>(b, "session:ended");
    a.disconnect();
    expect((await endedForB).reason).toBe("partner_left");
    expect(await send(b, { text: "hello?" })).toEqual(NOT_IN_SESSION);
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
});
