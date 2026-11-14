import { z } from "zod";

// Every client -> server payload has a strict schema: wrong types, missing
// fields and unknown fields are all rejected.

// A public key for the key exchange: an uncompressed P-256 point is 65 bytes,
// which is always exactly 87 base64url characters. Whether it is a real point
// on the curve is checked by the partner's browser, not here.
export const E2eKeySchema = z.strictObject({
  publicKey: z.string().regex(/^[A-Za-z0-9_-]{87}$/),
});

// An encrypted message or reaction. The server checks the shape and the size
// and nothing else: it cannot read `ct`. 107 characters is the smallest
// possible envelope (one 64-byte block plus the 16-byte tag); 3,000 holds the
// longest allowed message with room to spare.
export const E2eEnvelopeSchema = z.strictObject({
  seq: z.number().int().min(1).max(0xffffffff),
  ct: z
    .string()
    .min(107)
    .max(3000)
    .regex(/^[A-Za-z0-9_-]+$/),
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

export type HandshakeAuth = z.infer<typeof HandshakeAuthSchema>;
