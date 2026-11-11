import express from "express";
import type { ErrorRequestHandler } from "express";
import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import type { Config } from "./config.js";
import { IpSocketCap, checkOrigin } from "./gateway/connectionGuards.js";
import { registerHandlers } from "./gateway/registerHandlers.js";
import { healthRoute } from "./http/health.js";
import { CSP_REPORT_PATH, securityHeaders } from "./http/securityHeaders.js";
import type { Clock } from "./lib/clock.js";
import { realClock } from "./lib/clock.js";
import type { Logger } from "./observability/logger.js";
import { clientIp } from "./security/clientIp.js";
import { ConnectTokens } from "./security/connectToken.js";
import { createIpHasher, ipHashPrefix } from "./security/ipHash.js";
import { KeyedLimiter } from "./security/tokenBucket.js";
import { SimpleMatchmaker } from "./matchmaking/simpleMatchmaker.js";
import { SessionManager } from "./sessions/sessionManager.js";
import { PROTOCOL_VERSION, RULES_VERSION } from "./types/events.js";
import type {
  ClientToServerEvents,
  HandshakeErrorCode,
  ServerToClientEvents,
  SocketData,
} from "./types/events.js";
import { ConsentSchema, HandshakeAuthSchema } from "./validation/schemas.js";

export interface ServerDeps {
  config: Config;
  logger: Logger;
  clock?: Clock;
}

// Builds the app WITHOUT listening, so tests can start it on a random port.
export function buildServer(deps: ServerDeps) {
  const { config, logger } = deps;
  const clock = deps.clock ?? realClock;

  const ipHasher = createIpHasher({ clock, secret: config.ipHashSecret });
  const connectTokens = new ConnectTokens(clock, config.connectTokenTtlMs);
  const ipSocketCap = new IpSocketCap(config.maxSocketsPerIp);
  // New WebSocket handshakes: 5 per IP per 10 s.
  const handshakeLimiter = new KeyedLimiter(config.handshakeBurstCapacity, config.handshakeRefillPerSec, clock);
  // Token requests are cheap but not free: 10 in a burst, then 1 per second.
  const tokenLimiter = new KeyedLimiter(10, 1, clock);
  // Browsers can send many CSP reports for one broken page.
  const cspReportLimiter = new KeyedLimiter(5, 0.1, clock);

  let shuttingDown = false;

  // The raw address never leaves this function: only its keyed hash does.
  const ipHashOf = (req: IncomingMessage): string =>
    ipHasher.hash(clientIp(req.headers["x-forwarded-for"], req.socket.remoteAddress, config.trustProxyHops));

  // ---------- HTTP ----------
  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeaders(config));

  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    maxHttpBufferSize: config.maxPayloadBytes,
    // WebSocket only. Browsers always send an Origin header on a WebSocket
    // handshake, but not on the same-origin GET that long-polling starts
    // with, so polling could not be origin-checked reliably. See ADR-0011.
    transports: ["websocket"],
    allowRequest: (req, decide) => {
      if (shuttingDown) return decide("shutting down", false);
      const ipHash = ipHashOf(req);
      if (!checkOrigin(req.headers.origin, config.allowedOrigins)) {
        logger.warn("ws_refused", { data: { reason: "origin", ipHashPrefix: ipHashPrefix(ipHash) } });
        return decide("origin not allowed", false);
      }
      if (!handshakeLimiter.consume(ipHash)) {
        logger.warn("ws_refused", { data: { reason: "handshake_rate", ipHashPrefix: ipHashPrefix(ipHash) } });
        return decide("too many connection attempts", false);
      }
      if (io.engine.clientsCount >= config.maxConnections) {
        logger.warn("ws_refused", { data: { reason: "server_full" } });
        return decide("server full", false);
      }
      decide(null, true);
    },
  });

  app.get(
    "/health",
    healthRoute({
      isShuttingDown: () => shuttingDown,
      connectionCount: () => io.engine.clientsCount,
      rssBytes: () => process.memoryUsage().rss,
      maxConnections: config.maxConnections,
      memoryCeilingMb: config.memoryCeilingMb,
      healthKey: config.healthKey,
      alwaysShowDetails: config.nodeEnv !== "production",
    }),
  );

  // Step 1 of connecting: the page fetches a short-lived token over HTTPS.
  app.get("/connect-token", (req, res) => {
    res.set("Cache-Control", "no-store");
    // Browsers label where a request came from. Another website calling this
    // endpoint is refused. (Non-browser clients can omit the header; the
    // token is still bound to their IP hash and rate limited.)
    const site = req.get("sec-fetch-site");
    if (site !== undefined && site !== "same-origin") {
      res.status(403).json({ error: { code: "FORBIDDEN" } });
      return;
    }
    if (shuttingDown || config.maintenanceMode) {
      res.status(503).set("Retry-After", "30").json({ error: { code: "MAINTENANCE" } });
      return;
    }
    const ipHash = ipHashOf(req);
    if (!tokenLimiter.consume(ipHash)) {
      const retryAfterMs = tokenLimiter.retryAfterMs(ipHash);
      logger.warn("rate_limited", { data: { bucket: "connect_token", ipHashPrefix: ipHashPrefix(ipHash) } });
      res
        .status(429)
        .set("Retry-After", String(Math.max(1, Math.ceil(retryAfterMs / 1000))))
        .json({ error: { code: "RATE_LIMITED", retryAfterMs } });
      return;
    }
    res.json({
      token: connectTokens.issue(ipHash),
      expiresInMs: config.connectTokenTtlMs,
      protocolVersion: PROTOCOL_VERSION,
      rulesVersion: RULES_VERSION,
      preview: config.previewBanner,
    });
  });

  // Browsers POST here when the Content-Security-Policy blocks something.
  // Only the directive and the blocked origin are logged: the full report
  // contains page URLs and browser details we do not want to keep.
  app.post(
    CSP_REPORT_PATH,
    express.json({
      type: ["application/csp-report", "application/reports+json", "application/json"],
      limit: "4kb",
    }),
    (req, res) => {
      if (cspReportLimiter.consume(ipHashOf(req))) {
        logger.warn("csp_violation", { data: summarizeCspReport(req.body) });
      }
      res.status(204).end();
    },
  );

  app.use(
    express.static(path.join(process.cwd(), "public"), {
      // Files are tiny; always revalidate so a deploy reaches users at once.
      setHeaders: (res) => res.setHeader("Cache-Control", "no-cache"),
    }),
  );

  app.use((_req, res) => {
    res.status(404).type("text/plain").send("Not found");
  });

  // Last resort for HTTP errors (bad JSON, oversized body, bugs). The client
  // gets a code only: never a stack trace.
  const onHttpError: ErrorRequestHandler = (err, _req, res, _next) => {
    const status = typeof err?.status === "number" && err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status === 500) logger.error("http_error", { err });
    res.status(status).json({ error: { code: status === 500 ? "INTERNAL" : "BAD_REQUEST" } });
  };
  app.use(onHttpError);

  // ---------- WebSocket handshake (step 2 of connecting) ----------
  io.use((socket, next) => {
    const refuse = (code: HandshakeErrorCode, detail?: string) => {
      logger.warn("ws_refused", {
        data: { reason: code, detail, ipHashPrefix: ipHashPrefix(ipHash) },
      });
      next(new Error(code));
    };
    const ipHash = ipHashOf(socket.request);
    const auth: Record<string, unknown> = socket.handshake.auth ?? {};

    if (config.maintenanceMode) return refuse("MAINTENANCE");
    if (auth.protocolVersion !== PROTOCOL_VERSION) return refuse("PROTOCOL_MISMATCH");

    // 18+ and rules acknowledgement is enforced here, not only in the page.
    const consent = ConsentSchema.safeParse(auth.consent);
    if (!consent.success || consent.data.rulesVersion !== RULES_VERSION) return refuse("CONSENT_REQUIRED");

    const token = connectTokens.verify(auth.token, ipHash);
    if (!token.ok) return refuse("AUTH_REQUIRED", token.reason);

    if (!HandshakeAuthSchema.safeParse(auth).success) return refuse("VALIDATION");
    if (!ipSocketCap.add(ipHash, socket.id)) return refuse("TOO_MANY_CONNECTIONS");

    socket.data.ipHash = ipHash;
    socket.data.correlationId = randomUUID().slice(0, 8);
    next();
  });

  // ---------- Events ----------
  const sessions = new SessionManager();
  const matchmaker = new SimpleMatchmaker();
  io.on("connection", (socket) => {
    registerHandlers(socket, {
      io,
      config,
      logger,
      clock,
      sessions,
      matchmaker,
      onDisconnect: (s) => ipSocketCap.remove(s.data.ipHash, s.id),
    });
  });

  // Stop taking new work, then close. /health turns 503 immediately so the
  // platform stops routing here.
  function shutdown(): Promise<void> {
    shuttingDown = true;
    return new Promise((resolve) => {
      void io.close(() => resolve());
    });
  }

  return { app, httpServer, io, shutdown };
}

function summarizeCspReport(body: unknown): Record<string, unknown> {
  const first: unknown = Array.isArray(body) ? body[0] : body;
  const record = isRecord(first) ? first : {};
  const report = isRecord(record["csp-report"]) ? record["csp-report"] : isRecord(record.body) ? record.body : {};
  const directive = report["effective-directive"] ?? report["violated-directive"] ?? report.effectiveDirective;
  const blocked = report["blocked-uri"] ?? report.blockedURL;
  return {
    directive: typeof directive === "string" ? directive.slice(0, 40) : "unknown",
    blocked: originOnly(blocked),
  };
}

function originOnly(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  try {
    return new URL(value).origin.slice(0, 80);
  } catch {
    return value.replace(/[^a-z-]/gi, "").slice(0, 20) || "unknown"; // "inline", "eval", "data"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
