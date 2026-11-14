# Architecture Decision Records (ADRs)

An ADR records **one important decision**: context, options, choice, consequences. Accepted ADRs are never edited; a new ADR **supersedes** them.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-socketio-for-realtime.md) | Socket.IO for real-time messaging | Accepted |
| [0002](0002-sqlite-for-history.md) | SQLite for message history | ❌ Superseded by 0005 |
| [0003](0003-render-free-hosting.md) | Host on Render free tier | Accepted |
| [0004](0004-plain-js-frontend.md) | Plain HTML/CSS/JS frontend | Accepted |
| [0005](0005-no-server-side-message-storage.md) | No server-side message storage; session-only history in the browser | Accepted |
| [0006](0006-anonymous-no-accounts-no-jwt.md) | Anonymous: no accounts, no JWT, system-generated names | Accepted |
| [0007](0007-e2ee-webcrypto.md) | End-to-end encryption with WebCrypto (ECDH P-256 + HKDF + AES-GCM) | Accepted |
| [0008](0008-server-relay-not-webrtc.md) | Relay through the server, not peer-to-peer WebRTC | Accepted |
| [0009](0009-country-via-ip-lookup.md) | Country from a server-side IP lookup (DB-IP Lite) | Accepted, completed by 0013 |
| [0010](0010-deploy-early-and-continuously.md) | Deploy early (M2) and continuously; public launch at M8 | ❌ Superseded by 0012 |
| [0011](0011-websocket-only-transport.md) | WebSocket-only transport so the Origin check can be strict | Accepted |
| [0012](0012-portfolio-scope-not-launched.md) | Scope is a portfolio project: build to M7, do not launch | Accepted |
| [0013](0013-country-from-local-ip-database.md) | Country from a local IP database, optional and fail-soft | Accepted |
| [0014](0014-browser-only-demo.md) | A browser-only demo with a simulated partner | Accepted |

New ADR? Copy [`../../07-process/templates/adr-template.md`](../../07-process/templates/adr-template.md).
