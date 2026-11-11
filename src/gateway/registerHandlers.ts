import { randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import type { Config } from "../config.js";
import type { Clock } from "../lib/clock.js";
import type { SimpleMatchmaker } from "../matchmaking/simpleMatchmaker.js";
import type { Logger } from "../observability/logger.js";
import { ipHashPrefix } from "../security/ipHash.js";
import { TokenBucket } from "../security/tokenBucket.js";
import type { SessionManager } from "../sessions/sessionManager.js";
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
  onDisconnect: (socket: ChatSocket) => void; // e.g. release the per-IP socket slot
}

// Wires every per-connection event. Session rules live in SessionManager; this
// file only translates between sockets and those rules.
export function registerHandlers(socket: ChatSocket, deps: HandlerDeps): void {
  const { io, config, logger, clock, sessions, matchmaker } = deps;
  const { correlationId, ipHash } = socket.data;

  sessions.registerClient(socket.id);
  logger.info("ws_connect", {
    correlationId,
    data: { ipHashPrefix: ipHashPrefix(ipHash), connectionCount: io.engine.clientsCount },
  });

  const messageBucket = new TokenBucket(config.messageBurstCapacity, config.messageRefillPerSec, clock);
  // /start and /leave are rate limited too: no flooding the matchmaker.
  const commandBucket = new TokenBucket(config.messageBurstCapacity, config.messageRefillPerSec, clock);

  const hooks = (event: string) => ({
    onRejected: (code: ErrorCode, err?: unknown) => {
      if (code === "INTERNAL") logger.error("event_failed", { correlationId, err, data: { event } });
      else logger.warn("event_rejected", { correlationId, data: { event, code } });
    },
  });

  // Closes the session (if any) and tells both sides why.
  function closeSession(sessionId: string, mine: SessionEndReason, theirs: SessionEndReason): void {
    const partnerId = sessions.getPartner(socket.id);
    if (!sessions.endSession(sessionId)) return;
    socket.emit("session:ended", { reason: mine });
    if (partnerId) io.to(partnerId).emit("session:ended", { reason: theirs });
    logger.info("session_end", { correlationId, data: { reason: mine, activeSessions: sessions.sessionCount() } });
  }

  socket.on(
    "session:start",
    withHandler(
      EmptySchema,
      commandBucket,
      () => {
        if (!sessions.startSearching(socket.id).ok) throw new HandlerError("INVALID_STATE");
        const pair = matchmaker.enqueue(socket.id);
        if (!pair) return;
        // Synchronous from here to the emits: no other event can interleave.
        const session = sessions.createSession(pair[0], pair[1]);
        const nameA = sessions.getName(session.a)!;
        const nameB = sessions.getName(session.b)!;
        io.to(session.a).emit("session:matched", { sessionId: session.id, myName: nameA, partnerName: nameB });
        io.to(session.b).emit("session:matched", { sessionId: session.id, myName: nameB, partnerName: nameA });
        logger.info("session_start", { correlationId, data: { activeSessions: sessions.sessionCount() } });
      },
      hooks("session:start"),
    ),
  );

  socket.on(
    "session:leave",
    withHandler(
      EmptySchema,
      commandBucket,
      () => {
        const state = sessions.getClientState(socket.id);
        if (state === "SEARCHING") {
          matchmaker.remove(socket.id);
          sessions.stopSearching(socket.id);
          socket.emit("session:ended", { reason: "left" });
          return;
        }
        const sessionId = sessions.getSessionId(socket.id);
        if (!sessionId) throw new HandlerError("INVALID_STATE");
        closeSession(sessionId, "left", "partner_left");
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
