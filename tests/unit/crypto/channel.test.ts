import { describe, expect, it } from "vitest";
import { SESSION_ID, flipBit, loadE2ee, securedPair } from "../../helpers/e2ee.js";
import type { Channel, Envelope } from "../../helpers/e2ee.js";

const e2ee = loadE2ee();
const REACTIONS = ["👍", "😂"];
const msg = (text: string) => ({ t: "msg", text });
const code = (promise: Promise<unknown>) => promise.then(() => "resolved", (err) => err.code as string);
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => ({ code: "resolved", fatal: false }),
    (err) => ({ code: err.code as string, fatal: err.fatal as boolean }),
  );

// The partner's side built by hand, so a test can make envelopes that a
// well-behaved client would never send (they are genuine, but wrong inside).
async function withRoguePartner() {
  const victim = e2ee.createChannel({ sessionId: SESSION_ID, role: "responder", allowedReactions: REACTIONS });
  const rogue = await e2ee.generateKeyPair();
  const keys = await e2ee.deriveSessionKeys(rogue.privateKey, e2ee.fromBase64Url(await victim.publicKey()), {
    sessionId: SESSION_ID,
    role: "initiator",
    myPublicRaw: rogue.publicKeyRaw,
  });
  await victim.receiveKey(e2ee.toBase64Url(rogue.publicKeyRaw));
  const forge = async (seq: number, plain: unknown): Promise<Envelope> => ({
    seq,
    ct: await e2ee.encrypt(keys.sendKey, seq, plain, { sessionId: SESSION_ID, direction: "i2r" }),
  });
  return { victim, forge };
}

describe("key exchange", () => {
  it("is not ready, and seals nothing, before the partner's key arrives", async () => {
    const channel = e2ee.createChannel({ sessionId: SESSION_ID, role: "initiator" });
    expect(channel.ready).toBe(false);
    expect(channel.safetyCode).toBeNull();
    expect(await code(channel.seal(msg("too early")))).toBe("NOT_READY");
    await channel.publicKey();
    expect(channel.ready).toBe(false); // having my own key is not enough
    expect(await code(channel.seal(msg("still too early")))).toBe("NOT_READY");
  });

  it("makes both sides ready with the same safety code", async () => {
    const { initiator, responder } = await securedPair(e2ee);
    expect(initiator.ready).toBe(true);
    expect(responder.ready).toBe(true);
    expect(initiator.safetyCode).toMatch(/^\d{5} \d{5} \d{5} \d{5}$/);
    expect(initiator.safetyCode).toBe(responder.safetyCode);
  });

  it("offers an 87-character public key and the same one every time", async () => {
    const channel = e2ee.createChannel({ sessionId: SESSION_ID, role: "initiator" });
    const key = await channel.publicKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]{87}$/);
    expect(await channel.publicKey()).toBe(key);
  });

  it("uses a fresh key pair for every chat", async () => {
    const one = e2ee.createChannel({ sessionId: SESSION_ID, role: "initiator" });
    const two = e2ee.createChannel({ sessionId: SESSION_ID, role: "initiator" });
    expect(await one.publicKey()).not.toBe(await two.publicKey());
  });

  it("accepts the partner's key even if it arrives before my own pair is ready", async () => {
    const responder = e2ee.createChannel({ sessionId: SESSION_ID, role: "responder" });
    const key = await responder.publicKey();
    const initiator = e2ee.createChannel({ sessionId: SESSION_ID, role: "initiator" });
    await initiator.receiveKey(key); // called at once, before initiator.publicKey()
    expect(initiator.ready).toBe(true);
  });

  it("accepts only one key per chat", async () => {
    const { initiator } = await securedPair(e2ee);
    const before = initiator.safetyCode;
    const another = await e2ee.createChannel({ sessionId: SESSION_ID, role: "responder" }).publicKey();
    expect(await code(initiator.receiveKey(another))).toBe("KEY_ALREADY_SET");
    expect(initiator.safetyCode).toBe(before);
  });

  it.each([
    ["garbage", "!!!not-a-key!!!", "BAD_ENCODING"],
    ["a key that is too short", "A".repeat(40), "BAD_PEER_KEY"],
    ["87 characters that are not a curve point", "B".repeat(87), "BAD_PEER_KEY"],
  ])("refuses %s and never becomes ready", async (_name, key, expected) => {
    const channel = e2ee.createChannel({ sessionId: SESSION_ID, role: "initiator" });
    expect(await code(channel.receiveKey(key))).toBe(expected);
    expect(channel.ready).toBe(false);
    expect(await code(channel.seal(msg("hi")))).toBe("NOT_READY");
  });

  it("refuses its own key sent back", async () => {
    const channel = e2ee.createChannel({ sessionId: SESSION_ID, role: "initiator" });
    expect(await code(channel.receiveKey(await channel.publicKey()))).toBe("REFLECTED_KEY");
    expect(channel.ready).toBe(false);
  });

  it("refuses to be created with an unknown role or without a session id", () => {
    expect(() => e2ee.createChannel({ sessionId: SESSION_ID, role: "admin" })).toThrow("BAD_ROLE");
    expect(() => e2ee.createChannel({ sessionId: "", role: "initiator" })).toThrow("BAD_SESSION");
  });
});

describe("sending and receiving", () => {
  it("delivers messages and reactions in both directions", async () => {
    const { initiator, responder } = await securedPair(e2ee);
    expect(await responder.open(await initiator.seal(msg("hello")))).toEqual(msg("hello"));
    expect(await initiator.open(await responder.seal(msg("hi!")))).toEqual(msg("hi!"));
    const reaction = { t: "react", ref: 1, emoji: "😂" };
    expect(await initiator.open(await responder.seal(reaction))).toEqual(reaction);
  });

  it("numbers each direction 1, 2, 3 on its own", async () => {
    const { initiator, responder } = await securedPair(e2ee);
    const seqs = async (channel: Channel) => [
      (await channel.seal(msg("a"))).seq,
      (await channel.seal(msg("b"))).seq,
      (await channel.seal(msg("c"))).seq,
    ];
    expect(await seqs(initiator)).toEqual([1, 2, 3]);
    expect(await seqs(responder)).toEqual([1, 2, 3]);
  });

  it("never uses a number twice, even for messages written at the same moment", async () => {
    const { initiator, responder } = await securedPair(e2ee);
    const envelopes = await Promise.all(["one", "two", "three", "four"].map((text) => initiator.seal(msg(text))));
    expect(envelopes.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
    expect(new Set(envelopes.map((e) => e.ct)).size).toBe(4);
    const texts = [];
    for (const envelope of envelopes) texts.push(((await responder.open(envelope)) as { text: string }).text);
    expect(texts).toEqual(["one", "two", "three", "four"]);
  });

  it("opens envelopes that arrive together in the order they arrived", async () => {
    const { initiator, responder } = await securedPair(e2ee);
    const first = await initiator.seal(msg("first"));
    const second = await initiator.seal(msg("second"));
    const opened = await Promise.all([responder.open(first), responder.open(second)]);
    expect(opened).toEqual([msg("first"), msg("second")]);
  });

  it("opens an envelope that arrives while the keys are still being derived", async () => {
    const initiator = e2ee.createChannel({ sessionId: SESSION_ID, role: "initiator" });
    const responder = e2ee.createChannel({ sessionId: SESSION_ID, role: "responder" });
    const [keyI, keyR] = await Promise.all([initiator.publicKey(), responder.publicKey()]);
    await initiator.receiveKey(keyR);
    const envelope = await initiator.seal(msg("quick"));
    const deriving = responder.receiveKey(keyI); // not awaited: the envelope is right behind the key
    expect(await responder.open(envelope)).toEqual(msg("quick"));
    await deriving;
  });

  it("skipped numbers are fine (a refused or lost envelope leaves a gap)", async () => {
    const { initiator, responder } = await securedPair(e2ee);
    await initiator.seal(msg("lost on the way"));
    const second = await initiator.seal(msg("arrives"));
    expect(second.seq).toBe(2);
    expect(await responder.open(second)).toEqual(msg("arrives"));
  });

  it("gives every envelope of a short message the same size", async () => {
    const { initiator } = await securedPair(e2ee);
    const sizes = new Set<number>();
    for (const text of ["k", "ok", "see you at eight"]) sizes.add((await initiator.seal(msg(text))).ct.length);
    sizes.add((await initiator.seal({ t: "react", ref: 1, emoji: "👍" })).ct.length);
    expect([...sizes]).toEqual([107]);
  });
});

describe("what a channel refuses to send", () => {
  it.each([
    ["an empty message", msg("")],
    ["a whitespace-only message", msg("   ")],
    ["text that is not a string", { t: "msg", text: 42 }],
    ["an unknown kind", { t: "file", text: "x" }],
    ["extra fields", { t: "msg", text: "hi", admin: true }],
    ["missing fields", { t: "msg" }],
    ["a reaction that is not allowed", { t: "react", ref: 1, emoji: "🔥" }],
    ["a reaction to message 0", { t: "react", ref: 0, emoji: "👍" }],
    ["a reaction with a fractional number", { t: "react", ref: 1.5, emoji: "👍" }],
    ["a string", "hello"],
    ["null", null],
    ["an array", [msg("hi")]],
  ])("%s", async (_name, plain) => {
    const { initiator } = await securedPair(e2ee);
    expect(await code(initiator.seal(plain))).toBe("BAD_MESSAGE");
    expect((await initiator.seal(msg("fine"))).seq).toBe(1); // a refused message uses no number
  });

  it("501 characters (500 is the limit)", async () => {
    const { initiator, responder } = await securedPair(e2ee);
    expect(await code(initiator.seal(msg("x".repeat(501))))).toBe("TOO_LONG");
    const longest = await initiator.seal(msg("x".repeat(500)));
    expect(((await responder.open(longest)) as { text: string }).text).toHaveLength(500);
  });

  it("500 characters that would not fit an envelope once encoded", async () => {
    const { initiator } = await securedPair(e2ee);
    expect(await code(initiator.seal(msg("\u0001".repeat(500))))).toBe("TOO_LONG");
  });
});

describe("tampering, replay and reordering", () => {
  it("refuses the same envelope twice", async () => {
    const { initiator, responder } = await securedPair(e2ee);
    const envelope = await initiator.seal(msg("once"));
    expect(await responder.open(envelope)).toEqual(msg("once"));
    expect(await code(responder.open(envelope))).toBe("REPLAY");
  });

  it("refuses an older envelope after a newer one (reorder)", async () => {
    const { initiator, responder } = await securedPair(e2ee);
    const first = await initiator.seal(msg("first"));
    const second = await initiator.seal(msg("second"));
    expect(await responder.open(second)).toEqual(msg("second"));
    expect(await code(responder.open(first))).toBe("REPLAY");
  });

  it("refuses an envelope with one bit changed, or with its number changed", async () => {
    const { initiator, responder } = await securedPair(e2ee);
    const envelope = await initiator.seal(msg("intact"));
    expect(await code(responder.open({ seq: envelope.seq, ct: flipBit(e2ee, envelope.ct, 10) }))).toBe("AUTH_FAILED");
    expect(await code(responder.open({ seq: envelope.seq + 1, ct: envelope.ct }))).toBe("AUTH_FAILED");
    expect(await responder.open(envelope)).toEqual(msg("intact")); // a forgery does not block the real one
  });

  it("refuses an envelope from another chat, even between the same two people", async () => {
    const here = await securedPair(e2ee);
    const there = await securedPair(e2ee, { sessionId: "6f1c2b0e-2222-4000-8000-000000000002" });
    const foreign = await there.initiator.seal(msg("from another chat"));
    expect(await code(here.responder.open(foreign))).toBe("AUTH_FAILED");
  });

  it("refuses my own envelope sent back to me", async () => {
    const { initiator } = await securedPair(e2ee);
    const mine = await initiator.seal(msg("echo"));
    expect(await code(initiator.open(mine))).toBe("AUTH_FAILED");
  });

  it.each([
    ["no envelope", undefined],
    ["a missing number", { ct: "AAAA" }],
    ["number 0", { seq: 0, ct: "AAAA" }],
    ["a number that is a string", { seq: "1", ct: "AAAA" }],
    ["ciphertext that is not base64url", { seq: 1, ct: "not base64!" }],
    ["ciphertext that is not a string", { seq: 1, ct: { $gt: 1 } }],
  ])("refuses a malformed envelope: %s", async (_name, envelope) => {
    const { responder } = await securedPair(e2ee);
    expect(["BAD_SEQ", "BAD_ENCODING"]).toContain(await code(responder.open(envelope)));
  });

  it("refuses an envelope before the key exchange", async () => {
    const { initiator } = await securedPair(e2ee);
    const envelope = await initiator.seal(msg("hi"));
    const fresh = e2ee.createChannel({ sessionId: SESSION_ID, role: "responder" });
    expect(await code(fresh.open(envelope))).toBe("NOT_READY");
  });
});

describe("a genuine envelope with bad content (the partner is a stranger)", () => {
  it.each([
    ["an unknown kind", { t: "html", text: "<img src=x onerror=alert(1)>" }],
    ["extra fields", { t: "msg", text: "hi", from: "admin" }],
    ["501 characters", { t: "msg", text: "x".repeat(501) }],
    ["a reaction that is not allowed", { t: "react", ref: 1, emoji: "💩" }],
    ["not an object", "just a string"],
  ])("is refused: %s", async (_name, plain) => {
    const { victim, forge } = await withRoguePartner();
    expect(["BAD_MESSAGE", "TOO_LONG"]).toContain(await code(victim.open(await forge(1, plain))));
    // It was genuine, so its number is spent: it cannot be tried again.
    expect(await code(victim.open(await forge(1, msg("retry"))))).toBe("REPLAY");
    expect(await victim.open(await forge(2, msg("ok")))).toEqual(msg("ok"));
  });
});

describe("three failures end the chat", () => {
  it("survives two bad envelopes, then the third is fatal and the channel is dead", async () => {
    const { initiator, responder } = await securedPair(e2ee);
    const good = await initiator.seal(msg("good"));
    const bad = { seq: 9, ct: flipBit(e2ee, good.ct, 0) };

    expect(await failure(responder.open(bad))).toEqual({ code: "AUTH_FAILED", fatal: false });
    expect(await failure(responder.open(bad))).toEqual({ code: "AUTH_FAILED", fatal: false });
    expect(responder.ready).toBe(true);
    expect(await responder.open(good)).toEqual(msg("good")); // still works after two

    expect(await failure(responder.open(good))).toEqual({ code: "REPLAY", fatal: true }); // third failure
    expect(responder.ready).toBe(false);
    const next = await initiator.seal(msg("too late"));
    expect(await failure(responder.open(next))).toEqual({ code: "BROKEN", fatal: true });
    expect(await code(responder.seal(msg("nor can I send")))).toBe("NOT_READY");
  });

  it("counts failures per chat: a new channel starts clean", async () => {
    const first = await securedPair(e2ee);
    for (let i = 0; i < 3; i++) await failure(first.responder.open({ seq: 1, ct: "A".repeat(107) }));
    expect(first.responder.ready).toBe(false);
    const second = await securedPair(e2ee);
    expect(second.responder.ready).toBe(true);
  });
});

describe("closing", () => {
  it("forgets the keys: nothing can be sent, read or verified afterwards", async () => {
    const { initiator, responder } = await securedPair(e2ee);
    const envelope = await initiator.seal(msg("before the end"));
    responder.close();
    expect(responder.ready).toBe(false);
    expect(responder.safetyCode).toBeNull();
    expect(await code(responder.open(envelope))).toBe("CLOSED");
    expect(await code(responder.seal(msg("after the end")))).toBe("CLOSED");
    expect(await code(responder.publicKey())).toBe("CLOSED");
    expect(await code(responder.receiveKey("A".repeat(87)))).toBe("CLOSED");
  });

  it("a key exchange that finishes after closing does not revive the channel", async () => {
    const initiator = e2ee.createChannel({ sessionId: SESSION_ID, role: "initiator" });
    const responder = e2ee.createChannel({ sessionId: SESSION_ID, role: "responder" });
    const deriving = initiator.receiveKey(await responder.publicKey());
    initiator.close();
    expect(await code(deriving)).toBe("CLOSED");
    expect(initiator.ready).toBe(false);
  });
});
