import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SESSION_ID, loadE2ee } from "../../helpers/e2ee.js";

const e2ee = loadE2ee();
const FORMAT = /^\d{5} \d{5} \d{5} \d{5}$/;

async function twoKeys() {
  const a = (await e2ee.generateKeyPair()).publicKeyRaw;
  const b = (await e2ee.generateKeyPair()).publicKeyRaw;
  return { a, b };
}

describe("computeSafetyCode", () => {
  it("has the format NNNNN NNNNN NNNNN NNNNN", async () => {
    const { a, b } = await twoKeys();
    expect(await e2ee.computeSafetyCode(SESSION_ID, a, b)).toMatch(FORMAT);
  });

  it("is deterministic: the same inputs give the same code", async () => {
    const { a, b } = await twoKeys();
    expect(await e2ee.computeSafetyCode(SESSION_ID, a, b)).toBe(await e2ee.computeSafetyCode(SESSION_ID, a, b));
  });

  it("matches the documented formula, computed independently", async () => {
    const { a, b } = await twoKeys();
    const hash = createHash("sha256").update(`rc/v1/safety|${SESSION_ID}`).update(a).update(b).digest();
    const expected = [0, 5, 10, 15]
      .map((offset) => String(Number(hash.readUIntBE(offset, 5) % 100000)).padStart(5, "0"))
      .join(" ");
    expect(await e2ee.computeSafetyCode(SESSION_ID, a, b)).toBe(expected);
  });

  it("keeps leading zeros, so every group is always five digits", async () => {
    // Enough samples to meet small numbers: about 1 group in 10 starts with 0.
    const { a } = await twoKeys();
    let sawLeadingZero = false;
    for (let i = 0; i < 40; i++) {
      const code = await e2ee.computeSafetyCode(`session-${i}`, a, a);
      expect(code).toMatch(FORMAT);
      if (code.split(" ").some((group) => group.startsWith("0"))) sawLeadingZero = true;
    }
    expect(sawLeadingZero).toBe(true);
  });

  it("changes with the session id", async () => {
    const { a, b } = await twoKeys();
    expect(await e2ee.computeSafetyCode(SESSION_ID, a, b)).not.toBe(await e2ee.computeSafetyCode("other", a, b));
  });

  it("changes when the two keys swap places (initiator and responder are not interchangeable)", async () => {
    const { a, b } = await twoKeys();
    expect(await e2ee.computeSafetyCode(SESSION_ID, a, b)).not.toBe(await e2ee.computeSafetyCode(SESSION_ID, b, a));
  });
});

describe("safety codes across a key exchange", () => {
  it("both sides compute the same code when the keys were relayed honestly", async () => {
    const initiator = e2ee.createChannel({ sessionId: SESSION_ID, role: "initiator" });
    const responder = e2ee.createChannel({ sessionId: SESSION_ID, role: "responder" });
    const codeI = await initiator.receiveKey(await responder.publicKey());
    const codeR = await responder.receiveKey(await initiator.publicKey());
    expect(codeI).toMatch(FORMAT);
    expect(codeI).toBe(codeR);
    expect(initiator.safetyCode).toBe(codeI);
  });

  it("the codes differ when someone in the middle swapped the keys", async () => {
    const alice = e2ee.createChannel({ sessionId: SESSION_ID, role: "initiator" });
    const bob = e2ee.createChannel({ sessionId: SESSION_ID, role: "responder" });
    // Mallory (a dishonest relay) keeps Alice's and Bob's keys and hands each
    // of them one of her own instead.
    const malloryToAlice = e2ee.createChannel({ sessionId: SESSION_ID, role: "responder" });
    const malloryToBob = e2ee.createChannel({ sessionId: SESSION_ID, role: "initiator" });
    await malloryToAlice.receiveKey(await alice.publicKey());
    await malloryToBob.receiveKey(await bob.publicKey());
    const aliceCode = await alice.receiveKey(await malloryToAlice.publicKey());
    const bobCode = await bob.receiveKey(await malloryToBob.publicKey());

    // The attack works technically: Mallory can read what Alice sends...
    const intercepted = await malloryToAlice.open(await alice.seal({ t: "msg", text: "secret" }));
    expect(intercepted).toEqual({ t: "msg", text: "secret" });
    // ...but Alice and Bob see different codes, which is how they find out.
    expect(aliceCode).not.toBe(bobCode);
  });
});
