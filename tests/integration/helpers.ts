import type { AddressInfo } from "node:net";
import { io as connectClient } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { buildServer } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { FakeClock } from "../../src/lib/clock.js";
import { createLogger } from "../../src/observability/logger.js";
import { PROTOCOL_VERSION, RULES_VERSION } from "../../src/types/events.js";

export const ORIGIN = "https://chat.test";

export interface TestServer {
  url: string;
  clock: FakeClock;
  logs: string[];
  sockets: Socket[];
  token(): Promise<string>;
  close(): Promise<void>;
}

// Starts a real server on a random free port, with a fake clock (so rate
// limits can be fast-forwarded) and logs captured in memory.
export async function startServer(env: Record<string, string> = {}): Promise<TestServer> {
  const clock = new FakeClock(Date.UTC(2026, 0, 1));
  const logs: string[] = [];
  const config = loadConfig({ NODE_ENV: "test", ALLOWED_ORIGINS: ORIGIN, LOG_LEVEL: "debug", ...env });
  const logger = createLogger({ level: config.logLevel, write: (line) => logs.push(line), clock });
  const { httpServer, shutdown } = buildServer({ config, logger, clock });
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  const sockets: Socket[] = [];

  return {
    url,
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
}

// Resolves with the connected socket, or rejects with the refusal message.
export async function connect(server: TestServer, options: ConnectOptions = {}): Promise<Socket> {
  const origin = options.origin === undefined ? ORIGIN : options.origin;
  const auth = options.auth ?? {
    protocolVersion: PROTOCOL_VERSION,
    token: await server.token(),
    consent: { adult: true, rulesVersion: RULES_VERSION },
    ...options.authOverrides,
  };
  const socket = connectClient(server.url, {
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
    auth,
    ...(origin === null ? {} : { extraHeaders: { origin } }),
  });
  server.sockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (err) => reject(new Error(err.message)));
  });
}

export function send(socket: Socket, payload: unknown): Promise<any> {
  return socket.timeout(2000).emitWithAck("chat:send", payload);
}
