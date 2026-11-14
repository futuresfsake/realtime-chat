import type { AddressInfo } from "node:net";
import { io as connectClient } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { buildServer } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import type { Config } from "../../src/config.js";
import { FakeClock } from "../../src/lib/clock.js";
import { createLogger } from "../../src/observability/logger.js";
import { ALLOWED_REACTIONS, PROTOCOL_VERSION, RULES_VERSION } from "../../src/types/events.js";
import { loadE2ee } from "../helpers/e2ee.js";
import type { Channel, Envelope, Plain } from "../helpers/e2ee.js";

export const ORIGIN = "https://chat.test";

export interface TestServer {
  url: string;
  io: ReturnType<typeof buildServer>["io"]; // for tests that watch what crosses the server
  clock: FakeClock;
  logs: string[];
  sockets: Socket[];
  token(): Promise<string>;
  close(): Promise<void>;
}

// Ports above 1023 on the fetch standard's "bad port" list. fetch() fails with
// "bad port" for these, whatever is listening there.
export const FETCH_BLOCKED_PORTS: ReadonlySet<number> = new Set([
  1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080,
]);

function listen(httpServer: ReturnType<typeof buildServer>["httpServer"]): Promise<number> {
  return new Promise((resolve) => {
    httpServer.listen(0, "127.0.0.1", () => resolve((httpServer.address() as AddressInfo).port));
  });
}

// Starts a real server on a random free port, with a fake clock (so rate
// limits can be fast-forwarded) and logs captured in memory.
// `overrides` replaces fixed limits (e.g. a short reconnect grace period), so
// timing behaviour can be tested without waiting 30 real seconds.
export async function startServer(
  env: Record<string, string> = {},
  overrides: Partial<Config> = {},
): Promise<TestServer> {
  const clock = new FakeClock(Date.UTC(2026, 0, 1));
  const logs: string[] = [];
  const config: Config = {
    ...loadConfig({ NODE_ENV: "test", ALLOWED_ORIGINS: ORIGIN, LOG_LEVEL: "debug", ...env }),
    ...overrides,
  };
  const logger = createLogger({ level: config.logLevel, write: (line) => logs.push(line), clock });

  // The OS picks the port. Now and then it picks one that fetch() refuses to
  // talk to ("bad port"), which used to fail a few tests at random. If that
  // happens, throw this server away and build another.
  let built = buildServer({ config, logger, clock });
  let port = await listen(built.httpServer);
  while (FETCH_BLOCKED_PORTS.has(port)) {
    await built.shutdown();
    built = buildServer({ config, logger, clock });
    port = await listen(built.httpServer);
  }
  const { shutdown, io } = built;
  const url = `http://127.0.0.1:${port}`;
  const sockets: Socket[] = [];

  return {
    url,
    io,
    clock,
    logs,
    sockets,
    async token() {
      const res = await fetch(`${url}/connect-token`);
      return ((await res.json()) as { token: string }).token;
    },
    async close() {
      for (const socket of sockets) socket.disconnect();
      await shutdown();
    },
  };
}

export interface ConnectOptions {
  origin?: string | null; // null = send no Origin header
  auth?: Record<string, unknown>; // replaces the default auth entirely
  authOverrides?: Record<string, unknown>; // merged over the default auth
  // Reconnect by itself after a drop, like the browser does, waiting this
  // long first. Each attempt fetches a fresh token.
  reconnectAfterMs?: number;
}

// Resolves with the connected socket, or rejects with the refusal message.
export async function connect(server: TestServer, options: ConnectOptions = {}): Promise<Socket> {
  const origin = options.origin === undefined ? ORIGIN : options.origin;
  const freshAuth = async () => ({
    protocolVersion: PROTOCOL_VERSION,
    token: await server.token(),
    consent: { adult: true, rulesVersion: RULES_VERSION },
    ...options.authOverrides,
  });
  const reconnects = options.reconnectAfterMs !== undefined;
  const socket = connectClient(server.url, {
    transports: ["websocket"],
    reconnection: reconnects,
    reconnectionDelay: options.reconnectAfterMs ?? 0,
    reconnectionDelayMax: options.reconnectAfterMs ?? 0,
    randomizationFactor: 0,
    forceNew: true,
    auth: reconnects
      ? (cb: (data: object) => void) => void freshAuth().then(cb)
      : (options.auth ?? (await freshAuth())),
    ...(origin === null ? {} : { extraHeaders: { origin } }),
  });
  server.sockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (err) => reject(new Error(err.message)));
  });
}

// ---------- End-to-end encryption, as the page does it ----------
// The browser's own crypto code (public/js/crypto.js), loaded once. Test
// clients encrypt and decrypt with it, so the server is tested against the
// real thing and never sees a readable message from these tests either.
export const e2ee = loadE2ee();

// Each test client's keys for its current chat, like the page's `channel`.
const channels = new WeakMap<Socket, Channel>();

export function channelOf(socket: Socket): Channel {
  const channel = channels.get(socket);
  if (!channel) throw new Error("this test client has no keys: it never finished a key exchange");
  return channel;
}

// A client that reconnects as a new socket object keeps the keys of its chat.
export function keepChannel(from: Socket, to: Socket): void {
  channels.set(to, channelOf(from));
}

export interface Matched {
  sessionId: string;
  myName: string;
  partnerName: string;
  role: string;
}

// Both clients make fresh keys, swap the public halves through the server and
// derive the message keys. Resolves when both can send.
export async function exchangeKeys(a: Socket, b: Socket, infoA: Matched, infoB: Matched): Promise<void> {
  const channelA = e2ee.createChannel({ sessionId: infoA.sessionId, role: infoA.role, allowedReactions: ALLOWED_REACTIONS });
  const channelB = e2ee.createChannel({ sessionId: infoB.sessionId, role: infoB.role, allowedReactions: ALLOWED_REACTIONS });
  channels.set(a, channelA);
  channels.set(b, channelB);
  const keyForA = next<{ publicKey: string }>(a, "e2e:key");
  const keyForB = next<{ publicKey: string }>(b, "e2e:key");
  const ackA = await sendKey(a, { publicKey: await channelA.publicKey() });
  const ackB = await sendKey(b, { publicKey: await channelB.publicKey() });
  if (!ackA.ok || !ackB.ok) throw new Error(`key exchange refused: ${JSON.stringify([ackA, ackB])}`);
  await channelA.receiveKey((await keyForA).publicKey);
  await channelB.receiveKey((await keyForB).publicKey);
}

export function sendKey(socket: Socket, payload: unknown): Promise<any> {
  return socket.timeout(2000).emitWithAck("e2e:key", payload);
}

// A well-formed envelope with nothing real inside: for asking the server
// "would you relay this?" from a client that has no keys.
export const NOISE_ENVELOPE: Envelope = { seq: 1, ct: "A".repeat(107) };

// Sends any payload as an envelope, exactly as given.
export function sendRaw(socket: Socket, payload: unknown): Promise<any> {
  return socket.timeout(2000).emitWithAck("e2e:envelope", payload);
}

// Encrypts a message the way the page does and hands the envelope to the
// server. Resolves with the server's ack. A client without keys (not in a
// chat) sends noise instead, to see how the server answers.
export async function send(socket: Socket, text: string): Promise<any> {
  const channel = channels.get(socket);
  return sendRaw(socket, channel?.ready ? await channel.seal({ t: "msg", text }) : NOISE_ENVELOPE);
}

export async function react(socket: Socket, ref: number, emoji: string): Promise<any> {
  return sendRaw(socket, await channelOf(socket).seal({ t: "react", ref, emoji }));
}

// The next message or reaction from the partner, decrypted with this
// client's keys. Rejects if it does not decrypt.
export async function nextPlain(socket: Socket): Promise<Plain> {
  const envelope = await next<Envelope>(socket, "e2e:envelope");
  return channelOf(socket).open(envelope);
}

// The text of the next message from the partner.
export async function nextText(socket: Socket): Promise<string> {
  const plain = await nextPlain(socket);
  if (plain.t !== "msg") throw new Error(`expected a message, got a ${plain.t}`);
  return plain.text;
}

// Collects the text of every message this client receives from now on.
export function collectTexts(socket: Socket): string[] {
  const texts: string[] = [];
  socket.on("e2e:envelope", (envelope: Envelope) => {
    void channelOf(socket)
      .open(envelope)
      .then((plain) => {
        if (plain.t === "msg") texts.push(plain.text);
      });
  });
  return texts;
}

export function command(socket: Socket, event: "session:start" | "session:next" | "session:leave", payload: unknown = {}): Promise<any> {
  return socket.timeout(2000).emitWithAck(event, payload);
}

export function next<T = any>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

// Resolves true if the event arrives within `ms`, false otherwise.
export function arrivesWithin(socket: Socket, event: string, ms = 150): Promise<boolean> {
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

// Simulates a network drop: the link dies without the client saying goodbye.
// (socket.disconnect() would be a deliberate goodbye instead.)
export function dropConnection(socket: Socket): void {
  socket.io.engine.close();
}

// What the Socket.IO client would send to be restored as the same socket.
export function recoveryAuth(socket: Socket): { pid: string; offset: string } {
  const internals = socket as unknown as { _pid: string; _lastOffset: string };
  return { pid: internals._pid, offset: internals._lastOffset };
}

// Connects two clients, pairs them and (unless `secure: false`) completes the
// key exchange, so they can talk. Returns both sockets and what each was told.
export async function pair(
  server: TestServer,
  options: { a?: ConnectOptions; b?: ConnectOptions; secure?: boolean } = {},
): Promise<{ a: Socket; b: Socket; sessionId: string; infoA: Matched; infoB: Matched }> {
  const a = await connect(server, options.a);
  const b = await connect(server, options.b);
  const matchedA = next<Matched>(a, "session:matched");
  const matchedB = next<Matched>(b, "session:matched");
  await command(a, "session:start");
  await command(b, "session:start");
  const [infoA, infoB] = await Promise.all([matchedA, matchedB]);
  if (options.secure !== false) await exchangeKeys(a, b, infoA, infoB);
  return { a, b, sessionId: infoA.sessionId, infoA, infoB };
}
