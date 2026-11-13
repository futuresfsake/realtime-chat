import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

export type Plain = { t: "msg"; text: string } | { t: "react"; ref: number; emoji: string };
export interface Envelope {
  seq: number;
  ct: string;
}
export interface KeyContext {
  sessionId: string;
  direction: "i2r" | "r2i";
}
export interface SessionKeys {
  sendKey: CryptoKey;
  recvKey: CryptoKey;
  safetyCode: string;
}
export interface Channel {
  publicKey(): Promise<string>;
  receiveKey(peerPublicKey: string): Promise<string>;
  readonly ready: boolean;
  readonly safetyCode: string | null;
  seal(plain: unknown): Promise<Envelope>;
  open(envelope: unknown): Promise<Plain>;
  close(): void;
}
export interface E2ee {
  SUITE: string;
  MAX_TEXT_CHARS: number;
  MAX_FAILURES: number;
  isSupported(): boolean;
  createChannel(options: { sessionId: string; role: string; allowedReactions?: readonly string[] }): Channel;
  generateKeyPair(): Promise<{ privateKey: CryptoKey; publicKeyRaw: Uint8Array }>;
  deriveSessionKeys(
    privateKey: CryptoKey,
    peerPublicRaw: Uint8Array,
    options: { sessionId: string; role: string; myPublicRaw: Uint8Array },
  ): Promise<SessionKeys>;
  computeSafetyCode(sessionId: string, initiatorPub: Uint8Array, responderPub: Uint8Array): Promise<string>;
  encrypt(key: CryptoKey, seq: number, plain: unknown, context: KeyContext): Promise<string>;
  decrypt(key: CryptoKey, seq: number, ct: string, context: KeyContext): Promise<any>;
  pad(plain: unknown): Uint8Array;
  unpad(padded: Uint8Array): any;
  toBase64Url(bytes: Uint8Array): string;
  fromBase64Url(text: string): Uint8Array;
}

const FILE = path.join(process.cwd(), "public", "js", "crypto.js");

// Runs the browser script in isolation, the way a page would load it. Node has
// the same WebCrypto as browsers, so this is the code users run, not a copy.
// Pass `{ crypto: undefined }` to simulate a browser without WebCrypto.
export function loadE2ee(globals: Record<string, unknown> = {}): E2ee {
  const sandbox: Record<string, any> = { crypto: webcrypto, TextEncoder, TextDecoder, btoa, atob, ...globals };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(readFileSync(FILE, "utf8"), sandbox, { filename: FILE });
  return sandbox.E2EE as E2ee;
}

export const SESSION_ID = "6f1c2b0e-1111-4000-8000-000000000001";

// Two channels that have finished the key exchange with each other, as if a
// perfectly honest server had relayed their public keys.
export async function securedPair(
  e2ee: E2ee,
  options: { sessionId?: string; allowedReactions?: readonly string[] } = {},
): Promise<{ initiator: Channel; responder: Channel }> {
  const sessionId = options.sessionId ?? SESSION_ID;
  const allowedReactions = options.allowedReactions ?? ["👍", "😂"];
  const initiator = e2ee.createChannel({ sessionId, role: "initiator", allowedReactions });
  const responder = e2ee.createChannel({ sessionId, role: "responder", allowedReactions });
  const [keyI, keyR] = await Promise.all([initiator.publicKey(), responder.publicKey()]);
  await Promise.all([initiator.receiveKey(keyR), responder.receiveKey(keyI)]);
  return { initiator, responder };
}

// Flips one bit of a base64url string's decoded bytes.
export function flipBit(e2ee: E2ee, ct: string, byteIndex: number): string {
  const bytes = e2ee.fromBase64Url(ct);
  bytes[byteIndex]! ^= 0x01;
  return e2ee.toBase64Url(bytes);
}
