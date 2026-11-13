import { randomUUID } from "node:crypto";
import { generateName } from "./nameGenerator.js";

// READY -> SEARCHING -> CHATTING -> ENDED. From ENDED a client may search again.
export type ClientState = "READY" | "SEARCHING" | "CHATTING" | "ENDED";

export interface Session {
  readonly id: string;
  readonly a: string; // socket ids: always exactly two
  readonly b: string;
}

interface ClientRecord {
  state: ClientState;
  sessionId: string | null;
  name: string | null; // only while chatting; never kept beyond the session
}

// Each side sends its public key once per session. "complete" is true when
// this key was the second one: from then on envelopes may be relayed.
export type KeyResult =
  | { ok: true; sessionId: string; partner: string; complete: boolean }
  | { ok: false; code: "NOT_IN_SESSION" | "INVALID_STATE" };

export type LeaveResult =
  | { ok: true; ended: Session | null; partner: string | null; wasSearching: boolean }
  | { ok: false; code: "INVALID_STATE" };

export interface SessionManagerOptions {
  newId?: () => string;
  rng?: () => number;
}

// All pairing state lives here and every method is synchronous, so two people
// skipping at the same moment can never interleave (no awaits = no races).
// It knows nothing about sockets: it only handles ids.
export class SessionManager {
  private readonly clients = new Map<string, ClientRecord>();
  private readonly sessions = new Map<string, Session>();
  // Which participants of each session have sent their public key. Socket
  // ids only: the keys themselves are relayed and never kept.
  private readonly keysSeen = new Map<string, Set<string>>();
  private readonly newId: () => string;
  private readonly rng: () => number;

  constructor(options: SessionManagerOptions = {}) {
    this.newId = options.newId ?? randomUUID;
    this.rng = options.rng ?? Math.random;
  }

  registerClient(socketId: string): void {
    this.clients.set(socketId, { state: "READY", sessionId: null, name: null });
  }

  getClientState(socketId: string): ClientState | undefined {
    return this.clients.get(socketId)?.state;
  }

  getName(socketId: string): string | undefined {
    return this.clients.get(socketId)?.name ?? undefined;
  }

  sessionCount(): number {
    return this.sessions.size;
  }

  startSearching(socketId: string): { ok: true } | { ok: false; code: "INVALID_STATE" } {
    const client = this.clients.get(socketId);
    if (!client || (client.state !== "READY" && client.state !== "ENDED")) return { ok: false, code: "INVALID_STATE" };
    client.state = "SEARCHING";
    return { ok: true };
  }

  // Back to "not searching" without a session (e.g. /leave while waiting).
  stopSearching(socketId: string): boolean {
    const client = this.clients.get(socketId);
    if (!client || client.state !== "SEARCHING") return false;
    client.state = "READY";
    return true;
  }

  createSession(a: string, b: string): Session {
    const ca = this.clients.get(a);
    const cb = this.clients.get(b);
    if (a === b || ca?.state !== "SEARCHING" || cb?.state !== "SEARCHING") {
      throw new Error("createSession needs two different searching clients");
    }
    const session: Session = { id: this.newId(), a, b };
    this.sessions.set(session.id, session);
    ca.state = cb.state = "CHATTING";
    ca.sessionId = cb.sessionId = session.id;
    ca.name = generateName(this.rng);
    do {
      cb.name = generateName(this.rng);
    } while (cb.name === ca.name);
    return session;
  }

  // /leave: end whatever is going on and become idle (READY). Does not search again.
  leave(socketId: string): LeaveResult {
    return this.finish(socketId, "READY");
  }

  // /next: end whatever is going on and become SEARCHING. The caller re-enqueues.
  next(socketId: string): LeaveResult {
    return this.finish(socketId, "SEARCHING");
  }

  private finish(socketId: string, target: "READY" | "SEARCHING"): LeaveResult {
    const client = this.clients.get(socketId);
    if (!client || client.state === "READY") return { ok: false, code: "INVALID_STATE" };
    const wasSearching = client.state === "SEARCHING";
    const partner = this.getPartner(socketId);
    const ended = client.sessionId ? this.endSession(client.sessionId) : null;
    client.state = target;
    return { ok: true, ended, partner: ended ? partner : null, wasSearching };
  }

  getSessionId(socketId: string): string | null {
    return this.clients.get(socketId)?.sessionId ?? null;
  }

  getPartner(socketId: string): string | null {
    const id = this.getSessionId(socketId);
    const session = id ? this.sessions.get(id) : undefined;
    if (!session) return null;
    return session.a === socketId ? session.b : session.a;
  }

  // Notes that this client sent its public key for its current session. One
  // key per side per session: a second one is refused, so keys cannot be
  // swapped in the middle of a chat.
  recordKey(socketId: string): KeyResult {
    const sessionId = this.getSessionId(socketId);
    const partner = this.getPartner(socketId);
    if (!sessionId || !partner) return { ok: false, code: "NOT_IN_SESSION" };
    const seen = this.keysSeen.get(sessionId) ?? new Set<string>();
    if (seen.has(socketId)) return { ok: false, code: "INVALID_STATE" };
    seen.add(socketId);
    this.keysSeen.set(sessionId, seen);
    return { ok: true, sessionId, partner, complete: seen.size === 2 };
  }

  // True once both sides of this client's session have sent their key. Until
  // then nothing else is relayed between them.
  isSecured(socketId: string): boolean {
    const sessionId = this.getSessionId(socketId);
    return sessionId !== null && this.keysSeen.get(sessionId)?.size === 2;
  }

  // Key exchange deadline: ends the session only if it still exists and its
  // keys are still incomplete. Returns the ended session, or null if there
  // was nothing to do (already secured, or already over).
  endIfNotSecured(sessionId: string): Session | null {
    if (!this.sessions.has(sessionId) || this.keysSeen.get(sessionId)?.size === 2) return null;
    return this.endSession(sessionId);
  }

  // O(1). The only check that decides who may act on a session.
  isMember(socketId: string, sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session !== undefined && (session.a === socketId || session.b === socketId);
  }

  // Closes the session for good: the id is forgotten, so it cannot be rejoined.
  endSession(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    this.sessions.delete(sessionId);
    this.keysSeen.delete(sessionId);
    for (const id of [session.a, session.b]) {
      const client = this.clients.get(id);
      if (client) {
        client.state = "ENDED";
        client.sessionId = null;
        client.name = null;
      }
    }
    return session;
  }

  removeClient(socketId: string): { ended: Session | null; partner: string | null } {
    const sessionId = this.getSessionId(socketId);
    const partner = this.getPartner(socketId);
    const ended = sessionId ? this.endSession(sessionId) : null;
    this.clients.delete(socketId);
    return { ended, partner };
  }
}
