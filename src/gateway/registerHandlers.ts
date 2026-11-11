import { randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import type { Config } from "../config.js";
import type { Clock } from "../lib/clock.js";
import type { SimpleMatchmaker } from "../matchmaking/simpleMatchmaker.js";
import type { Logger } from "../observability/logger.js";
import { ipHashPrefix } from "../security/ipHash.js";
import { KeyedLimiter, TokenBucket } from "../security/tokenBucket.js";
import type { LeaveResult, SessionManager } from "../sessions/sessionManager.js";
import type {
  ChatMessage,
  ClientToServerEvents,
  ErrorCode,
  ServerToClientEvents,
  SessionEndReason,
  SocketData,
} from "../types/events.js";
import { ChatSendSchema, EmptySchema } from "../validation/schemas.js";
import { HandlerError, withHandler } from "./handler.js";

type IoServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export interface HandlerDeps {
  io: IoServer;
  config: Config;
  logger: Logger;
  clock: Clock;
  sessions: SessionManager;
  matchmaker: SimpleMatchmaker;
  searchLimits: KeyedLimiter; // /start + /next, keyed by IP hash
  onDisconnect: (socket: ChatSocket) => void; // e.g. release the per-IP socket slot
}

// Wires every per-connection event. Session rules live in SessionManager; this
// file only translates between sockets and those rules.
export function registerHandlers(socket: ChatSocket, deps: HandlerDeps): void {
  const { io, config, logger, clock, sessions, matchmaker, searchLimits } = deps;
  const { correlationId, ipHash } = socket.data;

  sessions.registerClient(socket.id);
  logger.info("ws_connect", {
    correlationId,
    data: { ipHashPrefix: ipHashPrefix(ipHash), connectionCount: io.engine.clientsCount },
  });

  const messageBucket = new TokenBucket(config.messageBurstCapacity, config.messageRefillPerSec, clock);
  // /start and /next share one limit per network address (hashed), across all its sockets.
  const searchLimiter = {
    consume: () => searchLimits.consume(ipHash),
    retryAfterMs: () => searchLimits.retryAfterMs(ipHash),
  };

  const hooks = (event: string) => ({
    onRejected: (code: ErrorCode, err?: unknown) => {
      if (code === "INTERNAL") logger.error("event_failed", { correlationId, err, data: { event } });
      else logger.warn("event_rejected", { correlationId, data: { event, code } });
    },
  });

  // Puts a searching client in the queue and, if someone was waiting, starts
  // the session. Synchronous from enqueue to emit: no other event can interleave.
  function search(): void {
    const pair = matchmaker.enqueue(socket.id);
    if (!pair) return;
    const session = sessions.createSession(pair[0], pair[1]);
    const nameA = sessions.getName(session.a)!;
    const nameB = sessions.getName(session.b)!;
    io.to(session.a).emit("session:matched", { sessionId: session.id, myName: nameA, partnerName: nameB });
    io.to(session.b).emit("session:matched", { sessionId: session.id, myName: nameB, partnerName: nameA });
    logger.info("session_start", { correlationId, data: { activeSessions: sessions.sessionCount() } });
  }

  function announceEnd(result: Extract<LeaveResult, { ok: true }>, mine: SessionEndReason): void {
    if (result.ended || result.wasSearching) socket.emit("session:ended", { reason: mine });
    if (result.ended && result.partner) io.to(result.partner).emit("session:ended", { reason: "partner_left" });
    if (result.ended) {
      logger.info("session_end", { correlationId, data: { reason: mine, activeSessions: sessions.sessionCount() } });
    }
  }

  socket.on(
    "session:start",
    withHandler(
      EmptySchema,
      searchLimiter,
      () => {
        if (!sessions.startSearching(socket.id).ok) throw new HandlerError("INVALID_STATE");
        search();
      },
      hooks("session:start"),
    ),
  );

  // /next: end this chat (or search) and look for someone new. Shares the
  // /start limit, so skipping through people to find a particular one is slow.
  socket.on(
    "session:next",
    withHandler(
      EmptySchema,
      searchLimiter,
      () => {
        const result = sessions.next(socket.id);
        if (!result.ok) throw new HandlerError(result.code);
        matchmaker.remove(socket.id);
        announceEnd(result, "skipped");
        search();
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

  socket.on(
    "chat:send",
    withHandler(
      ChatSendSchema,
      messageBucket,
      ({ text, sessionId }) => {
        const mySessionId = sessions.getSessionId(socket.id);
        const partnerId = sessions.getPartner(socket.id);
        // A forged or stale session id is refused even if the sender is chatting elsewhere.
        if (!mySessionId || !partnerId) throw new HandlerError("NOT_IN_SESSION");
        if (sessionId !== undefined && (sessionId !== mySessionId || !sessions.isMember(socket.id, sessionId))) {
          throw new HandlerError("NOT_IN_SESSION");
        }
        const msg: ChatMessage = {
          id: randomUUID(),
          from: sessions.getName(socket.id)!,
          text,
          sentAt: clock.now(), // server time, not client time
        };
        socket.emit("chat:message", msg); // echo, so the sender sees what the partner sees
        io.to(partnerId).emit("chat:message", msg);
      },
      hooks("chat:send"),
    ),
  );

  socket.on("disconnect", (reason) => {
    matchmaker.remove(socket.id);
    const { ended, partner } = sessions.removeClient(socket.id);
    if (ended && partner) {
      io.to(partner).emit("session:ended", { reason: "partner_left" });
      logger.info("session_end", { correlationId, data: { reason: "disconnect", activeSessions: sessions.sessionCount() } });
    }
    deps.onDisconnect(socket);
    logger.info("ws_disconnect", { correlationId, data: { reason } });
  });
}
