# ADR-0014: A browser-only demo with a simulated partner

- **Status:** Accepted · **Date:** 2026-11-14 · **Follows:** [ADR-0012](0012-portfolio-scope-not-launched.md) (the project is not launched, so there is no live chat to link to)

## Context
A chat needs two people, and the project is deliberately not hosted as a public service (ADR-0012). A reviewer who only sees a recording cannot try it. A live link that pairs real strangers is the thing that was ruled out; and a link that opens to "Searching…" on its own shows nothing.

## Options
| Option | For | Against |
|---|---|---|
| **A. A browser-only simulation:** the real page, with a fake server and a scripted partner inside the page | Free, static hosting, no strangers, no moderation, nothing to operate | Shows the interface and the real in-browser cryptography, not the real server |
| B. A demo mode on a hosted server with a bot as a real client | Exercises the real server, pairing and limits | Needs hosting; the operator runs both ends, so "the server cannot read your chat" stops being a clean claim |
| C. A bot inside the server process | Simplest to host | The server would hold a private key and see plaintext, breaking the project's central promise |
| D. Keep the recording only | Nothing to build | Not clickable |

## Decision
**Option A.** The demo is generated from the real `public/` files so it cannot drift: `client.js` and the crypto, filter and session scripts are copied byte for byte, and three marked substitutions (gate text, banner and footer, and the Socket.IO client) **fail the build** if the real page changes. A small fake socket plays the server and a partner that answers from a script.

**Honesty rules**, enforced by tests:
1. The gate, banner, footer and title all say it is a simulation, and the partner is named `demo-partner` and says it is a script before anything else.
2. The partner does not read or interpret what the visitor writes.
3. The demo makes no network request and opens no WebSocket, and stores nothing except the gate acknowledgement.
4. The text never makes the real app's privacy claims about a server, because there is none.

## Consequences
- ✅ A link that works for one person, costs nothing, and exposes nobody
- ✅ Real key exchange, real AES-GCM, real safety code (a test checks both sides derive the same one)
- ⚠️ It demonstrates the interface and the cryptography, **not** the server, matching, relay, limits, reports or blocks (limits L-38). The real app's tests cover those
- ⚠️ Both ends of the encryption are in one browser, so it shows how it works, not what a server can read
- 🔁 If a hosted demo is ever wanted, option B is the next step, and it needs a new ADR that states plainly that the operator runs the partner
- Publishing is a manual workflow because enabling GitHub Pages is an owner-only setting ([demo guide](../../08-guides/demo.md))
