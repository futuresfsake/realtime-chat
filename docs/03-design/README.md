# 03-design: How it's built

| File | What it contains | Read when |
|---|---|---|
| [high-level-design.md](high-level-design.md) | System context, components, **step-by-step request flows** (diagrams), quality trade-offs | First |
| [low-level-design.md](low-level-design.md) | Module layout, event contracts, state machine, data structures, algorithms, error handling | Before coding |
| [matchmaking.md](matchmaking.md) | Interest + country matching algorithm, allowed interests, complexity | M5 |
| [validation-zod.md](validation-zod.md) | What zod is, why we use it, and every schema | M2+ |
| [api-versioning.md](api-versioning.md) | How the WebSocket protocol is versioned and how old clients are handled | Before changing an event |
| [adr/](adr/README.md) | Architecture Decision Records: *why* we chose each technology | Anytime |
| [tdd/](tdd/GAPS.md) | Technical Design Documents: one per story, grouped by milestone, plus `GAPS.md` (questions raised while writing them) | Before building a story |

Security design (E2EE, privacy) lives in [`04-security/`](../04-security/README.md).
