import type { Server } from "socket.io";
import type { Config } from "../config.js";
import type { Match } from "../matchmaking/matchmaker.js";
import type { Logger } from "../observability/logger.js";
import type { Metrics } from "../observability/metrics.js";
import type { GraceTimers } from "../sessions/reconnectGrace.js";
import type { SessionManager } from "../sessions/sessionManager.js";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "../types/events.js";

type IoServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export interface StartSessionDeps {
  io: IoServer;
  config: Config;
  logger: Logger;
  sessions: SessionManager;
  keyDeadlines: GraceTimers; // countdowns for chats still exchanging keys, by session id
  metrics: Metrics;
}

// Turns a match into a chat: creates the session, tells both people, and
// starts the key exchange deadline. Used when someone's search pairs at once
// and when a waiting person's wait runs out. Synchronous from creation to
// emit, so nothing can interleave.
export function startSession(deps: StartSessionDeps, match: Match, correlationId?: string): void {
  const { io, config, logger, sessions, keyDeadlines, metrics } = deps;
  const session = sessions.createSession(match.a, match.b);
  metrics.sessionStarted(session.id);
  metrics.count(match.shared.length > 0 ? "matches.interest" : "matches.random");
  metrics.observe("match_wait_ms", match.waitedMs);
  const nameA = sessions.getName(session.a)!;
  const nameB = sessions.getName(session.b)!;
  // The roles only fix the order of the two keys in the key derivation.
  io.to(session.a).emit("session:matched", {
    sessionId: session.id,
    myName: nameA,
    partnerName: nameB,
    role: "initiator",
    sharedInterests: match.shared,
  });
  io.to(session.b).emit("session:matched", {
    sessionId: session.id,
    myName: nameB,
    partnerName: nameA,
    role: "responder",
    sharedInterests: match.shared,
  });
  logger.info("session_start", {
    correlationId,
    // Only how many interests were shared, never which.
    data: { activeSessions: sessions.sessionCount(), sharedInterests: match.shared.length },
  });

  // The chat is not usable until both public keys have crossed. If that does
  // not happen in time (a browser that cannot do it, a dropped link), end it
  // for both instead of leaving them waiting (US-37).
  keyDeadlines.hold(session.id, config.keyExchangeTimeoutMs, () => {
    const ended = sessions.endIfNotSecured(session.id);
    if (!ended) return; // secured in time, or already over
    metrics.sessionEnded(ended.id, "crypto_timeout");
    io.to(ended.a).emit("session:ended", { reason: "crypto_timeout" });
    io.to(ended.b).emit("session:ended", { reason: "crypto_timeout" });
    logger.warn("session_end", {
      correlationId,
      data: { reason: "crypto_timeout", activeSessions: sessions.sessionCount() },
    });
  });
}
