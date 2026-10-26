# TDD-M2-US21: Bad Input Rejected (Input Validation)

**Milestone:** M2 Hardening + CI/CD + First Deploy
**Story:** US-21 — As a chatter, bad input is rejected safely
**Features:** F-07 (zod schemas, config.ts)
**Gaps:** None

## Acceptance Criteria

- Payloads of the wrong type → rejected with `{ ok:false, error:{ code:"VALIDATION" } }`
- Unknown fields → rejected (strict schemas)
- Oversized payloads → rejected
- The server keeps running after any bad input

## Technical Design

### 1. `src/config.ts` — Centralized Configuration

All limits live here, validated by zod at startup:

```ts
import { z } from "zod";

const ConfigSchema = z.object({
  port: z.coerce.number().default(3000),
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),
  allowedOrigins: z.string().transform(s => s.split(",").map(o => o.trim())).default("http://localhost:3000"),
  trustProxyHops: z.coerce.number().int().min(0).default(0),
  maxMessageLength: z.number().default(500),
  maxPayloadBytes: z.number().default(4096),
  maxSocketsPerIp: z.number().default(5),
  messageBurstCapacity: z.number().default(5),
  messageRefillPerSec: z.number().default(0.5),
  previewBanner: z.coerce.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return ConfigSchema.parse({
    port: process.env.PORT,
    nodeEnv: process.env.NODE_ENV,
    allowedOrigins: process.env.ALLOWED_ORIGINS,
    trustProxyHops: process.env.TRUST_PROXY_HOPS,
  });
}
```

A bad env var → process exits → health check fails → old version stays live.

### 2. `src/validation/schemas.ts` — Zod Schemas

Every client→server event gets a `.strict()` schema:

```ts
import { z } from "zod";

export const ChatSendSchema = z.strictObject({
  text: z.string().min(1).max(500),
});

export const SessionStartSchema = z.strictObject({
  consent: z.strictObject({
    adult: z.literal(true),
    rulesVersion: z.string().min(1),
  }),
  interests: z.array(z.string()).max(5).default([]),
  scope: z.enum(["local", "world"]).default("world"),
});

export const SessionReportSchema = z.strictObject({
  reason: z.enum(["harassment", "sexual", "spam", "hate", "minor", "threats", "other"]),
});

export const E2eKeySchema = z.strictObject({
  publicKey: z.string().length(87),  // base64url of 65 bytes
});

export const E2eEnvelopeSchema = z.strictObject({
  seq: z.number().int().positive(),
  ct: z.string().min(1).max(3000),   // base64url ciphertext
});

export const TypingSchema = z.strictObject({
  isTyping: z.boolean(),
});
```

### 3. `src/gateway/handler.ts` — Universal Handler Wrapper

```ts
export function withHandler<T>(schema: ZodSchema<T>, limiter: TokenBucket | null, fn: HandlerFn<T>) {
  return async (data: unknown, ack?: AckFn) => {
    // 1. Validate
    const result = schema.safeParse(data);
    if (!result.success) return ack?.({ ok: false, error: { code: "VALIDATION" } });

    // 2. Rate limit
    if (limiter && !limiter.consume()) {
      return ack?.({ ok: false, error: { code: "RATE_LIMITED", retryAfterMs: limiter.retryAfterMs() } });
    }

    // 3. Execute
    try {
      await fn(result.data, ack);
    } catch (err) {
      logger.error({ err, event: schema.description });
      ack?.({ ok: false, error: { code: "INTERNAL" } });
    }
  };
}
```

### 4. `maxHttpBufferSize` — Payload Limit

In `app.ts`, Socket.IO server config:
```ts
const io = new Server(httpServer, {
  maxHttpBufferSize: config.maxPayloadBytes, // 4096
});
```

## Test Plan (TDD — write tests FIRST)

### Unit Tests: `tests/unit/validation/schemas.test.ts`

```
describe("ChatSendSchema")
  ✅ accepts { text: "hello" }
  ❌ rejects empty text ""
  ❌ rejects text over 500 chars
  ❌ rejects non-string text (number, null, undefined)
  ❌ rejects extra fields { text: "hi", evil: true }
  ❌ rejects missing text field {}

describe("SessionStartSchema")
  ✅ accepts valid consent + interests + scope
  ❌ rejects adult: false
  ❌ rejects > 5 interests
  ❌ rejects unknown scope "local2"
  ❌ rejects extra fields

describe("E2eEnvelopeSchema")
  ✅ accepts { seq: 1, ct: "abc" }
  ❌ rejects seq: 0 or negative
  ❌ rejects ct over 3000 chars
  ❌ rejects missing seq

describe("Config")
  ✅ loadConfig() with valid env vars returns Config
  ❌ loadConfig() with invalid PORT throws (process should exit)
  ✅ defaults applied when env vars missing
```

### Unit Tests: `tests/unit/gateway/handler.test.ts`

```
describe("withHandler")
  ✅ valid payload → fn called with parsed data
  ❌ invalid payload → ack with VALIDATION, fn NOT called
  ❌ rate limited → ack with RATE_LIMITED, fn NOT called
  ✅ fn throws → ack with INTERNAL, error logged
  ✅ no ack function → silent (no crash)
```

## Files to Create/Modify

| File | Action |
|---|---|
| `src/config.ts` | Create |
| `src/validation/schemas.ts` | Create |
| `src/gateway/handler.ts` | Create |
| `src/app.ts` | Modify — use config, add maxHttpBufferSize |
| `src/index.ts` | Modify — call loadConfig() |
| `src/types.ts` | Modify → move to `src/types/events.ts`, add Ack and ErrorCode |
| `tests/unit/validation/schemas.test.ts` | Create |
| `tests/unit/gateway/handler.test.ts` | Create |
| `tests/unit/config.test.ts` | Create |

## Dependencies

- `zod` (already in package.json)
- No new packages needed

## Threat Mitigations

- T-01 (malformed events): zod strict schemas
- T-23 (error leaks): clients get error codes only, no stack traces
