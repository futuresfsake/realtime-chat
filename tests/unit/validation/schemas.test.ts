import { describe, expect, it } from "vitest";
import { ChatSendSchema, ConsentSchema, HandshakeAuthSchema } from "../../../src/validation/schemas.js";

describe("ChatSendSchema", () => {
  it("accepts a normal message and trims it", () => {
    expect(ChatSendSchema.parse({ text: " hello " })).toEqual({ text: "hello" });
  });

  it("accepts exactly 500 characters and rejects 501", () => {
    expect(ChatSendSchema.safeParse({ text: "a".repeat(500) }).success).toBe(true);
    expect(ChatSendSchema.safeParse({ text: "a".repeat(501) }).success).toBe(false);
  });

  it("rejects empty and whitespace-only text", () => {
    expect(ChatSendSchema.safeParse({ text: "" }).success).toBe(false);
    expect(ChatSendSchema.safeParse({ text: "   " }).success).toBe(false);
  });

  it.each([42, null, undefined, ["hi"], { nested: "hi" }])("rejects non-string text %#", (text) => {
    expect(ChatSendSchema.safeParse({ text }).success).toBe(false);
  });

  it("rejects unknown fields", () => {
    expect(ChatSendSchema.safeParse({ text: "hi", evil: true }).success).toBe(false);
  });

  it.each(["hi", 42, null, undefined, [], {}])("rejects a payload that is not { text } %#", (payload) => {
    expect(ChatSendSchema.safeParse(payload).success).toBe(false);
  });
});

describe("ConsentSchema", () => {
  it("accepts adult: true with a rules version", () => {
    expect(ConsentSchema.safeParse({ adult: true, rulesVersion: "v1" }).success).toBe(true);
  });

  it.each([false, "true", 1, undefined])("rejects adult = %s", (adult) => {
    expect(ConsentSchema.safeParse({ adult, rulesVersion: "v1" }).success).toBe(false);
  });

  it("rejects a missing rules version and unknown fields", () => {
    expect(ConsentSchema.safeParse({ adult: true }).success).toBe(false);
    expect(ConsentSchema.safeParse({ adult: true, rulesVersion: "v1", age: 12 }).success).toBe(false);
  });
});

describe("HandshakeAuthSchema", () => {
  const valid = { protocolVersion: "rc/v1", token: "abc.def", consent: { adult: true, rulesVersion: "v1" } };

  it("accepts the expected shape", () => {
    expect(HandshakeAuthSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects unknown fields and oversized tokens", () => {
    expect(HandshakeAuthSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
    expect(HandshakeAuthSchema.safeParse({ ...valid, token: "x".repeat(513) }).success).toBe(false);
  });
});
