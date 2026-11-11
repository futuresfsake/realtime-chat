// Shared event contracts: server and client agree on names + payloads.

// Bump on any breaking change to the events below. Old clients are refused at
// the handshake with PROTOCOL_MISMATCH and told to refresh.
export const PROTOCOL_VERSION = "rc/v1";

// Version of the rules + privacy notice shown at the gate. Changing the text
// means changing this, which makes every visitor acknowledge the new text.
export const RULES_VERSION = "2026-11-preview-2";

export type ErrorCode = "VALIDATION" | "RATE_LIMITED" | "INTERNAL" | "NOT_IN_SESSION" | "INVALID_STATE";

// Sent as the connect_error message when a handshake is refused.
export type HandshakeErrorCode =
  | "MAINTENANCE"
  | "PROTOCOL_MISMATCH"
  | "CONSENT_REQUIRED"
  | "AUTH_REQUIRED"
  | "VALIDATION"
  | "TOO_MANY_CONNECTIONS"
  // "Your old connection was still open here. It is closed now: connect again."
  | "RETRY";

// Clients only ever receive a code: never a stack trace or internal message.
export type Ack<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: { code: ErrorCode; retryAfterMs?: number } };

export type AckFn = (ack: Ack) => void;

export interface ChatMessage {
  id: string;
  seq: number; // 1, 2, 3... within one session; reactions point at it
  from: string;
  text: string;
  sentAt: number; // epoch ms, server time
}

// "timeout": your own connection was gone for too long.
// "partner_timeout": your partner's was.
export type SessionEndReason = "left" | "partner_left" | "skipped" | "timeout" | "partner_timeout";

// "typing" / "idle": the partner started or stopped typing (no content).
// There is no "left" state: session:ended already says the partner is gone.
export type PartnerState = "connected" | "reconnecting" | "typing" | "idle";

// The only reactions that are relayed. Keep in sync with public/js/sessionStore.js.
export const ALLOWED_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
export type Reaction = (typeof ALLOWED_REACTIONS)[number];

export interface ChatReaction {
  ref: number; // seq of the message reacted to
  emoji: Reaction;
  from: string; // random name of who reacted
}

export interface SessionMatched {
  sessionId: string;
  myName: string;
  partnerName: string;
}

export interface ClientToServerEvents {
  // Payloads are typed "unknown" on purpose: the server validates every one.
  "chat:send": (payload: unknown, ack?: unknown) => void;
  "session:start": (payload: unknown, ack?: unknown) => void;
  "session:next": (payload: unknown, ack?: unknown) => void;
  "session:leave": (payload: unknown, ack?: unknown) => void;
  "chat:react": (payload: unknown, ack?: unknown) => void;
  typing: (payload: unknown, ack?: unknown) => void;
}

export interface ServerToClientEvents {
  "chat:message": (msg: ChatMessage) => void;
  "chat:reaction": (reaction: ChatReaction) => void;
  "session:matched": (info: SessionMatched) => void;
  "session:ended": (info: { reason: SessionEndReason }) => void;
  "partner:status": (info: { state: PartnerState }) => void;
  // A count only: no names, no locations.
  "stats:online": (info: { count: number }) => void;
}

export interface SocketData {
  correlationId: string;
  ipHash: string;
}
