import type { z } from "zod";
import type { Ack, ErrorCode } from "../types/events.js";

export interface Limiter {
  consume(): boolean;
  retryAfterMs(): number;
}

// Throw this from a handler to refuse the event with a specific, safe code.
export class HandlerError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
  }
}

export interface HandlerHooks {
  // Called with the outcome of every event, for logs and counters.
  onRejected?: (code: ErrorCode, err?: unknown) => void;
}

// The same protection for every event:
//   validate (zod) -> rate limit -> run -> ack
// One bad event can never crash the process, and the client only ever gets an
// error code back.
export function withHandler<S extends z.ZodType>(
  schema: S,
  limiter: Limiter | null,
  fn: (data: z.infer<S>) => void | Promise<void>,
  hooks: HandlerHooks = {},
) {
  return async (payload: unknown, ack?: unknown): Promise<void> => {
    const reply = (result: Ack): void => {
      if (typeof ack === "function") (ack as (result: Ack) => void)(result);
    };

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      hooks.onRejected?.("VALIDATION");
      return reply({ ok: false, error: { code: "VALIDATION" } });
    }

    if (limiter && !limiter.consume()) {
      hooks.onRejected?.("RATE_LIMITED");
      return reply({ ok: false, error: { code: "RATE_LIMITED", retryAfterMs: limiter.retryAfterMs() } });
    }

    try {
      await fn(parsed.data);
      reply({ ok: true });
    } catch (err) {
      if (err instanceof HandlerError) {
        hooks.onRejected?.(err.code);
        return reply({ ok: false, error: { code: err.code } });
      }
      hooks.onRejected?.("INTERNAL", err);
      reply({ ok: false, error: { code: "INTERNAL" } });
    }
  };
}
