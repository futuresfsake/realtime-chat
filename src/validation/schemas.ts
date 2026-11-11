import { z } from "zod";

// Every client -> server payload has a strict schema: wrong types, missing
// fields and unknown fields are all rejected.

export const ChatSendSchema = z.strictObject({
  text: z.string().trim().min(1).max(500),
  // Optional: the server already knows your session. If you send one it must
  // be yours, otherwise the message is refused (forged-id protection).
  sessionId: z.uuid().optional(),
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
});

export type ChatSend = z.infer<typeof ChatSendSchema>;
export type HandshakeAuth = z.infer<typeof HandshakeAuthSchema>;
