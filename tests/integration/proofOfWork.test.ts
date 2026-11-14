import { createHash } from "node:crypto";
import { io as connectClient } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import { leadingZeroBits } from "../../src/security/proofOfWork.js";
import { PROTOCOL_VERSION, RULES_VERSION } from "../../src/types/events.js";
import { ORIGIN, startServer } from "./helpers.js";
import type { TestServer } from "./helpers.js";

let server: TestServer;
afterEach(async () => {
  await server?.close();
});

const BITS = 8;
const solve = (challenge: string, bits = BITS): string => {
  for (let n = 0; ; n++) {
    if (leadingZeroBits(createHash("sha256").update(`${challenge}:${n}`).digest()) >= bits) return String(n);
  }
};
const get = (path: string, forwardedFor?: string) =>
  fetch(`${server.url}${path}`, forwardedFor ? { headers: { "x-forwarded-for": forwardedFor } } : {});
const challenge = async (forwardedFor?: string) =>
  (await (await get("/pow-challenge", forwardedFor)).json()) as { challenge: string; bits: number };

describe("proof of work (US-39)", () => {
  it("issues a challenge, and a connection token only for a correct answer", async () => {
    server = await startServer({ POW_DIFFICULTY_BITS: String(BITS) });
    const res = await get("/pow-challenge");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const { challenge: c, bits } = (await res.json()) as { challenge: string; bits: number };
    expect(bits).toBe(BITS);

    const ok = await get(`/connect-token?c=${encodeURIComponent(c)}&n=${solve(c)}`);
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { token: string }).token).toBeTruthy();
  });

  it("refuses a token request with no answer, a wrong answer, or junk, and says only 'POW_REQUIRED'", async () => {
    server = await startServer({ POW_DIFFICULTY_BITS: String(BITS) });
    const { challenge: c } = await challenge();
    let wrong = 0;
    while (leadingZeroBits(createHash("sha256").update(`${c}:${wrong}`).digest()) >= BITS) wrong++;
    for (const query of ["", `?c=${encodeURIComponent(c)}`, `?c=${encodeURIComponent(c)}&n=${wrong}`, "?c=junk&n=1", "?n=1", `?c=${c}&n=abc`]) {
      const res = await get(`/connect-token${query}`);
      expect(res.status, query).toBe(403);
      expect(await res.json(), query).toEqual({ error: { code: "POW_REQUIRED" } });
    }
    // The wrong guess did not burn the challenge: the right one still works.
    expect((await get(`/connect-token?c=${encodeURIComponent(c)}&n=${solve(c)}`)).status).toBe(200);
  });

  it("an answer works only once", async () => {
    server = await startServer({ POW_DIFFICULTY_BITS: String(BITS) });
    const { challenge: c } = await challenge();
    const url = `/connect-token?c=${encodeURIComponent(c)}&n=${solve(c)}`;
    expect((await get(url)).status).toBe(200);
    expect((await get(url)).status).toBe(403);
  });

  it("a challenge cannot be passed to someone on another address", async () => {
    server = await startServer({ POW_DIFFICULTY_BITS: String(BITS), TRUST_PROXY_HOPS: "1" });
    const { challenge: c } = await challenge("7.0.0.1");
    const url = `/connect-token?c=${encodeURIComponent(c)}&n=${solve(c)}`;
    expect((await get(url, "7.0.0.2")).status).toBe(403); // a bot farm cannot buy answers for others
    expect((await get(url, "7.0.0.1")).status).toBe(200);
  });

  it("is rate limited: a burst of five, then about one every ten seconds", async () => {
    server = await startServer({ POW_DIFFICULTY_BITS: String(BITS) });
    for (let i = 0; i < 5; i++) expect((await get("/pow-challenge")).status).toBe(200);
    const refused = await get("/pow-challenge");
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    server.clock.advance(10_000);
    expect((await get("/pow-challenge")).status).toBe(200);
  });

  it("a connection made with an earned token works, and one without a token does not", async () => {
    server = await startServer({ POW_DIFFICULTY_BITS: String(BITS) });
    const { challenge: c } = await challenge();
    const { token } = (await (await get(`/connect-token?c=${encodeURIComponent(c)}&n=${solve(c)}`)).json()) as { token: string };
    const auth = { protocolVersion: PROTOCOL_VERSION, token, consent: { adult: true, rulesVersion: RULES_VERSION } };
    const open = (a: object) =>
      new Promise<string>((resolve) => {
        const socket = connectClient(server.url, { transports: ["websocket"], reconnection: false, forceNew: true, auth: a, extraHeaders: { origin: ORIGIN } });
        server.sockets.push(socket);
        socket.once("connect", () => resolve("connected"));
        socket.once("connect_error", (err) => resolve(err.message));
      });
    expect(await open(auth)).toBe("connected");
    expect(await open({ ...auth, token: "made-up" })).toBe("AUTH_REQUIRED");
  });

  it("logs a refusal with a reason code and a hash prefix only, never the challenge or the answer", async () => {
    server = await startServer({ POW_DIFFICULTY_BITS: String(BITS) });
    const { challenge: c } = await challenge();
    await get(`/connect-token?c=${encodeURIComponent(c)}&n=999999999`);
    const line = server.logs.find((l) => JSON.parse(l).event === "pow_refused");
    expect(line).toBeDefined();
    const entry = JSON.parse(line!);
    expect(Object.keys(entry.data).sort()).toEqual(["ipHashPrefix", "reason"]);
    expect(server.logs.join("\n")).not.toContain(c.split(".")[0]);
  });

  it("when switched off, the challenge says no work is needed and tokens are issued as before", async () => {
    server = await startServer({ POW_DIFFICULTY_BITS: "0" });
    expect(await (await get("/pow-challenge")).json()).toEqual({ bits: 0 });
    expect((await get("/connect-token")).status).toBe(200);
  });

  it("is on by default at 12 bits", async () => {
    const { loadConfig } = await import("../../src/config.js");
    expect(loadConfig({}).powBits).toBe(12);
    expect(() => loadConfig({ POW_DIFFICULTY_BITS: "25" })).toThrow();
    expect(() => loadConfig({ POW_DIFFICULTY_BITS: "-1" })).toThrow();
  });
});
