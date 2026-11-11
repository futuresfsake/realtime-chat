import { randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import type { Config } from "../config.js";
import type { Clock } from "../lib/clock.js";
import type { SimpleMatchmaker } from "../matchmaking/simpleMatchmaker.js";
import type { Logger } from "../observability/logger.js";
import { ipHashPrefix } from "../security/ipHash.js";
import { KeyedLimiter, TokenBucket } from "../security/tokenBucket.js";
import type { GraceTimers } from "../sessions/reconnectGrace.js";
import type { LeaveResult, SessionManager } from "../sessions/sessionManager.js";
import type {
  ChatMessage,
  ChatReaction,
  ClientToServerEvents,
  ErrorCode,
  ServerToClientEvents,
  SessionEndReason,
  SocketData,
} from "../types/events.js";
import { ChatSendSchema, EmptySchema, ReactionSchema, TypingSchema } from "../validation/schemas.js";
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
  grace: GraceTimers; // countdowns for chats whose socket dropped
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
  const { io, config, logger, clock, sessions, matchmaker, searchLimits, grace } = deps;
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
  // Show the count right away instead of waiting for the next broadcast.
  socket.emit("stats:online", { count: io.engine.clientsCount });

  const messageBucket = new TokenBucket(config.messageBurstCapacity, config.messageRefillPerSec, clock);
  // Typing signals are tiny and frequent: 10 in a burst, then 2 per second.
  const typingBucket = new TokenBucket(10, 2, clock);
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
          seq: sessions.nextSeq(socket.id)!,
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

  // A reaction to a message of this chat. Both sides are told, like a
  // message. Shares the message limit, so reactions cannot be used to flood.
  socket.on(
    "chat:react",
    withHandler(
      ReactionSchema,
      messageBucket,
      ({ ref, emoji }) => {
        const partnerId = sessions.getPartner(socketId);
        const name = sessions.getName(socketId);
        if (!partnerId || !name) throw new HandlerError("NOT_IN_SESSION");
        const reaction: ChatReaction = { ref, emoji, from: name };
        socket.emit("chat:reaction", reaction);
        io.to(partnerId).emit("chat:reaction", reaction);
      },
      hooks("chat:react"),
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
        logger.info("session_end", {
          correlationId,
          data: { reason: "disconnect", activeSessions: sessions.sessionCount() },
        });
      }
    }
    logger.info("ws_disconnect", { correlationId, data: { reason, held: grace.has(socketId) } });
  });
}
