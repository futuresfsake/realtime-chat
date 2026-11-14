import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SESSION_ID, flipBit, loadE2ee } from "../../helpers/e2ee.js";
import type { E2ee, SessionKeys } from "../../helpers/e2ee.js";

const e2ee = loadE2ee();
const I2R = { sessionId: SESSION_ID, direction: "i2r" } as const;
const R2I = { sessionId: SESSION_ID, direction: "r2i" } as const;
const HELLO = { t: "msg", text: "hello" };

// Both sides of one honest key exchange, using the building blocks directly.
async function exchange(lib: E2ee = e2ee, sessionId = SESSION_ID) {
  const a = await lib.generateKeyPair();
  const b = await lib.generateKeyPair();
  const initiator = await lib.deriveSessionKeys(a.privateKey, b.publicKeyRaw, {
    sessionId,
    role: "initiator",
    myPublicRaw: a.publicKeyRaw,
  });
  const responder = await lib.deriveSessionKeys(b.privateKey, a.publicKeyRaw, {
    sessionId,
    role: "responder",
    myPublicRaw: b.publicKeyRaw,
  });
  return { a, b, initiator, responder };
}

const code = (promise: Promise<unknown>) => promise.then(() => "resolved", (err) => err.code as string);

describe("WebCrypto support", () => {
  it("is supported where crypto.subtle exists", () => {
    expect(e2ee.isSupported()).toBe(true);
  });

  it.each([
    ["no crypto object at all (very old browser)", { crypto: undefined }],
    ["crypto without subtle (page not served over HTTPS)", { crypto: { getRandomValues: () => {} } }],
  ])("is not supported with %s, and then refuses to do anything", async (_name, globals) => {
    const none = loadE2ee(globals);
    expect(none.isSupported()).toBe(false);
    expect(() => none.createChannel({ sessionId: SESSION_ID, role: "initiator" })).toThrow("UNSUPPORTED");
    expect(await code(none.generateKeyPair())).toBe("UNSUPPORTED");
    expect(await code(none.encrypt({} as CryptoKey, 1, HELLO, I2R))).toBe("UNSUPPORTED");
  });
});

describe("key pairs", () => {
  it("makes a P-256 public key of 65 bytes (87 base64url characters)", async () => {
    const { publicKeyRaw } = await e2ee.generateKeyPair();
    expect(publicKeyRaw).toHaveLength(65);
    expect(publicKeyRaw[0]).toBe(4);
    expect(e2ee.toBase64Url(publicKeyRaw)).toMatch(/^[A-Za-z0-9_-]{87}$/);
  });

  it("makes a private key that can never be read out", async () => {
    const { privateKey } = await e2ee.generateKeyPair();
    expect(privateKey.extractable).toBe(false);
    expect(privateKey.usages).toEqual(["deriveBits"]);
    await expect(webcrypto.subtle.exportKey("pkcs8", privateKey)).rejects.toThrow();
    await expect(webcrypto.subtle.exportKey("jwk", privateKey)).rejects.toThrow();
  });

  it("makes a different pair every time", async () => {
    const one = await e2ee.generateKeyPair();
    const two = await e2ee.generateKeyPair();
    expect(e2ee.toBase64Url(one.publicKeyRaw)).not.toBe(e2ee.toBase64Url(two.publicKeyRaw));
  });
});

describe("message keys", () => {
  it("gives both sides the same two keys, mirrored, and neither can be read out", async () => {
    const { initiator, responder } = await exchange();
    for (const keys of [initiator, responder]) {
      expect(keys.sendKey.extractable).toBe(false);
      expect(keys.recvKey.extractable).toBe(false);
      expect(keys.sendKey.algorithm).toMatchObject({ name: "AES-GCM", length: 256 });
      expect(keys.sendKey.usages).toEqual(["encrypt"]);
      expect(keys.recvKey.usages).toEqual(["decrypt"]);
    }
    const toResponder = await e2ee.encrypt(initiator.sendKey, 1, HELLO, I2R);
    expect(await e2ee.decrypt(responder.recvKey, 1, toResponder, I2R)).toEqual(HELLO);
    const toInitiator = await e2ee.encrypt(responder.sendKey, 1, { t: "msg", text: "hi back" }, R2I);
    expect(await e2ee.decrypt(initiator.recvKey, 1, toInitiator, R2I)).toEqual({ t: "msg", text: "hi back" });
  });

  it("uses a different key per direction, so both sides starting at 1 never share an IV", async () => {
    const { initiator, responder } = await exchange();
    const fromInitiator = await e2ee.encrypt(initiator.sendKey, 1, HELLO, I2R);
    const fromResponder = await e2ee.encrypt(responder.sendKey, 1, HELLO, R2I);
    expect(fromInitiator).not.toBe(fromResponder);
    // The initiator's receiving key is the other direction's key: it cannot
    // open the initiator's own envelope, even with matching labels.
    expect(await code(e2ee.decrypt(initiator.recvKey, 1, fromInitiator, I2R))).toBe("AUTH_FAILED");
  });

  it("derives different keys for a different session id", async () => {
    const a = await e2ee.generateKeyPair();
    const b = await e2ee.generateKeyPair();
    const other = "6f1c2b0e-2222-4000-8000-000000000002";
    const here = await e2ee.deriveSessionKeys(a.privateKey, b.publicKeyRaw, {
      sessionId: SESSION_ID,
      role: "initiator",
      myPublicRaw: a.publicKeyRaw,
    });
    const there = await e2ee.deriveSessionKeys(b.privateKey, a.publicKeyRaw, {
      sessionId: other,
      role: "responder",
      myPublicRaw: b.publicKeyRaw,
    });
    const ct = await e2ee.encrypt(here.sendKey, 1, HELLO, I2R);
    expect(await code(e2ee.decrypt(there.recvKey, 1, ct, I2R))).toBe("AUTH_FAILED");
  });

  it("derives different keys when a third party sits in the middle", async () => {
    const a = await e2ee.generateKeyPair();
    const b = await e2ee.generateKeyPair();
    const mallory = await e2ee.generateKeyPair();
    const aliceSide = await e2ee.deriveSessionKeys(a.privateKey, mallory.publicKeyRaw, {
      sessionId: SESSION_ID,
      role: "initiator",
      myPublicRaw: a.publicKeyRaw,
    });
    const bobSide = await e2ee.deriveSessionKeys(b.privateKey, mallory.publicKeyRaw, {
      sessionId: SESSION_ID,
      role: "responder",
      myPublicRaw: b.publicKeyRaw,
    });
    const ct = await e2ee.encrypt(aliceSide.sendKey, 1, HELLO, I2R);
    expect(await code(e2ee.decrypt(bobSide.recvKey, 1, ct, I2R))).toBe("AUTH_FAILED");
    expect(aliceSide.safetyCode).not.toBe(bobSide.safetyCode);
  });

  describe("refuses a bad public key from the other side", () => {
    const derive = async (peer: Uint8Array) => {
      const mine = await e2ee.generateKeyPair();
      return code(
        e2ee.deriveSessionKeys(mine.privateKey, peer, {
          sessionId: SESSION_ID,
          role: "initiator",
          myPublicRaw: mine.publicKeyRaw,
        }),
      );
    };

    it("a point that is not on the curve", async () => {
      const { publicKeyRaw } = await e2ee.generateKeyPair();
      const offCurve = Uint8Array.from(publicKeyRaw);
      offCurve[64]! ^= 0x01; // y changed: (x, y') is no longer a solution of the curve equation
      expect(await derive(offCurve)).toBe("BAD_PEER_KEY");
    });

    it("all zeros, the wrong length, a compressed point, or not bytes at all", async () => {
      const { publicKeyRaw } = await e2ee.generateKeyPair();
      expect(await derive(new Uint8Array(65))).toBe("BAD_PEER_KEY");
      expect(await derive(publicKeyRaw.slice(0, 64))).toBe("BAD_PEER_KEY");
      expect(await derive(new Uint8Array(66).fill(4))).toBe("BAD_PEER_KEY");
      const compressed = publicKeyRaw.slice(0, 33);
      compressed[0] = 2;
      expect(await derive(compressed)).toBe("BAD_PEER_KEY");
      expect(await derive("not bytes" as unknown as Uint8Array)).toBe("BAD_PEER_KEY");
    });

    it("its own public key sent back (reflection)", async () => {
      const mine = await e2ee.generateKeyPair();
      const result = code(
        e2ee.deriveSessionKeys(mine.privateKey, Uint8Array.from(mine.publicKeyRaw), {
          sessionId: SESSION_ID,
          role: "responder",
          myPublicRaw: mine.publicKeyRaw,
        }),
      );
      expect(await result).toBe("REFLECTED_KEY");
    });

    it("and refuses an unknown role or an empty session id", async () => {
      const a = await e2ee.generateKeyPair();
      const b = await e2ee.generateKeyPair();
      const opts = { sessionId: SESSION_ID, role: "initiator", myPublicRaw: a.publicKeyRaw };
      expect(await code(e2ee.deriveSessionKeys(a.privateKey, b.publicKeyRaw, { ...opts, role: "admin" }))).toBe("BAD_ROLE");
      expect(await code(e2ee.deriveSessionKeys(a.privateKey, b.publicKeyRaw, { ...opts, sessionId: "" }))).toBe(
        "BAD_SESSION",
      );
    });
  });
});

describe("encrypt / decrypt", () => {
  let keys: { initiator: SessionKeys; responder: SessionKeys };
  const fresh = async () => (keys = await exchange());

  it("round trip returns the same object, including non-Latin text and emoji", async () => {
    await fresh();
    const plain = { t: "msg", text: 'Kumusta! 你好 😂 "quotes" \\ back' };
    const ct = await e2ee.encrypt(keys.initiator.sendKey, 7, plain, I2R);
    expect(ct).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await e2ee.decrypt(keys.responder.recvKey, 7, ct, I2R)).toEqual(plain);
  });

  it("the ciphertext does not contain the message", async () => {
    await fresh();
    const ct = await e2ee.encrypt(keys.initiator.sendKey, 1, { t: "msg", text: "attack at dawn" }, I2R);
    expect(Buffer.from(ct, "base64url").toString("latin1")).not.toContain("attack");
    expect(ct).not.toContain(Buffer.from("attack at dawn").toString("base64url"));
  });

  it("flipping any single bit makes decryption fail", async () => {
    await fresh();
    const ct = await e2ee.encrypt(keys.initiator.sendKey, 1, HELLO, I2R);
    const size = e2ee.fromBase64Url(ct).length; // 64 bytes of padded message + 16 bytes of tag
    expect(size).toBe(80);
    for (const index of [0, 1, 31, 63, 64, 79]) {
      expect(await code(e2ee.decrypt(keys.responder.recvKey, 1, flipBit(e2ee, ct, index), I2R))).toBe("AUTH_FAILED");
    }
    expect(await e2ee.decrypt(keys.responder.recvKey, 1, ct, I2R)).toEqual(HELLO); // untouched still opens
  });

  it("a truncated or extended ciphertext fails", async () => {
    await fresh();
    const ct = await e2ee.encrypt(keys.initiator.sendKey, 1, HELLO, I2R);
    expect(await code(e2ee.decrypt(keys.responder.recvKey, 1, ct.slice(0, -4), I2R))).toBe("AUTH_FAILED");
    expect(await code(e2ee.decrypt(keys.responder.recvKey, 1, `${ct}AAAA`, I2R))).toBe("AUTH_FAILED");
  });

  it("an envelope moved to another position, direction or session fails", async () => {
    await fresh();
    const ct = await e2ee.encrypt(keys.initiator.sendKey, 3, HELLO, I2R);
    const open = (seq: number, context: { sessionId: string; direction: "i2r" | "r2i" }) =>
      code(e2ee.decrypt(keys.responder.recvKey, seq, ct, context));
    expect(await open(4, I2R)).toBe("AUTH_FAILED"); // claimed to be message 4
    expect(await open(3, R2I)).toBe("AUTH_FAILED"); // claimed to go the other way
    expect(await open(3, { ...I2R, sessionId: "6f1c2b0e-2222-4000-8000-000000000002" })).toBe("AUTH_FAILED");
    expect(await open(3, I2R)).toBe("resolved");
  });

  it("refuses sequence numbers that are not whole numbers from 1 to 2^32 - 1", async () => {
    await fresh();
    for (const seq of [0, -1, 1.5, 2 ** 32, Number.NaN, "1" as unknown as number]) {
      expect(await code(e2ee.encrypt(keys.initiator.sendKey, seq, HELLO, I2R))).toBe("BAD_SEQ");
      expect(await code(e2ee.decrypt(keys.responder.recvKey, seq, "AAAA", I2R))).toBe("BAD_SEQ");
    }
    const last = await e2ee.encrypt(keys.initiator.sendKey, 2 ** 32 - 1, HELLO, I2R);
    expect(await e2ee.decrypt(keys.responder.recvKey, 2 ** 32 - 1, last, I2R)).toEqual(HELLO);
  });

  it("refuses ciphertext that is not base64url", async () => {
    await fresh();
    for (const ct of ["", "has spaces", "pad==", "plus+slash/", "A", 42 as unknown as string]) {
      expect(await code(e2ee.decrypt(keys.responder.recvKey, 1, ct, I2R))).toBe("BAD_ENCODING");
    }
  });

  it("a key made for sending cannot decrypt, and the other way round", async () => {
    await fresh();
    const ct = await e2ee.encrypt(keys.initiator.sendKey, 1, HELLO, I2R);
    expect(await code(e2ee.decrypt(keys.initiator.sendKey, 1, ct, I2R))).toBe("AUTH_FAILED");
    await expect(e2ee.encrypt(keys.initiator.recvKey, 1, HELLO, R2I)).rejects.toThrow();
  });
});

describe("padding", () => {
  const jsonBytes = (plain: unknown) => Buffer.byteLength(JSON.stringify(plain));

  it("pads a 1-character message to 64 bytes", () => {
    expect(e2ee.pad({ t: "msg", text: "a" })).toHaveLength(64);
  });

  it("pads exactly 64 bytes to 64, and 65 bytes to 128", () => {
    const base = jsonBytes({ t: "msg", text: "" });
    const fits = { t: "msg", text: "x".repeat(64 - base) };
    const over = { t: "msg", text: "x".repeat(65 - base) };
    expect(jsonBytes(fits)).toBe(64);
    expect(e2ee.pad(fits)).toHaveLength(64);
    expect(jsonBytes(over)).toBe(65);
    expect(e2ee.pad(over)).toHaveLength(128);
  });

  it("makes messages of similar length indistinguishable by size", async () => {
    const { initiator } = await exchange();
    const short = await e2ee.encrypt(initiator.sendKey, 1, { t: "msg", text: "no" }, I2R);
    const longer = await e2ee.encrypt(initiator.sendKey, 2, { t: "msg", text: "yes, definitely, see you there" }, I2R);
    const reaction = await e2ee.encrypt(initiator.sendKey, 3, { t: "react", ref: 1, emoji: "👍" }, I2R);
    expect(short).toHaveLength(107); // (64 + 16) bytes as base64url
    expect(longer).toHaveLength(107);
    expect(reaction).toHaveLength(107);
  });

  it("unpad(pad(x)) is x", () => {
    for (const plain of [{ t: "msg", text: "a" }, { t: "msg", text: "ñ 你好 😂".repeat(20) }, { t: "react", ref: 9, emoji: "🙏" }]) {
      expect(e2ee.unpad(e2ee.pad(plain))).toEqual(plain);
    }
  });

  it("a 500-character message in a 3-byte script still fits; an oversized one is refused", () => {
    const padded = e2ee.pad({ t: "msg", text: "好".repeat(500) });
    expect(padded.length % 64).toBe(0);
    expect(padded.length).toBeLessThanOrEqual(2176);
    expect(() => e2ee.pad({ t: "msg", text: "好".repeat(800) })).toThrow("TOO_LONG");
  });

  it("the largest envelope fits the server's 3,000 character limit", async () => {
    const { initiator } = await exchange();
    const biggest = { t: "msg", text: "x".repeat(2176 - jsonBytes({ t: "msg", text: "" })) };
    expect(e2ee.pad(biggest)).toHaveLength(2176);
    const ct = await e2ee.encrypt(initiator.sendKey, 1, biggest, I2R);
    expect(ct.length).toBeLessThanOrEqual(3000);
  });

  it("unpad refuses bytes that are not JSON", () => {
    expect(() => e2ee.unpad(new Uint8Array(64))).toThrow("BAD_PLAINTEXT");
    expect(() => e2ee.unpad(Uint8Array.from([0xff, 0xfe, 0x00]))).toThrow("BAD_PLAINTEXT");
  });
});

describe("base64url", () => {
  it("round trips every byte value without +, / or =", () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    const text = e2ee.toBase64Url(bytes);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(text).toBe(Buffer.from(bytes).toString("base64url"));
    expect(Array.from(e2ee.fromBase64Url(text))).toEqual(Array.from(bytes));
  });
});

describe("the code is what it says it is", () => {
  it("uses only WebCrypto: no Math.random, no hand-made primitives, no storage, no logging", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("public/js/crypto.js", "utf8");
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/console\./);
    expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
    expect(source).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon/);
    expect(source).not.toMatch(/extractable:\s*true|, true, \[/); // no key is ever created extractable
  });
});
