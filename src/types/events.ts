// Shared event contracts: server and client agree on names + payloads.

// Bump on any breaking change to the events below. Old clients are refused at
// the handshake with PROTOCOL_MISMATCH and told to refresh.
// rc/v1 is the end-to-end encrypted protocol. The unencrypted events that
// existed before it (chat:send, chat:react) were never deployed, so no
// released client speaks them and the number did not need to change.
export const PROTOCOL_VERSION = "rc/v1";

// Version of the rules + privacy notice shown at the gate. Changing the text
// means changing this, which makes every visitor acknowledge the new text.
export const RULES_VERSION = "2026-11-preview-3";

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

// A partner's public key for this chat (ECDH P-256, 65 bytes as base64url).
// Public by design: relayed once per side and never kept.
export interface E2eKey {
  publicKey: string;
}

// The only thing a chat message or reaction ever looks like on the server:
// a number and ciphertext. What is inside is readable by the two browsers
// only (see public/js/crypto.js and docs/04-security/e2ee.md).
export interface E2eEnvelope {
  seq: number; // the sender's own count: 1, 2, 3... per direction
  ct: string; // AES-GCM ciphertext, base64url
}

// "timeout": your own connection was gone for too long.
// "partner_timeout": your partner's was.
// "crypto_timeout": the two public keys were not exchanged in time, so the
// chat was ended before anything could be said (US-37).
export type SessionEndReason =
  | "left"
  | "partner_left"
  | "skipped"
  | "timeout"
  | "partner_timeout"
  | "crypto_timeout";

// "typing" / "idle": the partner started or stopped typing (no content).
// There is no "left" state: session:ended already says the partner is gone.
export type PartnerState = "connected" | "reconnecting" | "typing" | "idle";

// The reactions the clients accept. Reactions travel inside encrypted
// envelopes, so the server never sees or checks them: this list is here for
// the tests that keep the browser's copy (public/js/sessionStore.js) in sync.
export const ALLOWED_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
export type Reaction = (typeof ALLOWED_REACTIONS)[number];

// Fixes who is who in the key derivation, so both sides compute the same keys.
export type E2eRole = "initiator" | "responder";

export interface SessionMatched {
  sessionId: string;
  myName: string;
  partnerName: string;
  role: E2eRole;
}

export interface ClientToServerEvents {
  // Payloads are typed "unknown" on purpose: the server validates every one.
  "session:start": (payload: unknown, ack?: unknown) => void;
  "session:next": (payload: unknown, ack?: unknown) => void;
  "session:leave": (payload: unknown, ack?: unknown) => void;
  "e2e:key": (payload: unknown, ack?: unknown) => void;
  // The only way to say anything. There is no unencrypted message event.
  "e2e:envelope": (payload: unknown, ack?: unknown) => void;
  typing: (payload: unknown, ack?: unknown) => void;
}

export interface ServerToClientEvents {
  // Both relayed unchanged from the partner, and only to the partner.
  "e2e:key": (key: E2eKey) => void;
  "e2e:envelope": (envelope: E2eEnvelope) => void;
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
