# Vision

## Mission
**Connect people across the world through safe, private, anonymous one-to-one conversations, on a platform that is free to use, runs reliably, and protects its users.**

## The product in one paragraph
You open the site, confirm you're 18+ and accept the rules, then optionally pick a few **interests** and choose **"my country"** or **"worldwide"**. The system gives you a **random name** (e.g. `quiet-otter-42`) and matches you with **one stranger** who shares an interest. If nobody does, you're matched with a random stranger. The conversation is **end-to-end encrypted**: the server only passes along scrambled data it can't read. Messages exist **only on the two participants' screens during the session**; when the chat ends, they're gone forever. Type `/next` to meet someone new.

## Users
| User | Needs |
|---|---|
| **Chatter** (anyone 18+, anywhere) | Meet someone new quickly; feel safe; stay anonymous; leave anytime |
| **Operator** (us) | Keep it running for $0; stop abuse; never be able to read or identify users |

## Goals
| Pillar | What it means | Measured by |
|---|---|---|
| **Anonymous** | No accounts, no user-chosen names, no stored identifiers. Anonymous **even to us** | Privacy data inventory has no persistent personal data |
| **Private** | E2EE for all message content; nothing stored server-side | Server code never handles plaintext; ciphertext never persisted or logged |
| **Safe** | Users can skip, report and avoid harassers; abuse is rate-limited; adults only | Trust & safety controls ✅; abuse metrics |
| **Secure** | Resists common web attacks (XSS, CSWSH, floods, malformed input) | Threat model mitigated; security checklist 100% |
| **Free** | $0 to run and $0 to use | Runs on free tiers; cost triggers documented |
| **Global** | Usable from anywhere, on slow networks and phones | Works ≥ 360 px wide; low payload sizes; latency measured per region |
| **Reliable** | Recovers on its own from network blips and restarts | Health checks, auto-reconnect, graceful shutdown |

## Non-goals (v1): explicit "no"s
| ❌ We will NOT build | Why |
|---|---|
| User accounts, passwords, OAuth, email | Anonymity is the product. No identity → nothing to leak |
| User-chosen display names | Prevents impersonation, slurs and doxxing; names are system-generated |
| Group chats / rooms with > 2 people | Every session is strictly 1:1 |
| File uploads, images, voice, video | Biggest abuse and legal risk vector; large bandwidth cost |
| Stored message history | Messages live only in the two browsers during the session |
| Public profiles, friend lists, follow systems | Conflicts with anonymity |
| Paid features, ads, tracking or analytics cookies | Free and private by design |

✅ **Allowed:** text messages, emoji **reactions** to messages, typing indicator, themes.

## Constraints
- **$0 budget:** free hosting (Render free tier) → single instance, sleeps when idle, ephemeral disk
- **Browser-only development** (GitHub Codespaces); plain HTML/CSS/JS frontend
- **One maintainer (intern)** → scope must stay realistic (see milestones)
- **Web E2EE limits:** the server delivers the JavaScript, so users must trust that code (see `04-security/e2ee.md`)

## Principles
1. **Collect nothing we don't need; keep nothing longer than needed.**
2. **Never trust the client:** validate everything at the server boundary.
3. **The server is a blind relay:** it routes ciphertext and never sees content.
4. **Safety features ship before growth features.**
5. **Be honest about limits:** document accepted risks instead of hiding them.
6. **Design for scale, build for today:** interfaces ready for scaling, implementation as simple as possible.

## Lessons from history
Anonymous stranger chat has a known failure mode: **Omegle** (2009–2023) shut down after years of abuse and child-safety problems. We take that seriously. Adult-only access, reporting, rate limits, no media, and clear rules are **launch requirements**, not extras (see `04-security/trust-and-safety.md`).
