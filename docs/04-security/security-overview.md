# Security overview: what is implemented today

> **Read this first** if you want to know how the running system is protected. It describes only what is **built and tested** (as of M6, content filter merged), and points at the evidence for each claim. Plans are not listed here; they are in [known limits and roadmap](../00-overview/limits-and-roadmap.md). The threat-by-threat view is [threat-model.md](threat-model.md); the launch gate is [security-checklist.md](security-checklist.md).

**Status: a portfolio project. It has not been deployed, penetration tested, or reviewed by an outside security expert or by counsel.** Everything below is the author's own work, verified by the project's own tests and CI.

## The design in one paragraph
The server is a **blind relay**. It pairs two strangers, hands them each other's *public* key, and forwards ciphertext. It has no accounts, no database and no message storage. People are told apart only by a **keyed hash of their IP address that changes every day**. The browser, not the server, encrypts and decrypts, and also filters content, because the server cannot read anything.

## Controls by layer

### 1. Delivery and transport
| Control | How | Evidence |
|---|---|---|
| Strict Content Security Policy | `default-src 'self'`; **no inline script, no `eval`**; fonts, images and styles from our own origin only; `frame-ancestors 'none'`; CSP violation reports logged (directive and origin only) | `src/http/securityHeaders.ts`, `server.test.ts` (headers; page has no inline script) |
| Other headers | `X-Frame-Options: deny`, `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy`, HSTS (two years) in production | `server.test.ts` |
| WebSocket only | No long-polling fallback, so the `Origin` header is always checked ([ADR-0011](../03-design/adr/0011-websocket-only-transport.md)) | `app.ts`, `server.test.ts` |
| Origin allowlist | A socket from any other origin is refused; production origins must be `https://` or the server will not start | `config.ts`, `config.test.ts`, `server.test.ts` |
| Self-hosted everything | No third-party script, font or CDN, so nothing outside our control runs in the page | CSP; `public/fonts/` |
| TLS | Provided by the host (Render) when deployed. **Not yet deployed** | n/a |

### 2. Connecting without accounts
| Control | How | Evidence |
|---|---|---|
| Connection token | `/connect-token` issues an HMAC-SHA-256 signed token that is **single use**, expires in 30 seconds, and is bound to the requester's IP hash. The signing key lives in memory and rotates daily. It carries no identity | `connectToken.ts`, `server.test.ts` (missing, garbage, reused, expired) |
| Browser-origin check on the token endpoint | Another website calling `/connect-token` is refused (`Sec-Fetch-Site`) | `server.test.ts` |
| Protocol version | `rc/v1` is checked on every connection; a mismatch is refused | `server.test.ts` |
| 18+ and rules acknowledgement | Enforced by the **server** on the handshake (an outdated notice version is refused), not only by the page | `server.test.ts`, Playwright gate test |
| Handshake and connection limits | 5 new connections per address per 10 s; 5 open sockets per address; 500 in total | `server.test.ts`, `recovery.test.ts` |
| Proof of work before a token | A small SHA-256 puzzle (default 12 bits) must be solved to get a connection token. The challenge is signed, single use, expires in a minute and is bound to the address; challenges are limited to a burst of 5 then one per 10 s. It slows scripts down; it is not a lock | `proofOfWork.test.ts`, `pow.test.ts`, the proof-of-work integration tests, Playwright |

### 3. Validating everything that arrives
- **Every** client-to-server event has a strict `zod` schema: wrong types, missing fields and **unknown fields are all rejected**, and one bad event can never crash the process (`withHandler`). Clients only ever receive an error *code*, never a stack trace.
- Payloads are capped at **4 KB** at the transport; a bigger one drops the sender.
- Evidence: `schemas.ts`, `handler.test.ts`, `schemas.test.ts`, `server.test.ts`, `e2ee.test.ts`, `matchmaking.test.ts`, `report.test.ts`.

### 4. End-to-end encryption ([protocol](e2ee.md))
| Property | How | Evidence |
|---|---|---|
| Server cannot read messages | ECDH P-256 key exchange, HKDF-SHA-256, AES-GCM-256, all native WebCrypto, **no hand-made crypto**, private keys non-extractable | `crypto.test.ts`, `channel.test.ts` |
| No plaintext path | The unencrypted message events were removed; the server refuses envelopes until **both** public keys have crossed | `e2ee.test.ts` (including a test that the old events are gone) |
| No wrong-direction or reused IV | A separate key per direction, counter IVs | `crypto.test.ts` |
| Tampering, replay, reordering, splicing | AES-GCM authentication; strictly increasing sequence numbers; the chat id, direction and number are authenticated; three failures end the chat | `channel.test.ts` |
| Invalid or reflected keys | Off-curve, wrong-length, compressed and own-key sent back are all refused | `crypto.test.ts` |
| Length hiding | Messages padded to 64-byte blocks | `crypto.test.ts` |
| Man-in-the-middle detection | A safety code from both public keys; if keys are swapped the two codes differ (tested with a simulated attacker) | `safetyCode.test.ts`, Playwright |
| Key exchange timeout | A chat that is not secured in 10 s is ended | `e2ee.test.ts` |
| Nothing readable on the wire | A browser test inspects **every** WebSocket frame of a real chat for the words that were typed | Playwright: "no word of the chat is ever on the wire" |
| Browser cannot encrypt, no chat | Without WebCrypto (or without HTTPS) chatting is switched off; there is **no fallback** | `crypto.test.ts`, client |

### 5. Privacy by design ([data inventory](../09-compliance/data-inventory-and-retention.md))
- **No raw IP anywhere except one file.** `src/security/clientIp.ts` hands the address straight to the hasher. A **CI check fails the build** if a raw address is read anywhere else. The hash is HMAC-SHA-256 with a key that changes every 24 hours, so yesterday's hashes cannot be linked to today's.
- **Logs never hold content.** Structured JSON, no message text, no ciphertext, no public keys, no addresses, no countries, no interests; only counts and short (8 character) hash prefixes. Tested by feeding secrets through a real chat and searching the logs (`server.test.ts`, `matchmaking.test.ts`, `report.test.ts`, `noRematch.test.ts`).
- **Memory only.** Chats, queues, no-rematch pairs, reports and blocks are in memory, bounded in size, and gone on restart. Nothing is written to disk. The page keeps history only in browser memory and wipes it when the chat ends.
- **Country** is looked up once from the address, then the address is dropped; only a two-letter code is kept, only while connected.
- **No cookies, accounts, analytics or ads.** Browser storage holds only the gate acknowledgement, for the session.

### 6. Abuse controls ([trust and safety](trust-and-safety.md))
| Control | Rule | Evidence |
|---|---|---|
| Rate limits | Messages and reactions 5 burst then 0.5/s; typing 10 burst then 2/s; keys 10 burst then 10/min; start/next 10/min per address; reports 3/hour per address | `tokenBucket.test.ts`, integration tests |
| No rematch | Two people who part by skip or leave are not paired again for 24 h. Different addresses: by hash (survives reconnects). Same address: per connection only, so a shared network is not affected | `noRematch.test.ts` (unit and integration) |
| Reports | Seven categories, a category and nothing else (no text, no transcript), anonymous to the reported person | `report.test.ts` |
| Temporary blocks | Three **different** reporting addresses within an hour block a connection from matching for 24 h. One address counts once; reports about yourself or your own address do not count | `reports.test.ts`, `report.test.ts` |
| Priority flag | `minor` and `threats` reports raise a warning log line | `report.test.ts` |
| Content filter | In the browser, on send and on arrival: banned content is not sent and is hidden when it arrives; phone numbers, emails, social accounts and spam need a second Send; links are plain text | `contentFilter.test.ts`, Playwright |
| Message rendering | Everything is shown with `textContent`; no `innerHTML` in the page | `history.test.ts` (source check), Playwright HTML test |

### 7. How the code is protected (process)
- **CI on every pull request:** typecheck, unit and integration tests, build, `npm audit`, a secrets scan (gitleaks, plus GitGuardian), static analysis (semgrep), and two privacy greps (raw IP access, console logging).
- **Dependencies:** Dependabot with a 7-day cooldown so a new release ages before it is proposed; GitHub Actions pinned to commit hashes; few runtime dependencies (`express`, `socket.io`, `zod`, `helmet`, `maxmind`).
- **Ownership and disclosure:** `CODEOWNERS` on security-critical paths; `SECURITY.md` with a disclosure policy.
- **Tests as a safety net:** several hundred unit and integration tests plus browser tests that drive two real browsers through a real server.
- **Before every commit or push:** a dependency audit and a secrets scan are run and reported.

## What this does not protect against
This list is short here on purpose; the full register, with reasons and plans, is [known limits and roadmap](../00-overview/limits-and-roadmap.md). The ones to keep in mind:

1. **Malicious code delivered by the server.** In any web app the server ships the code that encrypts. A compromised or dishonest operator could ship code that leaks keys (T-09). Open source, a strict CSP and reviewed deploys reduce the chance; they do not remove it.
2. **The other person.** They can screenshot, save or share anything you send.
3. **Metadata.** The server sees that two connections were paired, when, roughly how much was sent, and the "is typing" signal (not encrypted).
4. **Unreviewed.** The encryption design and the code have not been checked by an outside expert, and nothing has been penetration tested.
5. **Evasion.** Blocks and no-rematch are tied to a network address, so a VPN or a new network gets around them, and a shared network can be affected by one block.
6. **Not moderated.** No human reads reports, and the filter can be bypassed by a determined person.

## How to verify any claim here yourself
```
npm test              # unit and integration tests (several hundred)
npm run test:e2e      # two real browsers through a real server
npm audit --omit=dev  # dependency advisories
gitleaks detect       # secrets in the whole git history
```
The CI workflow is [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). To report a vulnerability see [`SECURITY.md`](../../SECURITY.md).
