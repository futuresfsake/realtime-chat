import { describe, expect, it, vi } from "vitest";
import { withHandler } from "../../../src/gateway/handler.js";
import { ChatSendSchema } from "../../../src/validation/schemas.js";

const allow = { consume: () => true, retryAfterMs: () => 0 };
const deny = { consume: () => false, retryAfterMs: () => 1500 };

describe("withHandler", () => {
  it("runs the handler with parsed data and acks ok", async () => {
    const fn = vi.fn();
    const ack = vi.fn();
    await withHandler(ChatSendSchema, allow, fn)({ text: "  hello  " }, ack);
    expect(fn).toHaveBeenCalledWith({ text: "hello" });
    expect(ack).toHaveBeenCalledWith({ ok: true });
  });

  it("rejects invalid payloads without running the handler", async () => {
    const fn = vi.fn();
    const ack = vi.fn();
    const onRejected = vi.fn();
    await withHandler(ChatSendSchema, allow, fn, { onRejected })({ text: 42 }, ack);
    expect(fn).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({ ok: false, error: { code: "VALIDATION" } });
    expect(onRejected).toHaveBeenCalledWith("VALIDATION");
  });

  it("does not spend rate-limit tokens on invalid payloads", async () => {
    const limiter = { consume: vi.fn(() => true), retryAfterMs: () => 0 };
    await withHandler(ChatSendSchema, limiter, vi.fn())(null, vi.fn());
    expect(limiter.consume).not.toHaveBeenCalled();
  });

  it("rejects when rate limited and says how long to wait", async () => {
    const fn = vi.fn();
    const ack = vi.fn();
    await withHandler(ChatSendSchema, deny, fn)({ text: "hi" }, ack);
    expect(fn).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({ ok: false, error: { code: "RATE_LIMITED", retryAfterMs: 1500 } });
  });

  it("turns a thrown error into INTERNAL with no details", async () => {
    const ack = vi.fn();
    const onRejected = vi.fn();
    const boom = new Error("secret internals");
    await withHandler(ChatSendSchema, null, () => { throw boom; }, { onRejected })({ text: "hi" }, ack);
    expect(ack).toHaveBeenCalledWith({ ok: false, error: { code: "INTERNAL" } });
    expect(JSON.stringify(ack.mock.calls)).not.toContain("secret internals");
    expect(onRejected).toHaveBeenCalledWith("INTERNAL", boom);
  });

  it("handles async handlers that reject", async () => {
    const ack = vi.fn();
    await withHandler(ChatSendSchema, null, async () => { throw new Error("x"); })({ text: "hi" }, ack);
    expect(ack).toHaveBeenCalledWith({ ok: false, error: { code: "INTERNAL" } });
  });

  it("does not crash when the client sends no ack, or a non-function ack", async () => {
    await expect(withHandler(ChatSendSchema, allow, vi.fn())({ text: "hi" })).resolves.toBeUndefined();
    await expect(withHandler(ChatSendSchema, allow, vi.fn())({ bad: true }, "not-a-function")).resolves.toBeUndefined();
  });
});
