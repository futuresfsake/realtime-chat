// Proof of work (US-39): the small puzzle the server sets before it issues a
// connection token. Find a number `nonce` so that SHA-256(challenge + ":" +
// nonce) starts with `bits` zero bits. A browser does it in a fraction of a
// second; a script opening thousands of connections pays for every one.
//
// It uses the browser's own SHA-256 (WebCrypto), many guesses at a time.
// A plain script (no modules): it exposes one global, ProofOfWork.
(function () {
  "use strict";

  const BATCH = 256; // guesses hashed at once
  const MAX_ATTEMPTS = 50_000_000; // gives up long after any sane difficulty

  function leadingZeroBits(bytes) {
    let bits = 0;
    for (const byte of bytes) {
      if (byte === 0) {
        bits += 8;
        continue;
      }
      bits += Math.clz32(byte) - 24;
      break;
    }
    return bits;
  }

  async function hashOf(text) {
    return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  }

  // Resolves with the winning nonce as a string of digits.
  async function solve(challenge, bits) {
    if (!(bits > 0)) return "0";
    for (let start = 0; start < MAX_ATTEMPTS; start += BATCH) {
      const nonces = Array.from({ length: BATCH }, (_, i) => start + i);
      const hashes = await Promise.all(nonces.map((n) => hashOf(`${challenge}:${n}`)));
      for (let i = 0; i < hashes.length; i++) {
        if (leadingZeroBits(hashes[i]) >= bits) return String(nonces[i]);
      }
    }
    throw new Error("POW_GAVE_UP");
  }

  globalThis.ProofOfWork = { solve, leadingZeroBits };
})();
