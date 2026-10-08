# Validation with zod

## What is zod?
**zod** is a TypeScript library for **runtime validation**. You describe the shape of the data once (a *schema*), and zod:
1. **checks** real data against it at runtime (`schema.safeParse(data)`), and
2. **produces the TypeScript type** from the same schema (`z.infer<typeof schema>`).

## Where it fits in the stack
```
Browser ──(untrusted JSON over WebSocket)──▶ [ zod schema ] ──(typed, trusted data)──▶ business logic
                                              ▲ trust boundary
```
It sits at the **trust boundary**: the exact point where data from the outside world enters our server.

## Why we need it
TypeScript types **disappear when the code runs**. `socket.on("e2e:envelope", (p: Envelope) => …)` *claims* `p` is an `Envelope`, but an attacker can send `{"seq":"lol","ct":{"$gt":1},"admin":true}`. Without runtime checks that data flows straight into our logic. zod makes the claim true.

## How it works
```ts
const result = envelopeSchema.safeParse(payload);
if (!result.success) return ack({ ok: false, error: { code: "VALIDATION" } });
const env = result.data;            // typed AND verified
```
- `safeParse` never throws; it returns success or a list of issues.
- `z.strictObject` rejects **unknown extra fields**, so clients can't smuggle data in.
- `.trim()`, `.toLowerCase()` **normalize** input, so we store and compare one canonical form.

## Our schemas (`src/validation/schemas.ts`)
```ts
import { z } from "zod";
import { INTERESTS } from "../matchmaking/interests.js";

const base64url = /^[A-Za-z0-9_-]+$/;

export const consentSchema = z.strictObject({
  adult: z.literal(true),                       // must be exactly true
  rulesVersion: z.string().min(1).max(20),
});

export const startSchema = z.strictObject({
  consent: consentSchema,
  interests: z.array(z.enum(INTERESTS)).max(5)
    .refine((xs) => new Set(xs).size === xs.length, "duplicate interests"),
  scope: z.enum(["local", "world"]),
});

export const emptySchema = z.strictObject({});      // session:next, session:leave

export const reportSchema = z.strictObject({
  reason: z.enum(["spam", "harassment", "sexual", "minor", "hate", "other"]),
});

export const publicKeySchema = z.strictObject({
  publicKey: z.string().length(87).regex(base64url), // 65-byte P-256 raw key, unpadded base64url
});

export const envelopeSchema = z.strictObject({
  seq: z.number().int().min(1).max(2 ** 31 - 1),
  ct: z.string().min(24).max(3000).regex(base64url),
});

export const typingSchema = z.strictObject({ isTyping: z.boolean() });

export type StartPayload = z.infer<typeof startSchema>;  // types come FROM schemas
```

### Config schema (`src/config.ts`): validating our *own* settings too
```ts
const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000")
    .transform((s) => s.split(",").map((o) => o.trim())),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(1),
});
export const config = envSchema.parse(process.env);  // crash at startup if misconfigured
```
**Fail fast:** a typo in Render's settings stops the deploy with a clear error (and the health check keeps the old version live) instead of misbehaving at 3 a.m.

## What zod can't check
- **Message text inside envelopes.** It's encrypted, so the server can't see it. The 500-char limit is enforced in the client before encryption, and the server enforces `ct` size. Decrypted payloads are validated **in the client** with a small hand-written check (no build step there).
- **Business rules that need state** (e.g. "are you in this session?"). Those belong in services.

## Alternatives
| Library | Notes |
|---|---|
| **zod** ✅ | TypeScript-first, schema → type inference, very popular |
| Valibot | Similar API, smaller bundle (matters more in browsers) |
| Ajv (JSON Schema) | Fastest, language-neutral schemas, more verbose in TypeScript |
| Joi / Yup | Older, weaker TypeScript inference |
| Hand-written `if` checks | Easy to forget a field; types and checks drift apart |

## When not to use it
On extremely hot paths where every microsecond counts (consider precompiled Ajv), or for trusted internal data that never crosses a boundary.

## Common mistakes
- Using `z.object` instead of `z.strictObject` → extra fields silently accepted
- Using `parse` (throws) in socket handlers without try/catch → one bad packet crashes the handler
- Writing a TypeScript interface **and** a schema separately → they drift. Use `z.infer`
- Validating only on the client
