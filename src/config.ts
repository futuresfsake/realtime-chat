import { z } from "zod";

// Every limit and every environment variable lives here. A bad value makes
// loadConfig() throw, the process exits, the platform health check fails and
// the previous deploy keeps serving.

const flag = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

function parseOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

function isExactOrigin(value: string): boolean {
  if (value.includes("*")) return false; // wildcards never match: fail loudly instead
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  IP_HASH_SECRET: z.string().min(32).optional(),
  HEALTH_KEY: z.string().min(16).optional(),
  PREVIEW_BANNER: flag.default(false),
  MAINTENANCE_MODE: flag.default(false),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  MAX_SOCKETS_PER_IP: z.coerce.number().int().min(1).max(100).default(5),
  // Path to the DB-IP country database (.mmdb). Without it every country is unknown.
  COUNTRY_DB_PATH: z.string().min(1).optional(),
  // How long a search sticks to shared interests before accepting anyone (ms).
  INTEREST_WAIT_MS: z.coerce.number().int().min(500).max(60_000).default(10_000),
});

const RECONNECT_GRACE_MS = 30_000;
const ONLINE_BROADCAST_MS = 5_000;

export interface Config {
  port: number;
  nodeEnv: "development" | "production" | "test";
  allowedOrigins: string[];
  trustProxyHops: number;
  ipHashSecret: string | undefined;
  healthKey: string | undefined;
  previewBanner: boolean;
  maintenanceMode: boolean;
  logLevel: "error" | "warn" | "info" | "debug";
  maxSocketsPerIp: number;
  countryDbPath: string | undefined;
  interestWaitMs: number;
  matchSweepMs: number;
  noRematchMs: number;
  // Fixed limits (not configurable from the environment)
  maxPayloadBytes: number;
  messageBurstCapacity: number;
  messageRefillPerSec: number;
  handshakeBurstCapacity: number;
  handshakeRefillPerSec: number;
  connectTokenTtlMs: number;
  maxConnections: number;
  memoryCeilingMb: number;
  reconnectGraceMs: number;
  onlineBroadcastMs: number;
  recoveryWindowMs: number;
  keyExchangeTimeoutMs: number;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  // An empty variable ("FOO=") means "not set", so defaults apply.
  const present: Record<string, string> = {};
  for (const key of Object.keys(EnvSchema.shape)) {
    const value = env[key];
    if (value !== undefined && value.trim() !== "") present[key] = value.trim();
  }
  const parsed = EnvSchema.parse(present);

  const allowedOrigins = parseOrigins(parsed.ALLOWED_ORIGINS);
  if (allowedOrigins.length === 0) {
    throw new Error("ALLOWED_ORIGINS must list at least one origin");
  }
  for (const origin of allowedOrigins) {
    if (!isExactOrigin(origin)) {
      throw new Error(`ALLOWED_ORIGINS entry is not an exact origin (scheme://host[:port]): ${origin}`);
    }
    if (parsed.NODE_ENV === "production" && !origin.startsWith("https://")) {
      throw new Error(`ALLOWED_ORIGINS must be https in production: ${origin}`);
    }
  }

  return {
    port: parsed.PORT,
    nodeEnv: parsed.NODE_ENV,
    allowedOrigins,
    trustProxyHops: parsed.TRUST_PROXY_HOPS,
    ipHashSecret: parsed.IP_HASH_SECRET,
    healthKey: parsed.HEALTH_KEY,
    previewBanner: parsed.PREVIEW_BANNER,
    maintenanceMode: parsed.MAINTENANCE_MODE,
    logLevel: parsed.LOG_LEVEL,
    maxSocketsPerIp: parsed.MAX_SOCKETS_PER_IP,
    countryDbPath: parsed.COUNTRY_DB_PATH,
    interestWaitMs: parsed.INTEREST_WAIT_MS,
    // How often waiting searches are checked for an expired interest wait.
    matchSweepMs: 1_000,
    // Two people who skip or leave each other are not paired again for this long.
    noRematchMs: 24 * 60 * 60 * 1000,
    maxPayloadBytes: 4096,
    messageBurstCapacity: 5,
    messageRefillPerSec: 0.5,
    handshakeBurstCapacity: 5, // 5 new connections per IP ...
    handshakeRefillPerSec: 0.5, // ... per 10 seconds
    connectTokenTtlMs: 30_000,
    maxConnections: 500,
    memoryCeilingMb: 400, // matches --max-old-space-size in "npm start"
    // A chat survives a dropped connection for this long, then ends for both.
    reconnectGraceMs: RECONNECT_GRACE_MS,
    // "N online" is broadcast this often. It is also the keepalive that makes
    // reconnecting possible at all: see recoveryWindowMs.
    onlineBroadcastMs: ONLINE_BROADCAST_MS,
    // How long Socket.IO remembers a dropped socket and the events it missed.
    // A client can only be restored if the last event it received is still
    // remembered, so this must cover the grace period PLUS the longest gap
    // between two events (one online broadcast), plus a little slack.
    recoveryWindowMs: RECONNECT_GRACE_MS + ONLINE_BROADCAST_MS + 5_000,
    // Both public keys must be exchanged this soon after a match, or the chat
    // is ended for both: nobody waits forever on a half-secured chat (US-37).
    keyExchangeTimeoutMs: 10_000,
  };
}
