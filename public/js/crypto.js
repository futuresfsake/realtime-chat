// End-to-end encryption for one chat. Only the two browsers ever hold the
// keys: the server relays public keys and ciphertext and can read neither.
// Protocol and reasoning: docs/04-security/e2ee.md.
//
// Rule: no cryptographic primitive is implemented here. Everything is
// WebCrypto (crypto.subtle); this file only combines the standard pieces.
//
// A plain script (no modules), so it loads under the strict CSP and the tests
// can run it in isolation. It exposes one global: E2EE.
(function () {
  "use strict";

  // Label of this encryption scheme. It is mixed into every key, every
  // message and the safety code, so data made for another scheme never fits.
  const SUITE = "rc/v1";
  const CURVE = { name: "ECDH", namedCurve: "P-256" };
  const PUBLIC_KEY_BYTES = 65; // uncompressed P-256 point: 0x04, x, y
  const PAD_BLOCK = 64; // messages are padded to a multiple of this, to hide their exact length
  const MAX_TEXT_CHARS = 500;
  // Largest padded message whose envelope still fits the server's 3,000
  // character limit: (2176 + 16-byte tag) * 4/3 = 2,923 characters.
  const MAX_PLAIN_BYTES = 2176;
  const MAX_SEQ = 0xffffffff;
  const MAX_FAILURES = 3; // after this many unreadable envelopes the chat must end

  const subtle = globalThis.crypto && globalThis.crypto.subtle;

  // Every failure carries a short code and nothing else: never key material,
  // never message content.
  class E2eeError extends Error {
    constructor(code) {
      super(code);
      this.name = "E2eeError";
      this.code = code;
      this.fatal = false; // true once the channel has failed too often to trust
    }
  }

  // False in old browsers and on pages not served over HTTPS (or localhost),
  // where the browser hides crypto.subtle. There is no fallback: no
  // encryption means no chat.
  function isSupported() {
    return (
      !!subtle &&
      typeof subtle.generateKey === "function" &&
      typeof subtle.deriveBits === "function" &&
      typeof TextEncoder === "function" &&
      typeof TextDecoder === "function"
    );
  }

  function requireSupport() {
    if (!isSupported()) throw new E2eeError("UNSUPPORTED");
  }

  // ---------- Bytes ----------
  const utf8 = (text) => new TextEncoder().encode(text);

  function concat(...parts) {
    const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }

  function sameBytes(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }

  async function sha256(bytes) {
    return new Uint8Array(await subtle.digest("SHA-256", bytes));
  }

  function toBase64Url(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function fromBase64Url(text) {
    if (typeof text !== "string" || !/^[A-Za-z0-9_-]+$/.test(text) || text.length % 4 === 1) {
      throw new E2eeError("BAD_ENCODING");
    }
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  // ---------- Padding ----------
  // JSON, then zero bytes up to the next multiple of 64. JSON never ends in a
  // zero byte, so the padding can always be removed without ambiguity.
  function pad(plain) {
    const bytes = utf8(JSON.stringify(plain));
    const size = Math.max(PAD_BLOCK, Math.ceil(bytes.length / PAD_BLOCK) * PAD_BLOCK);
    if (size > MAX_PLAIN_BYTES) throw new E2eeError("TOO_LONG");
    const padded = new Uint8Array(size);
    padded.set(bytes);
    return padded;
  }

  function unpad(padded) {
    let end = padded.length;
    while (end > 0 && padded[end - 1] === 0) end--;
    try {
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(padded.subarray(0, end)));
    } catch {
      throw new E2eeError("BAD_PLAINTEXT");
    }
  }

  // ---------- Keys ----------
  // A fresh pair for every chat. The private key is not extractable: this
  // page can use it but can never read its bytes, and it is never saved.
  async function generateKeyPair() {
    requireSupport();
    const pair = await subtle.generateKey(CURVE, false, ["deriveBits"]);
    const publicKeyRaw = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
    return { privateKey: pair.privateKey, publicKeyRaw };
  }

  // The code both people can compare to check that nobody swapped the keys
  // on the way. Four groups of five digits, e.g. "48213 99307 17742 03621".
  async function computeSafetyCode(sessionId, initiatorPub, responderPub) {
    requireSupport();
    const hash = await sha256(concat(utf8(`${SUITE}/safety|${sessionId}`), initiatorPub, responderPub));
    const groups = [];
    for (let g = 0; g < 4; g++) {
      let n = 0; // five bytes = 40 bits: fits a JavaScript number exactly
      for (let i = 0; i < 5; i++) n = n * 256 + hash[g * 5 + i];
      groups.push(String(n % 100000).padStart(5, "0"));
    }
    return groups.join(" ");
  }

  // Shared secret -> two message keys, one per direction. With a single key
  // both sides would encrypt their message number 1 with the same IV, which
  // breaks AES-GCM completely. Each key can only be used the right way round:
  // the sending key cannot decrypt and the receiving key cannot encrypt.
  async function deriveSessionKeys(privateKey, peerPublicRaw, { sessionId, role, myPublicRaw }) {
    requireSupport();
    if (role !== "initiator" && role !== "responder") throw new E2eeError("BAD_ROLE");
    if (typeof sessionId !== "string" || sessionId === "") throw new E2eeError("BAD_SESSION");
    if (!ArrayBuffer.isView(peerPublicRaw) || peerPublicRaw.length !== PUBLIC_KEY_BYTES || peerPublicRaw[0] !== 4) {
      throw new E2eeError("BAD_PEER_KEY");
    }
    // Our own key sent back to us: someone is reflecting the exchange.
    if (sameBytes(peerPublicRaw, myPublicRaw)) throw new E2eeError("REFLECTED_KEY");

    let peer;
    try {
      // Rejects anything that is not a point on the curve (invalid-curve attacks).
      peer = await subtle.importKey("raw", peerPublicRaw, CURVE, false, []);
    } catch {
      throw new E2eeError("BAD_PEER_KEY");
    }

    const shared = await subtle.deriveBits({ name: "ECDH", public: peer }, privateKey, 256);
    const secret = await subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);

    const initiatorPub = role === "initiator" ? myPublicRaw : peerPublicRaw;
    const responderPub = role === "initiator" ? peerPublicRaw : myPublicRaw;
    const salt = await sha256(utf8(`${SUITE}/salt|${sessionId}`));
    // Binds the keys to exactly this exchange of public keys.
    const transcript = await sha256(concat(initiatorPub, responderPub));
    const derive = (label, usage) =>
      subtle.deriveKey(
        { name: "HKDF", hash: "SHA-256", salt, info: concat(utf8(`${SUITE} ${label}|`), transcript) },
        secret,
        { name: "AES-GCM", length: 256 },
        false,
        [usage],
      );

    const sending = role === "initiator" ? "i2r" : "r2i";
    const receiving = role === "initiator" ? "r2i" : "i2r";
    const [sendKey, recvKey, safetyCode] = await Promise.all([
      derive(sending, "encrypt"),
      derive(receiving, "decrypt"),
      computeSafetyCode(sessionId, initiatorPub, responderPub),
    ]);
    return { sendKey, recvKey, safetyCode };
  }

  // ---------- Messages ----------
  function checkSeq(seq) {
    if (!Number.isSafeInteger(seq) || seq < 1 || seq > MAX_SEQ) throw new E2eeError("BAD_SEQ");
  }

  // 12 bytes: four zero bytes, then the message number as 8 bytes, big-endian.
  // A number is used once per key, so an IV never repeats.
  function ivFor(seq) {
    const iv = new Uint8Array(12);
    new DataView(iv.buffer).setUint32(8, seq);
    return iv;
  }

  // Not secret, but authenticated: a ciphertext moved to another chat,
  // direction or position no longer decrypts.
  function aadFor({ sessionId, direction }, seq) {
    return utf8(`${SUITE}|${sessionId}|${direction}|${seq}`);
  }

  async function encryptBytes(key, seq, padded, context) {
    const ct = await subtle.encrypt(
      { name: "AES-GCM", iv: ivFor(seq), additionalData: aadFor(context, seq), tagLength: 128 },
      key,
      padded,
    );
    return toBase64Url(new Uint8Array(ct));
  }

  // context: { sessionId, direction }, direction "i2r" or "r2i".
  async function encrypt(sendKey, seq, plain, context) {
    requireSupport();
    checkSeq(seq);
    return encryptBytes(sendKey, seq, pad(plain), context);
  }

  // Throws if the ciphertext, its number, its direction or its chat is not
  // exactly what the sender encrypted.
  async function decrypt(recvKey, seq, ct, context) {
    requireSupport();
    checkSeq(seq);
    const bytes = fromBase64Url(ct);
    let padded;
    try {
      padded = await subtle.decrypt(
        { name: "AES-GCM", iv: ivFor(seq), additionalData: aadFor(context, seq), tagLength: 128 },
        recvKey,
        bytes,
      );
    } catch {
      throw new E2eeError("AUTH_FAILED");
    }
    return unpad(new Uint8Array(padded));
  }

  // What may be inside an envelope. Checked on the way out and, because the
  // other side is a stranger, again on the way in.
  function checkPlain(plain, allowedReactions) {
    const isObject = typeof plain === "object" && plain !== null && !Array.isArray(plain);
    if (!isObject) throw new E2eeError("BAD_MESSAGE");
    const keys = Object.keys(plain).sort().join(",");
    if (plain.t === "msg" && keys === "t,text") {
      if (typeof plain.text !== "string" || plain.text.trim() === "") throw new E2eeError("BAD_MESSAGE");
      if (plain.text.length > MAX_TEXT_CHARS) throw new E2eeError("TOO_LONG");
      return;
    }
    if (plain.t === "react" && keys === "emoji,ref,t") {
      const refOk = Number.isSafeInteger(plain.ref) && plain.ref >= 1 && plain.ref <= MAX_SEQ;
      if (!refOk || !allowedReactions.includes(plain.emoji)) throw new E2eeError("BAD_MESSAGE");
      return;
    }
    throw new E2eeError("BAD_MESSAGE");
  }

  // ---------- One chat's secure channel ----------
  // Holds everything secret about one chat: the key pair, the two message
  // keys and the counters. Create one when matched, close() it when the chat
  // ends. Nothing in it is ever stored or sent anywhere.
  function createChannel({ sessionId, role, allowedReactions = [] }) {
    requireSupport();
    if (role !== "initiator" && role !== "responder") throw new E2eeError("BAD_ROLE");
    if (typeof sessionId !== "string" || sessionId === "") throw new E2eeError("BAD_SESSION");
    const sendContext = { sessionId, direction: role === "initiator" ? "i2r" : "r2i" };
    const recvContext = { sessionId, direction: role === "initiator" ? "r2i" : "i2r" };

    let pair = generateKeyPair(); // starts right away; awaited where it is needed
    pair.catch(() => {}); // a failure is reported by publicKey() / receiveKey()
    let derivation = null; // set when the partner's key arrives (once)
    let keys = null; // { sendKey, recvKey, safetyCode } once both keys are in
    let closed = false;
    let sendSeq = 0;
    let lastRecvSeq = 0;
    let failures = 0;
    // Work is done one at a time and in order: envelopes must leave in the
    // order of their numbers and be checked in the order they arrive.
    let sendQueue = Promise.resolve();
    let recvQueue = Promise.resolve();

    async function openNow(envelope) {
      if (closed) throw new E2eeError("CLOSED");
      if (failures >= MAX_FAILURES) {
        const broken = new E2eeError("BROKEN");
        broken.fatal = true;
        throw broken;
      }
      try {
        if (!keys) throw new E2eeError("NOT_READY");
        const { seq, ct } = envelope || {};
        checkSeq(seq);
        // A number at or below the last accepted one is a replay or a reorder.
        if (seq <= lastRecvSeq) throw new E2eeError("REPLAY");
        const plain = await decrypt(keys.recvKey, seq, ct, recvContext);
        if (closed) throw new E2eeError("CLOSED");
        lastRecvSeq = seq; // only a genuine envelope moves the counter
        checkPlain(plain, allowedReactions);
        return plain;
      } catch (err) {
        if (err instanceof E2eeError && err.code === "CLOSED") throw err;
        failures++;
        const failure = err instanceof E2eeError ? err : new E2eeError("AUTH_FAILED");
        failure.fatal = failures >= MAX_FAILURES;
        throw failure;
      }
    }

    return {
      // My public key, ready to send to the partner (87 base64url characters).
      async publicKey() {
        const mine = await pair;
        return toBase64Url(mine.publicKeyRaw);
      },

      // The partner's public key arrived. Checks it and derives the message
      // keys. Accepted once: a second key for the same chat is refused.
      // Resolves with the safety code.
      receiveKey(peerPublicKey) {
        if (closed) return Promise.reject(new E2eeError("CLOSED"));
        if (derivation) return Promise.reject(new E2eeError("KEY_ALREADY_SET"));
        derivation = (async () => {
          const peerRaw = fromBase64Url(peerPublicKey);
          const mine = await pair;
          const derived = await deriveSessionKeys(mine.privateKey, peerRaw, {
            sessionId,
            role,
            myPublicRaw: mine.publicKeyRaw,
          });
          if (closed) throw new E2eeError("CLOSED");
          keys = derived;
          return derived.safetyCode;
        })();
        derivation.catch(() => {}); // open() waits on it too; the caller handles the error
        return derivation;
      },

      // True once messages can be sent and read.
      get ready() {
        return keys !== null && !closed && failures < MAX_FAILURES;
      },

      get safetyCode() {
        return keys && !closed ? keys.safetyCode : null;
      },

      // plain: { t: "msg", text } or { t: "react", ref, emoji }.
      // Resolves with the envelope { seq, ct } to hand to the server.
      async seal(plain) {
        if (closed) throw new E2eeError("CLOSED");
        if (!keys || failures >= MAX_FAILURES) throw new E2eeError("NOT_READY");
        checkPlain(plain, allowedReactions);
        const padded = pad(plain);
        if (sendSeq >= MAX_SEQ) throw new E2eeError("EXHAUSTED");
        // Taken before anything waits, so a number is never used twice, even
        // if this envelope is later refused or lost.
        const seq = ++sendSeq;
        const sendKey = keys.sendKey;
        const sealed = sendQueue.then(async () => ({ seq, ct: await encryptBytes(sendKey, seq, padded, sendContext) }));
        sendQueue = sealed.catch(() => {});
        return sealed;
      },

      // envelope: { seq, ct } as relayed by the server. Resolves with the
      // message, or rejects with an E2eeError. err.fatal means the chat must end.
      open(envelope) {
        const opened = recvQueue.then(async () => {
          if (derivation) await derivation.catch(() => {}); // keys may still be on their way
          return openNow(envelope);
        });
        recvQueue = opened.catch(() => {});
        return opened;
      },

      // The chat is over: forget the keys. (They were never extractable, and
      // JavaScript cannot wipe memory, but nothing refers to them any more.)
      close() {
        closed = true;
        keys = null;
        pair = Promise.reject(new E2eeError("CLOSED"));
        pair.catch(() => {});
      },
    };
  }

  globalThis.E2EE = {
    SUITE,
    MAX_TEXT_CHARS,
    MAX_FAILURES,
    E2eeError,
    isSupported,
    createChannel,
    // The building blocks, exposed so they can be tested one by one.
    generateKeyPair,
    deriveSessionKeys,
    computeSafetyCode,
    encrypt,
    decrypt,
    pad,
    unpad,
    toBase64Url,
    fromBase64Url,
  };
})();
