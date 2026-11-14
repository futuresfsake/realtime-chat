# The browser-only demo

A version of the real page that runs entirely in the browser, with a **simulated partner**. It exists so the project can be shown without hosting a chat service and without any stranger ever meeting another ([ADR-0014](../03-design/adr/0014-browser-only-demo.md)).

## What it is, honestly
| | |
|---|---|
| **Real** | The interface (the same `index.html`, `client.js` and styles), the key exchange (ECDH P-256 and HKDF), AES-GCM encryption of every message, replay and tamper checks, the safety code, the content filter, reactions, reporting, Next and End chat |
| **Simulated** | The server and the other person. The partner is a short script (`demo/demo-server.js`) with its own real keys. It decrypts what you send, but it **does not read or understand it**: it answers from a script |
| **Not shown** | Finding strangers, the real server, rate limiting across people, reports reaching anyone, blocks, the country database, the bot puzzle, metrics. Those are in the real app and its tests |
| **What leaves your browser** | Nothing. There is no server and no network request (a browser test checks it) |

The encryption is real, but both ends are in your browser, so the demo shows **how it works**, not what a server can or cannot read. That claim belongs to the real app and its tests. The page says all of this at its gate, in a banner, in the footer, and the partner says it first.

## Run it
```
npm run demo        # builds demo-dist/ and serves it at http://localhost:3200
npm run build:demo  # only builds demo-dist/
```
Open it, tick the two boxes, choose **Find a stranger**, and write something. The partner "types", answers, and reacts. Open **Safety code** to see the code both sides derived.

## How it is built (and why it cannot drift)
`scripts/build-demo.ts` generates `demo-dist/` **from the real `public/` files**. It copies `client.js` and the crypto, filter and session scripts byte for byte (a test checks they are identical), and makes only three substitutions in `index.html`: the gate text, the banner and footer, and the Socket.IO client script, which is replaced by `demo/demo-server.js`. Each substitution **fails the build** if the real page no longer contains what it expects, so a change to the real page cannot silently produce a broken or misleading demo.

`demo/demo-server.js` replaces `io()` with a small object that speaks the same events, and plays the server and the partner. It answers the two token requests the page makes, and refuses any other request instead of sending it anywhere.

## Publish it (owner steps)
The demo is a static folder, so any static host works. For GitHub Pages:
1. Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**. Only the repository owner can change this.
2. **Actions → Publish demo → Run workflow.** The address will be `https://<owner>.github.io/<repo>/`.
3. Add that link to the README.

The workflow is manual on purpose: until step 1 is done it would fail on every push to `main`.

## Changing it
- To change what the partner says, edit `SCRIPT` in `demo/demo-server.js`. Keep it honest about being a script.
- If the real page changes and `npm run build:demo` fails with "the real page changed", update the marked substitution in `scripts/build-demo.ts`.
- Tests: `tests/unit/checks/demo-build.test.ts` (the build) and `e2e/demo.spec.ts` (the demo in a real browser: the flow, matching safety codes, no network, accessibility).
