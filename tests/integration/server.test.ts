import { afterEach, describe, expect, it } from "vitest";
import { PROTOCOL_VERSION, RULES_VERSION } from "../../src/types/events.js";
import {
  ORIGIN,
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

describe("HTTP", () => {
  it("GET /health is ok, uncached, and coarse", async () => {
    server = await startServer();
    const res = await fetch(`${server.url}/health`);
    const body = (await res.json()) as Record<string, any>;
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(body.status).toBe("ok");
    expect(body.checks).toEqual({ memory: "ok", connections: "ok", socketio: "ok" });
    expect(body.version).toBe(PROTOCOL_VERSION);
  });

  it("GET /health hides exact numbers in production unless the health key is sent", async () => {
    const key = "k".repeat(24);
    server = await startServer({ NODE_ENV: "production", HEALTH_KEY: key });
    const anonymous = (await (await fetch(`${server.url}/health`)).json()) as Record<string, any>;
    const wrongKey = (await (await fetch(`${server.url}/health`, { headers: { "x-health-key": "nope" } })).json()) as Record<string, any>;
    const operator = (await (await fetch(`${server.url}/health`, { headers: { "x-health-key": key } })).json()) as Record<string, any>;
    expect(anonymous.details).toBeUndefined();
    expect(wrongKey.details).toBeUndefined();
    expect(operator.details.connections).toBe(0);
    expect(operator.details.rssMb).toBeGreaterThan(0);
  });

  it("sends the security headers", async () => {
    server = await startServer({ NODE_ENV: "production" });
    const res = await fetch(`${server.url}/`);
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("connect-src 'self' wss://chat.test");
    expect(csp).toContain("report-uri /csp-report");
    expect(csp).toContain("report-to csp");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("permissions-policy")).toContain("camera=()");
    expect(res.headers.get("strict-transport-security")).toBe("max-age=63072000; includeSubDomains");
    expect(res.headers.get("x-powered-by")).toBeNull();
  });

  it("does not send HSTS outside production", async () => {
    server = await startServer();
    const res = await fetch(`${server.url}/`);
    expect(res.headers.get("strict-transport-security")).toBeNull();
  });

  it("serves the page with no inline scripts (so the CSP can forbid them)", async () => {
    server = await startServer();
    const html = await (await fetch(`${server.url}/`)).text();
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    for (const tag of scripts) expect(tag).toContain("src=");
    expect(html).not.toMatch(/\son[a-z]+=/i); // no inline event handlers
    expect(html).not.toMatch(/\sstyle=/i);
  });

  it("GET /connect-token issues an uncached token and refuses other websites", async () => {
    server = await startServer({ PREVIEW_BANNER: "true" });
    const ok = await fetch(`${server.url}/connect-token`, { headers: { "sec-fetch-site": "same-origin" } });
    const body = (await ok.json()) as Record<string, any>;
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(body.token).toMatch(/^[\w-]+\.[\w-]+$/);
    expect(body.preview).toBe(true);
    expect(body.rulesVersion).toBe(RULES_VERSION);

    const crossSite = await fetch(`${server.url}/connect-token`, { headers: { "sec-fetch-site": "cross-site" } });
    expect(crossSite.status).toBe(403);
  });

  it("rate limits /connect-token", async () => {
    server = await startServer();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await fetch(`${server.url}/connect-token`)).status);
    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("accepts CSP reports, logs only directive + blocked origin, survives junk", async () => {
    server = await startServer();
    const report = {
      "csp-report": {
        "document-uri": "https://chat.test/?private=1",
        "violated-directive": "script-src",
        "blocked-uri": "https://evil.example/x.js?victim=1",
      },
    };
    const res = await fetch(`${server.url}/csp-report`, {
      method: "POST",
      headers: { "content-type": "application/csp-report" },
      body: JSON.stringify(report),
    });
    expect(res.status).toBe(204);
    const line = server.logs.find((entry) => entry.includes("csp_violation")) ?? "";
    expect(JSON.parse(line).data).toEqual({ directive: "script-src", blocked: "https://evil.example" });
    expect(line).not.toContain("private=1");

    const junk = await fetch(`${server.url}/csp-report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(junk.status).toBe(400);
    const tooBig = await fetch(`${server.url}/csp-report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pad: "x".repeat(10_000) }),
    });
    expect(tooBig.status).toBe(413);
    expect((await fetch(`${server.url}/health`)).status).toBe(200);
  });

  it("answers unknown paths with a plain 404", async () => {
    server = await startServer();
    const res = await fetch(`${server.url}/nope`);
    expect(res.status).toBe(404);
  });
});

describe("WebSocket handshake", () => {
  it("connects with an allowed origin, a fresh token, the right version and consent", async () => {
    server = await startServer();
    const socket = await connect(server);
    expect(socket.connected).toBe(true);
  });

  it("refuses another website's origin", async () => {
    server = await startServer();
    await expect(connect(server, { origin: "https://evil.example" })).rejects.toThrow();
  });

  it("refuses a missing origin", async () => {
    server = await startServer();
    await expect(connect(server, { origin: null })).rejects.toThrow();
  });

  it("refuses a missing, garbage or reused token with AUTH_REQUIRED", async () => {
    server = await startServer();
    const consent = { adult: true, rulesVersion: RULES_VERSION };
    await expect(connect(server, { auth: { protocolVersion: PROTOCOL_VERSION, consent } })).rejects.toThrow("AUTH_REQUIRED");
    await expect(connect(server, { authOverrides: { token: "garbage" } })).rejects.toThrow("AUTH_REQUIRED");

    const token = await server.token();
    await connect(server, { authOverrides: { token } });
    await expect(connect(server, { authOverrides: { token } })).rejects.toThrow("AUTH_REQUIRED");
  });

  it("refuses an expired token", async () => {
    server = await startServer();
    const token = await server.token();
    server.clock.advance(30_000);
    await expect(connect(server, { authOverrides: { token } })).rejects.toThrow("AUTH_REQUIRED");
  });

  it("refuses a wrong or missing protocol version with PROTOCOL_MISMATCH", async () => {
    server = await startServer();
    await expect(connect(server, { authOverrides: { protocolVersion: "rc/v0" } })).rejects.toThrow("PROTOCOL_MISMATCH");
    await expect(connect(server, { auth: {} })).rejects.toThrow("PROTOCOL_MISMATCH");
  });

  it("refuses missing, false or outdated consent with CONSENT_REQUIRED", async () => {
    server = await startServer();
    await expect(connect(server, { authOverrides: { consent: undefined } })).rejects.toThrow("CONSENT_REQUIRED");
    await expect(connect(server, { authOverrides: { consent: { adult: false, rulesVersion: RULES_VERSION } } })).rejects.toThrow("CONSENT_REQUIRED");
    await expect(connect(server, { authOverrides: { consent: { adult: true, rulesVersion: "2020-old" } } })).rejects.toThrow("CONSENT_REQUIRED");
  });

  it("refuses unknown handshake fields with VALIDATION", async () => {
    server = await startServer();
    await expect(connect(server, { authOverrides: { extra: "field" } })).rejects.toThrow("VALIDATION");
  });

  it("refuses everyone in maintenance mode", async () => {
    server = await startServer({ MAINTENANCE_MODE: "1" });
    expect((await fetch(`${server.url}/connect-token`)).status).toBe(503);
    await expect(connect(server, { authOverrides: { token: "x" } })).rejects.toThrow("MAINTENANCE");
  });

  it("limits new connections to 5 per IP per 10 seconds", async () => {
    server = await startServer({ MAX_SOCKETS_PER_IP: "50" });
    for (let i = 0; i < 5; i++) await connect(server);
    await expect(connect(server)).rejects.toThrow();
    server.clock.advance(2000); // one handshake token refills
    await expect(connect(server)).resolves.toBeDefined();
  });

  it("caps open sockets per IP at 5 and frees the slot on disconnect", async () => {
    server = await startServer();
    const first = await connect(server);
    for (let i = 0; i < 4; i++) await connect(server);
    server.clock.advance(10_000); // refill the handshake limiter: this test is about the cap
    await expect(connect(server)).rejects.toThrow("TOO_MANY_CONNECTIONS");

    first.disconnect();
    await expect.poll(() => server.logs.some((line) => line.includes("ws_disconnect"))).toBe(true);
    await expect(connect(server)).resolves.toBeDefined();
  });
});

describe("e2e:envelope", () => {
  it("relays the envelope to the partner unchanged, adding nothing of its own", async () => {
    server = await startServer();
    const { a: alice, b: bob } = await pair(server);
    const received = next<Record<string, any>>(bob, "e2e:envelope");
    const sealed = await channelOf(alice).seal({ t: "msg", text: "hello bob" });

    expect(await sendRaw(alice, sealed)).toEqual({ ok: true });
    const envelope = await received;
    // Exactly what was sent: no name, no id, no time, no session id.
    expect(envelope).toEqual(sealed);
    expect(Object.keys(envelope).sort()).toEqual(["ct", "seq"]);
    expect(await channelOf(bob).open(envelope)).toEqual({ t: "msg", text: "hello bob" });
  });

  it.each([
    ["a bare string", "hello"],
    ["a number", 42],
    ["null", null],
    ["an empty object", {}],
    ["a plaintext message", { text: "hello" }],
    ["a plaintext message next to a valid envelope", { seq: 1, ct: "A".repeat(107), text: "hello" }],
    ["no ciphertext", { seq: 1 }],
    ["no number", { ct: "A".repeat(107) }],
    ["number 0", { seq: 0, ct: "A".repeat(107) }],
    ["a negative number", { seq: -1, ct: "A".repeat(107) }],
    ["a fractional number", { seq: 1.5, ct: "A".repeat(107) }],
    ["a number as a string", { seq: "1", ct: "A".repeat(107) }],
    ["a number past 2^32 - 1", { seq: 2 ** 32, ct: "A".repeat(107) }],
    ["empty ciphertext", { seq: 1, ct: "" }],
    ["ciphertext too short to be real", { seq: 1, ct: "A".repeat(106) }],
    ["ciphertext over 3,000 characters", { seq: 1, ct: "A".repeat(3001) }],
    ["ciphertext that is not base64url", { seq: 1, ct: `${"A".repeat(106)}!` }],
    ["ciphertext with base64 padding", { seq: 1, ct: `${"A".repeat(106)}=` }],
    ["ciphertext that is an object", { seq: 1, ct: { $gt: "" } }],
  ])("rejects %s with VALIDATION and keeps running", async (_name, payload) => {
    server = await startServer();
    const { a: socket, b: partner } = await pair(server);
    const relayed = arrivesWithin(partner, "e2e:envelope", 100);
    expect(await sendRaw(socket, payload)).toEqual({ ok: false, error: { code: "VALIDATION" } });
    expect(await relayed).toBe(false);
    expect(await send(socket, "still alive")).toEqual({ ok: true });
  });

  it("allows 5 messages in a burst, then says slow down, then recovers", async () => {
    server = await startServer();
    const { a: socket } = await pair(server);
    for (let i = 0; i < 5; i++) expect(await send(socket, `m${i}`)).toEqual({ ok: true });
    expect(await send(socket, "m5")).toEqual({
      ok: false,
      error: { code: "RATE_LIMITED", retryAfterMs: 2000 },
    });
    server.clock.advance(2000);
    expect(await send(socket, "m6")).toEqual({ ok: true });
  });

  it("rate limits each socket separately", async () => {
    server = await startServer();
    const { a: noisy, b: quiet } = await pair(server);
    for (let i = 0; i < 6; i++) await send(noisy, "spam");
    expect(await send(quiet, "hi")).toEqual({ ok: true });
  });

  it("drops a client that sends more than 4 KB, and keeps serving others", async () => {
    server = await startServer();
    const { a: big, b: other } = await pair(server);
    const dropped = new Promise<string>((resolve) => big.once("disconnect", resolve));
    const partnerTold = next<Record<string, string>>(other, "partner:status");
    big.emit("e2e:envelope", { seq: 1, ct: "A".repeat(10_000) });
    await dropped;
    expect(big.connected).toBe(false);
    // To the server this looks like a dropped link, so the partner is told
    // and the chat is held for the grace period. Others are served as usual.
    expect((await partnerTold).state).toBe("reconnecting");
    expect(await send(other, "fine")).toEqual({ ok: true });
  });

  it("survives a client that sends no ack callback", async () => {
    server = await startServer();
    const { a: socket } = await pair(server);
    socket.emit("e2e:envelope", { bad: true });
    socket.emit("e2e:envelope", await channelOf(socket).seal({ t: "msg", text: "no ack" }));
    socket.emit("e2e:key", { bad: true });
    expect(await send(socket, "ok")).toEqual({ ok: true });
  });
});

describe("privacy of logs", () => {
  it("never logs raw IPs, message text, tokens or full IP hashes", async () => {
    server = await startServer();
    const token = await server.token();
    const other = await connect(server);
    const socket = await connect(server, { authOverrides: { token } });
    const matchedOther = next<Matched>(other, "session:matched");
    const matchedSocket = next<Matched>(socket, "session:matched");
    await command(other, "session:start");
    await command(socket, "session:start");
    await exchangeKeys(other, socket, await matchedOther, await matchedSocket);
    const sealed = await channelOf(socket).seal({ t: "msg", text: "my-secret-message-0917" });
    expect(await sendRaw(socket, sealed)).toEqual({ ok: true });
    await sendRaw(socket, { nope: "my-secret-message-0917" });
    // Events that no longer exist must not be logged with their payload either.
    socket.emit("chat:send", { text: "my-secret-message-0917" });
    await connect(server, { origin: "https://evil.example" }).catch(() => {});
    socket.disconnect();
    await expect.poll(() => server.logs.some((line) => line.includes("ws_disconnect"))).toBe(true);

    const all = server.logs.join("\n");
    expect(server.logs.length).toBeGreaterThan(3);
    expect(all).not.toContain("127.0.0.1");
    expect(all).not.toContain("::1");
    expect(all).not.toContain("my-secret-message");
    // Not the ciphertext either, nor anyone's public key: the logs say that
    // something happened, never what was in it.
    expect(all).not.toContain(sealed.ct);
    expect(all).not.toContain(sealed.ct.slice(0, 24));
    expect(all).not.toContain(await channelOf(socket).publicKey());
    expect(all).toContain("session_secured");
    expect(all).not.toContain(token);
    expect(all).not.toMatch(/[0-9a-f]{64}/);
    for (const line of server.logs) {
      const entry = JSON.parse(line) as Record<string, unknown>;
      expect(entry).toHaveProperty("ts");
      expect(entry).toHaveProperty("level");
      expect(entry).toHaveProperty("event");
    }
  });

  it("gives every connection its own correlation id on connect and disconnect", async () => {
    server = await startServer();
    const a = await connect(server);
    await connect(server);
    a.disconnect();
    await expect.poll(() => server.logs.some((line) => line.includes("ws_disconnect"))).toBe(true);
    const entries = server.logs.map((line) => JSON.parse(line) as Record<string, any>);
    const connects = entries.filter((entry) => entry.event === "ws_connect");
    const disconnect = entries.find((entry) => entry.event === "ws_disconnect");
    expect(connects).toHaveLength(2);
    expect(connects[0]?.correlationId).toMatch(/^[0-9a-f]{8}$/);
    expect(connects[0]?.correlationId).not.toBe(connects[1]?.correlationId);
    expect(disconnect?.correlationId).toBe(connects[0]?.correlationId);
  });
});

describe("shutdown", () => {
  it("closes open sockets and stops accepting requests", async () => {
    server = await startServer();
    const socket = await connect(server);
    const dropped = new Promise<string>((resolve) => socket.once("disconnect", resolve));
    await server.close();
    await dropped;
    await expect(fetch(`${server.url}/health`)).rejects.toThrow();
    await expect(connect(server, { authOverrides: { token: "x" }, origin: ORIGIN })).rejects.toThrow();
  });
});
