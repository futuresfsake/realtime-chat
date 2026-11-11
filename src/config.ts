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
});

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
  // Fixed limits (not configurable from the environment)
  maxMessageLength: number;
  maxPayloadBytes: number;
  messageBurstCapacity: number;
  messageRefillPerSec: number;
  handshakeBurstCapacity: number;
  handshakeRefillPerSec: number;
  connectTokenTtlMs: number;
  maxConnections: number;
  memoryCeilingMb: number;
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
    maxMessageLength: 500,
    maxPayloadBytes: 4096,
    messageBurstCapacity: 5,
    messageRefillPerSec: 0.5,
    handshakeBurstCapacity: 5, // 5 new connections per IP ...
    handshakeRefillPerSec: 0.5, // ... per 10 seconds
    connectTokenTtlMs: 30_000,
    maxConnections: 500,
    memoryCeilingMb: 400, // matches --max-old-space-size in "npm start"
  };
}
