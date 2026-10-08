# Glossary

| Term | Meaning |
|---|---|
| **ADR** | Architecture Decision Record: a short doc capturing one decision, its options and consequences |
| **AAD** | Additional Authenticated Data: data that AES-GCM authenticates (tamper-proofs) but doesn't encrypt, e.g. session id + sequence number |
| **AES-GCM** | Advanced Encryption Standard in Galois/Counter Mode: a fast symmetric cipher that both encrypts and detects tampering |
| **Anonymous** | No accounts, no names chosen by users, no stored identifiers that point to a person |
| **CD** | Continuous Delivery/Deployment: every change that passes CI is automatically deployed |
| **CI** | Continuous Integration: every push/PR is automatically built and tested |
| **Ciphertext** | Encrypted data; unreadable without the key. Opposite: *plaintext* |
| **Cold start** | The delay while a sleeping free-tier server wakes up (~1 min on Render free) |
| **CSP** | Content Security Policy: a response header telling the browser which scripts and styles may run |
| **CSWSH** | Cross-Site WebSocket Hijacking: another website opening a socket to our server using the visitor's browser |
| **DoD** | Definition of Done: checklist that must be true before work counts as finished |
| **DoS** | Denial of Service: making a service unavailable by overloading it |
| **E2EE** | End-to-end encryption: only the two chat participants can read messages; the server only relays ciphertext |
| **ECDH** | Elliptic-Curve Diffie-Hellman: two parties derive the same shared secret over a public channel |
| **Ephemeral key** | A key that exists only for one session and is then discarded |
| **Forward secrecy** | Leaking a key later can't decrypt past conversations, because those keys were already destroyed |
| **FR / NFR** | Functional requirement (what it does) / Non-functional requirement (how well: speed, security, cost) |
| **Health check** | An endpoint (`/health`) that monitoring tools call to ask "are you alive?" |
| **HKDF** | HMAC-based Key Derivation Function: turns a shared secret into one or more strong keys |
| **HLD / LLD** | High-Level Design (boxes and arrows) / Low-Level Design (modules, types, algorithms) |
| **Horizontal scaling** | Handling more load by adding more server instances (vs. *vertical*: a bigger server) |
| **IV / nonce** | Initialization vector: a value that must never repeat with the same key in AES-GCM |
| **JWT** | JSON Web Token: a signed token carrying identity claims. **We don't use it** (see `04-security/privacy-and-sessions.md`) |
| **Matchmaking** | Pairing two waiting users based on interests and country preference |
| **MITM** | Man-in-the-middle: an attacker who sits between two parties and can read or alter traffic |
| **PaaS** | Platform as a Service: you push code; the platform builds, runs, scales and secures it (e.g. Render) |
| **Rate limiting** | Restricting how often a client can perform an action |
| **Safety code** | A short code derived from both users' public keys; if both see the same code, no MITM swapped the keys |
| **Session** | One 1:1 conversation between two strangers, from match to end. Nothing about it survives after it ends |
| **Socket.IO** | A library for real-time, two-way communication over WebSockets with reconnection and rooms |
| **STRIDE** | Threat categories: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege |
| **Sticky session** | A load balancer always sending one client to the same server instance |
| **Token bucket** | A rate-limiting algorithm that allows short bursts but caps the long-term rate |
| **TLS / HTTPS / WSS** | Transport encryption between browser and server (HTTPS for pages, WSS for WebSockets) |
| **Trust & Safety** | Practices that protect users from abuse, harassment and harmful content |
| **WebCrypto** | The browser's built-in, audited cryptography API (`crypto.subtle`) |
| **zod** | A TypeScript library that validates data at runtime and infers TypeScript types from the same schema |
