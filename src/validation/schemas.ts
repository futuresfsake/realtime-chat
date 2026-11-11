import { z } from "zod";
import { ALLOWED_REACTIONS } from "../types/events.js";

// Every client -> server payload has a strict schema: wrong types, missing
// fields and unknown fields are all rejected.

export const ChatSendSchema = z.strictObject({
  text: z.string().trim().min(1).max(500),
  // Optional: the server already knows your session. If you send one it must
  // be yours, otherwise the message is refused (forged-id protection).
  sessionId: z.uuid().optional(),
});

// A reaction to one message of the current session. The server checks the
// emoji but not that `ref` exists: it keeps no list of messages.
export const ReactionSchema = z.strictObject({
  ref: z.number().int().positive().max(1_000_000),
  emoji: z.enum(ALLOWED_REACTIONS),
});

// "I started / stopped typing". Carries no text.
export const TypingSchema = z.strictObject({
  isTyping: z.boolean(),
});

// Session commands carry no data.
export const EmptySchema = z.strictObject({});

export const ConsentSchema = z.strictObject({
  adult: z.literal(true),
  rulesVersion: z.string().min(1).max(32),
});

// Sent in the Socket.IO "auth" option when connecting.
export const HandshakeAuthSchema = z.strictObject({
  protocolVersion: z.string().min(1).max(16),
  token: z.string().min(1).max(512),
  consent: ConsentSchema,
  // Added by the Socket.IO client when it reconnects, so the server can
  // restore the same socket after a short network drop (US-11).
  pid: z.string().min(1).max(64).optional(),
  offset: z.string().min(1).max(64).optional(),
});

export type ChatSend = z.infer<typeof ChatSendSchema>;
export type HandshakeAuth = z.infer<typeof HandshakeAuthSchema>;
