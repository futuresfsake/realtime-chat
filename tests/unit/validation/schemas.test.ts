import { describe, expect, it } from "vitest";
import {
  ConsentSchema,
  E2eEnvelopeSchema,
  E2eKeySchema,
  HandshakeAuthSchema,
  SearchPrefsSchema,
  TypingSchema,
} from "../../../src/validation/schemas.js";

const KEY = "B".repeat(87);
const CT = "A".repeat(107);

describe("E2eKeySchema", () => {
  it("accepts an 87-character base64url string", () => {
    expect(E2eKeySchema.safeParse({ publicKey: KEY }).success).toBe(true);
    expect(E2eKeySchema.safeParse({ publicKey: "-_".repeat(43) + "a" }).success).toBe(true);
  });
  it.each([86, 88, 0])("rejects %i characters", (n) => {
    expect(E2eKeySchema.safeParse({ publicKey: "B".repeat(n) }).success).toBe(false);
  });
  it.each(["+", "/", "=", " ", "\n", "é"])("rejects the character %j", (c) => {
    expect(E2eKeySchema.safeParse({ publicKey: "B".repeat(86) + c }).success).toBe(false);
  });
  it.each([42, null, undefined, [KEY], {}])("rejects a key that is %j", (publicKey) => {
    expect(E2eKeySchema.safeParse({ publicKey }).success).toBe(false);
  });
  it("rejects unknown and missing fields", () => {
    expect(E2eKeySchema.safeParse({ publicKey: KEY, evil: 1 }).success).toBe(false);
    expect(E2eKeySchema.safeParse({}).success).toBe(false);
  });
});

describe("E2eEnvelopeSchema", () => {
  it("accepts the smallest and the largest envelope", () => {
    expect(E2eEnvelopeSchema.safeParse({ seq: 1, ct: CT }).success).toBe(true);
    expect(E2eEnvelopeSchema.safeParse({ seq: 4294967295, ct: "A".repeat(3000) }).success).toBe(true);
  });
  it.each([0, -1, 1.5, 4294967296, "1", null, undefined, Number.NaN])("rejects seq %s", (seq) => {
    expect(E2eEnvelopeSchema.safeParse({ seq, ct: CT }).success).toBe(false);
  });
  it("rejects ciphertext that is too short, too long or not base64url", () => {
    for (const ct of ["", "A".repeat(106), "A".repeat(3001), CT + "=", CT + "+", "é".repeat(107)]) {
      expect(E2eEnvelopeSchema.safeParse({ seq: 1, ct }).success).toBe(false);
    }
  });
  it("rejects anything that carries readable fields", () => {
    expect(E2eEnvelopeSchema.safeParse({ seq: 1, ct: CT, text: "hi" }).success).toBe(false);
    expect(E2eEnvelopeSchema.safeParse({ seq: 1, ct: CT, sessionId: "x" }).success).toBe(false);
    expect(E2eEnvelopeSchema.safeParse({ text: "hi" }).success).toBe(false);
    expect(E2eEnvelopeSchema.safeParse("hi").success).toBe(false);
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

describe("TypingSchema", () => {
  it("accepts true and false", () => {
    expect(TypingSchema.safeParse({ isTyping: true }).success).toBe(true);
    expect(TypingSchema.safeParse({ isTyping: false }).success).toBe(true);
  });

  it.each([{}, { isTyping: "true" }, { isTyping: 1 }, { isTyping: true, text: "secret" }, null, "typing"])(
    "rejects %j",
    (payload) => {
      expect(TypingSchema.safeParse(payload).success).toBe(false);
    },
  );
});

describe("SearchPrefsSchema", () => {
  it("fills in no interests and worldwide for an empty payload", () => {
    expect(SearchPrefsSchema.parse({})).toEqual({ interests: [], scope: "world" });
  });
  it("accepts up to five unique interests from the list and a scope", () => {
    const prefs = { interests: ["anime", "art", "books", "cars", "coding"], scope: "local" };
    expect(SearchPrefsSchema.parse(prefs)).toEqual(prefs);
  });
  it("rejects a sixth interest, a repeat, one that is not on the list, and anything that is not a slug", () => {
    expect(SearchPrefsSchema.safeParse({ interests: ["anime", "art", "books", "cars", "coding", "dance"] }).success).toBe(false);
    expect(SearchPrefsSchema.safeParse({ interests: ["anime", "anime"] }).success).toBe(false);
    expect(SearchPrefsSchema.safeParse({ interests: ["politics"] }).success).toBe(false);
    expect(SearchPrefsSchema.safeParse({ interests: ["<script>"] }).success).toBe(false);
    expect(SearchPrefsSchema.safeParse({ interests: ["Gaming"] }).success).toBe(false);
    expect(SearchPrefsSchema.safeParse({ interests: "gaming" }).success).toBe(false);
  });
  it("rejects an unknown scope, extra fields and a country the client tries to claim", () => {
    expect(SearchPrefsSchema.safeParse({ scope: "nearby" }).success).toBe(false);
    expect(SearchPrefsSchema.safeParse({ country: "PH" }).success).toBe(false);
    expect(SearchPrefsSchema.safeParse({ interests: [], scope: "world", evil: 1 }).success).toBe(false);
    expect(SearchPrefsSchema.safeParse(null).success).toBe(false);
  });
});
