// Shared event contracts: server and client agree on names + payloads.

// Bump on any breaking change to the events below. Old clients are refused at
// the handshake with PROTOCOL_MISMATCH and told to refresh.
export const PROTOCOL_VERSION = "rc/v1";

// Version of the rules + privacy notice shown at the gate. Changing the text
// means changing this, which makes every visitor acknowledge the new text.
export const RULES_VERSION = "2026-11-preview";

export type ErrorCode = "VALIDATION" | "RATE_LIMITED" | "INTERNAL";

// Sent as the connect_error message when a handshake is refused.
export type HandshakeErrorCode =
  | "MAINTENANCE"
  | "PROTOCOL_MISMATCH"
  | "CONSENT_REQUIRED"
  | "AUTH_REQUIRED"
  | "VALIDATION"
  | "TOO_MANY_CONNECTIONS";

// Clients only ever receive a code: never a stack trace or internal message.
export type Ack<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: { code: ErrorCode; retryAfterMs?: number } };

export type AckFn = (ack: Ack) => void;

export interface ChatMessage {
  id: string;
  from: string;
  text: string;
  sentAt: number; // epoch ms, server time
}

export interface ClientToServerEvents {
  // Payloads are typed "unknown" on purpose: the server validates every one.
  "chat:send": (payload: unknown, ack?: unknown) => void;
}

export interface ServerToClientEvents {
  "chat:message": (msg: ChatMessage) => void;
}

export interface SocketData {
  correlationId: string;
  ipHash: string;
}
