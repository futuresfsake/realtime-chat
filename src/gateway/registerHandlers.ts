import type { Server, Socket } from "socket.io";
import type { Config } from "../config.js";
import type { Clock } from "../lib/clock.js";
import type { Matchmaker } from "../matchmaking/matchmaker.js";
import { PRIORITY_CATEGORIES } from "../safety/categories.js";
import type { BanList } from "../safety/bans.js";
import type { NoRematch } from "../safety/noRematch.js";
import type { ReportTracker } from "../safety/reports.js";
import { UNKNOWN_COUNTRY } from "../matchmaking/interests.js";
import type { SearchPrefs } from "../matchmaking/interests.js";
import type { Logger } from "../observability/logger.js";
import type { Metrics } from "../observability/metrics.js";
import { ipHashPrefix } from "../security/ipHash.js";
import { KeyedLimiter, TokenBucket } from "../security/tokenBucket.js";
import type { GraceTimers } from "../sessions/reconnectGrace.js";
import type { LeaveResult, SessionManager } from "../sessions/sessionManager.js";
import type {
  ClientToServerEvents,
  ErrorCode,
  ServerToClientEvents,
  SessionEndReason,
  SocketData,
} from "../types/events.js";
import {
  E2eEnvelopeSchema,
  E2eKeySchema,
  EmptySchema,
  ReportSchema,
  SearchPrefsSchema,
  TypingSchema,
} from "../validation/schemas.js";
import { HandlerError, withHandler } from "./handler.js";
import { startSession } from "./startSession.js";

type IoServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export interface HandlerDeps {
  io: IoServer;
  config: Config;
  logger: Logger;
  clock: Clock;
  sessions: SessionManager;
  matchmaker: Matchmaker;
  noRematch: NoRematch; // people who just parted are not paired again for a while
  bans: BanList; // connections blocked from matching after reports
  reports: ReportTracker; // how many different people reported each connection
  reportLimits: KeyedLimiter; // reports per address
  searchLimits: KeyedLimiter; // /start + /next, keyed by IP hash
  grace: GraceTimers; // countdowns for chats whose socket dropped
  keyDeadlines: GraceTimers; // countdowns for chats still exchanging keys, by session id
  metrics: Metrics; // counters and timings, logged as a snapshot every minute
  isShuttingDown: () => boolean;
  onDisconnect: (socket: ChatSocket) => void; // e.g. release the per-IP socket slot
}

// Disconnect reasons that look like a network problem. After these, Socket.IO
// lets the same socket come back (same id, missed events replayed), so the
// chat is held for a while. Any other reason is a deliberate goodbye. Socket.IO
// also restores sockets after a server shutdown; those are left out on
// purpose, because sessions live in memory and do not survive a restart.
const RECOVERABLE_REASONS: ReadonlySet<string> = new Set([
  "transport error",
  "transport close",
  "forced close",
  "ping timeout",
]);

// Wires every per-connection event. Session rules live in SessionManager; this
// file only translates between sockets and those rules.
export function registerHandlers(socket: ChatSocket, deps: HandlerDeps): void {
  const { io, config, logger, clock, sessions, matchmaker, noRematch, bans, reports, reportLimits, searchLimits, grace, keyDeadlines, metrics } =
    deps;
  const { correlationId, ipHash } = socket.data;
  const socketId = socket.id;

  // A socket that dropped while chatting and came back in time keeps its chat
  // (US-11). Everyone else starts fresh: a brand-new socket, or one that came
  // back too late or was not chatting when it dropped.
  const resumed = grace.cancel(socketId) && socket.recovered && sessions.getClientState(socketId) !== undefined;
  if (resumed) {
    const partnerId = sessions.getPartner(socketId);
    if (partnerId) io.to(partnerId).emit("partner:status", { state: "connected" });
  } else {
    sessions.registerClient(socketId);
  }
  logger.info("ws_connect", {
    correlationId,
    data: { ipHashPrefix: ipHashPrefix(ipHash), connectionCount: io.engine.clientsCount, resumed },
  });
  metrics.count("ws_connected");
  // Show the count right away instead of waiting for the next broadcast.
  socket.emit("stats:online", { count: io.engine.clientsCount });

  const messageBucket = new TokenBucket(config.messageBurstCapacity, config.messageRefillPerSec, clock);
  // Typing signals are tiny and frequent: 10 in a burst, then 2 per second.
  const typingBucket = new TokenBucket(10, 2, clock);
  // One public key per chat is all a client ever needs, and chats are limited
  // to 10 a minute: the same pace here keeps a flood of keys out of the logs.
  const keyBucket = new TokenBucket(10, 10 / 60, clock);
  // /start and /next share one limit per network address (hashed), across all its sockets.
  const searchLimiter = {
    consume: () => searchLimits.consume(ipHash),
    retryAfterMs: () => searchLimits.retryAfterMs(ipHash),
  };

  const hooks = (event: string) => ({
    onEvent: () => metrics.count("events_total"),
    onRejected: (code: ErrorCode, err?: unknown) => {
      metrics.count("events_rejected");
      metrics.count(`rejected.${code}`);
      if (code === "INTERNAL") logger.error("event_failed", { correlationId, err, data: { event } });
      else logger.warn("event_rejected", { correlationId, data: { event, code } });
    },
  });

  // Puts a searching client in the queue and, if a suitable person was
  // waiting, starts the session. Synchronous from enqueue to emit: no other
  // event can interleave.
  function search(prefs: SearchPrefs): void {
    const match = matchmaker.enqueue(socketId, socket.data.country, prefs, socket.data.ipHash);
    if (match) startSession(deps, match, correlationId);
  }

  // A blocked connection cannot start or skip into a new search.
  function checkNotBanned(): void {
    if (bans.isBanned(socket.data.ipHash)) throw new HandlerError("BANNED");
  }

  // Three different people reported this connection: it cannot be matched for
  // a while. Anyone on it who is still searching is told, and taken out of the queue.
  function blockConnection(targetHash: string): void {
    bans.ban(targetHash);
    reports.clear(targetHash);
    metrics.count("blocks");
    logger.warn("connection_blocked", { data: { ipHashPrefix: ipHashPrefix(targetHash) } });
    for (const [id, other] of io.sockets.sockets) {
      if (other.data.ipHash !== targetHash) continue;
      matchmaker.remove(id);
      if (sessions.getClientState(id) === "SEARCHING" && sessions.stopSearching(id)) {
        io.to(id).emit("session:ended", { reason: "blocked" });
      }
    }
  }

  // "My country only" needs a country we could detect (an unknown one can
  // never match locally). Refused before anything changes.
  function checkPrefs(prefs: SearchPrefs): void {
    if (prefs.scope === "local" && socket.data.country === UNKNOWN_COUNTRY) throw new HandlerError("COUNTRY_UNKNOWN");
  }

  function announceEnd(result: Extract<LeaveResult, { ok: true }>, mine: SessionEndReason): void {
    if (result.ended || result.wasSearching) socket.emit("session:ended", { reason: mine });
    if (result.ended && result.partner) {
      io.to(result.partner).emit("session:ended", { reason: "partner_left" });
      // Whoever ended it, these two do not meet again for a while. A dropped
      // connection or a timeout is not a choice, so it never blocks anyone.
      const partnerHash = io.sockets.sockets.get(result.partner)?.data.ipHash;
      if (partnerHash !== undefined) {
        noRematch.add({ ipHash: socket.data.ipHash, id: socketId }, { ipHash: partnerHash, id: result.partner });
      }
    }
    if (result.ended) {
      metrics.sessionEnded(result.ended.id, mine);
      logger.info("session_end", { correlationId, data: { reason: mine, activeSessions: sessions.sessionCount() } });
    }
  }

  socket.on(
    "session:start",
    withHandler(
      SearchPrefsSchema,
      searchLimiter,
      (prefs) => {
        checkNotBanned();
        checkPrefs(prefs);
        if (!sessions.startSearching(socket.id).ok) throw new HandlerError("INVALID_STATE");
        search(prefs);
      },
      hooks("session:start"),
    ),
  );

  // /next: end this chat (or search) and look for someone new. Shares the
  // /start limit, so skipping through people to find a particular one is slow.
  socket.on(
    "session:next",
    withHandler(
      SearchPrefsSchema,
      searchLimiter,
      (prefs) => {
        checkNotBanned();
        checkPrefs(prefs);
        const result = sessions.next(socket.id);
        if (!result.ok) throw new HandlerError(result.code);
        matchmaker.remove(socket.id);
        announceEnd(result, "skipped");
        search(prefs);
      },
      hooks("session:next"),
    ),
  );

  // /leave: end the chat and go idle. Not rate limited: it only ever shrinks state.
  socket.on(
    "session:leave",
    withHandler(
      EmptySchema,
      null,
      () => {
        const result = sessions.leave(socket.id);
        if (!result.ok) throw new HandlerError(result.code);
        matchmaker.remove(socket.id);
        announceEnd(result, "left");
      },
      hooks("session:leave"),
    ),
  );

  // /report: end the chat, never meet this person again (for a while), and
  // count the report. Only the category is sent: the server has no messages to
  // attach, and nobody reads chats. The partner is simply told the chat ended,
  // not that they were reported.
  socket.on(
    "session:report",
    withHandler(
      ReportSchema,
      { consume: () => reportLimits.consume(socket.data.ipHash), retryAfterMs: () => reportLimits.retryAfterMs(socket.data.ipHash) },
      ({ reason }) => {
        // Only a chat can be reported. Checked first, so a stray report from
        // someone who is only searching does not cancel their search.
        if (!sessions.getPartner(socketId)) throw new HandlerError("NOT_IN_SESSION");
        const result = sessions.leave(socketId);
        if (!result.ok || !result.ended || !result.partner) throw new HandlerError("NOT_IN_SESSION");
        matchmaker.remove(socketId);
        announceEnd(result, "reported"); // also keeps the pair apart (no rematch)

        const targetHash = io.sockets.sockets.get(result.partner)?.data.ipHash;
        // A category and a hash prefix only: never a full hash, an address or any text.
        logger.info("report", {
          correlationId,
          data: { reason, ...(targetHash ? { targetIpHashPrefix: ipHashPrefix(targetHash) } : {}) },
        });
        metrics.count(`reports.${reason}`);
        if (PRIORITY_CATEGORIES.has(reason)) {
          metrics.count("reports_priority");
          logger.warn("report_priority", { correlationId, data: { reason } });
        }
        if (targetHash !== undefined && reports.record(targetHash, socket.data.ipHash).reachedThreshold) {
          blockConnection(targetHash);
        }
      },
      hooks("session:report"),
    ),
  );

  // Step 1 of a chat: each side sends one public key, relayed to the partner.
  // Public keys are not secret; what matters is that the server relays them
  // unchanged, which the two people can check with /verify.
  socket.on(
    "e2e:key",
    withHandler(
      E2eKeySchema,
      keyBucket,
      ({ publicKey }) => {
        const result = sessions.recordKey(socketId);
        if (!result.ok) throw new HandlerError(result.code);
        io.to(result.partner).emit("e2e:key", { publicKey });
        metrics.count("keys_relayed");
        if (result.complete) {
          keyDeadlines.cancel(result.sessionId);
          logger.info("session_secured", { correlationId, data: { activeSessions: sessions.sessionCount() } });
        }
      },
      hooks("e2e:key"),
    ),
  );

  // Everything people say: messages and reactions alike, as ciphertext the
  // server cannot read. It goes to the partner and nowhere else: not back to
  // the sender, not into a log, not into any list. Refused until both keys
  // have crossed, so nothing can be said on a chat that is not encrypted.
  socket.on(
    "e2e:envelope",
    withHandler(
      E2eEnvelopeSchema,
      messageBucket,
      ({ seq, ct }) => {
        const partnerId = sessions.getPartner(socketId);
        if (!partnerId) throw new HandlerError("NOT_IN_SESSION");
        if (!sessions.isSecured(socketId)) throw new HandlerError("INVALID_STATE");
        // Timed: the relay latency service level (US-40). Counts only; nothing about the content.
        const started = performance.now();
        io.to(partnerId).emit("e2e:envelope", { seq, ct });
        metrics.observe("relay_ms", performance.now() - started);
        metrics.count("envelopes_relayed");
      },
      hooks("e2e:envelope"),
    ),
  );

  // "Typing" is a hint, not data: outside a chat it is silently ignored, and
  // it is sent volatile so a stale "typing…" is never replayed after a drop.
  socket.on(
    "typing",
    withHandler(
      TypingSchema,
      typingBucket,
      ({ isTyping }) => {
        const partnerId = sessions.getPartner(socketId);
        if (!partnerId) return;
        io.to(partnerId).volatile.emit("partner:status", { state: isTyping ? "typing" : "idle" });
      },
      hooks("typing"),
    ),
  );

  // The countdown ran out: the dropped socket never came back.
  function expire(): void {
    const partnerId = sessions.getPartner(socketId);
    const { ended } = sessions.removeClient(socketId);
    if (!ended) return; // the partner already ended the chat meanwhile
    if (partnerId) io.to(partnerId).emit("session:ended", { reason: "partner_timeout" });
    // Nobody is listening on this id right now. Socket.IO remembers the event
    // a little longer than the grace period, so a client that returns just
    // too late is still told its chat is over.
    io.to(socketId).emit("session:ended", { reason: "timeout" });
    metrics.sessionEnded(ended.id, "timeout");
    logger.info("session_end", { correlationId, data: { reason: "timeout", activeSessions: sessions.sessionCount() } });
  }

  socket.on("disconnect", (reason) => {
    matchmaker.remove(socketId);
    deps.onDisconnect(socket);
    const partnerId = sessions.getPartner(socketId);

    if (partnerId && RECOVERABLE_REASONS.has(reason) && !deps.isShuttingDown()) {
      // Probably a network blip: keep the chat and give them time to return.
      io.to(partnerId).emit("partner:status", { state: "reconnecting" });
      grace.hold(socketId, config.reconnectGraceMs, expire);
    } else {
      const { ended } = sessions.removeClient(socketId);
      if (ended && partnerId) {
        io.to(partnerId).emit("session:ended", { reason: "partner_left" });
        metrics.sessionEnded(ended.id, "disconnect");
        logger.info("session_end", {
          correlationId,
          data: { reason: "disconnect", activeSessions: sessions.sessionCount() },
        });
      }
    }
    logger.info("ws_disconnect", { correlationId, data: { reason, held: grace.has(socketId) } });
  });
}
