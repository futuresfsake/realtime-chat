import type { Clock } from "../lib/clock.js";
import { realClock } from "../lib/clock.js";

export type LogLevel = "error" | "warn" | "info" | "debug";
const ORDER: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };

// Field names that must never reach a log line: raw addresses, message
// content, ciphertext, secrets, browser details. If one slips into a log call
// its value is replaced, so a mistake cannot leak personal data (RA 10173).
const FORBIDDEN_KEYS = new Set([
  "ip",
  "address",
  "remoteaddress",
  "xforwardedfor",
  "text",
  "message",
  "content",
  "ct",
  "ciphertext",
  "token",
  "key",
  "secret",
  "useragent",
  "iphash", // full hashes are not logged either: use ipHashPrefix
]);

export interface LogFields {
  correlationId?: string;
  data?: Record<string, unknown>;
  err?: unknown;
}

export interface Logger {
  error(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  debug(event: string, fields?: LogFields): void;
}

export interface LoggerOptions {
  level: LogLevel;
  write?: (line: string) => void;
  clock?: Clock;
}

// One JSON object per line: { ts, level, event, correlationId?, data?, err? }
export function createLogger(options: LoggerOptions): Logger {
  const write = options.write ?? ((line: string) => void process.stdout.write(`${line}\n`));
  const clock = options.clock ?? realClock;

  function log(level: LogLevel, event: string, fields: LogFields = {}): void {
    if (ORDER[level] > ORDER[options.level]) return;
    const entry: Record<string, unknown> = {
      ts: new Date(clock.now()).toISOString(),
      level,
      event,
    };
    if (fields.correlationId) entry.correlationId = fields.correlationId;
    if (fields.data) entry.data = redact(fields.data, 0);
    if (fields.err !== undefined) entry.err = describeError(fields.err);
    write(JSON.stringify(entry));
  }

  return {
    error: (event, fields) => log("error", event, fields),
    warn: (event, fields) => log("warn", event, fields),
    info: (event, fields) => log("info", event, fields),
    debug: (event, fields) => log("debug", event, fields),
  };
}

function redact(value: unknown, depth: number): unknown {
  if (value === null || typeof value !== "object") return value;
  if (depth >= 4) return "[truncated]";
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = FORBIDDEN_KEYS.has(key.toLowerCase()) ? "[redacted]" : redact(inner, depth + 1);
  }
  return out;
}

function describeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) return { name: err.name, stack: err.stack };
  return { name: "NonError" };
}

export const silentLogger: Logger = {
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};
