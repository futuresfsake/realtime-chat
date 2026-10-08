# 04-security: How we protect users

| File | What it contains |
|---|---|
| [e2ee.md](e2ee.md) | The end-to-end encryption protocol, step by step, what it protects and **what it doesn't** |
| [privacy-and-sessions.md](privacy-and-sessions.md) | What a session is, session-only history, **why we don't use JWT**, a data inventory of everything we touch and for how long |
| [trust-and-safety.md](trust-and-safety.md) | Protecting users from *each other*: 18+ gate, rules, reports, bans, legal notes |
| [threat-model.md](threat-model.md) | Every threat (T-##), how we mitigate it, and its status |
| [security-checklist.md](security-checklist.md) | The launch gate: every box must be checked before M8 |

## What are "threat model items"?
A **threat model** is a structured list of *"what could go wrong, and what do we do about it?"*. Each **item** (row) has:

| Column | Meaning | Example |
|---|---|---|
| **ID** | Stable reference used in stories, PRs and tests | `T-05` |
| **STRIDE** | The threat category ([glossary](../GLOSSARY.md)) | Tampering |
| **Threat** | What an attacker could do | Send `<script>` in a message so it runs in the partner's browser |
| **Asset** | What gets hurt | Users' browsers, E2EE keys |
| **Mitigation** | What we do to stop it | Render with `textContent`; strict CSP |
| **Status** | ✅ done · 🔜 planned (milestone) · ⚠️ accepted risk | 🔜 M2 |

**How to use it:** when you add a new event, endpoint or feature, ask "how could someone abuse this?" and add a row. A PR that adds input without a row is not Done.
