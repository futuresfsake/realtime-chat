# Open Decisions

Decisions the **product owner** must confirm. Each has a recommendation. Status: ⏸ open · ✅ decided.

| ID | Question | Options | Recommendation | Status |
|---|---|---|---|---|
| D-01 | How do we know a user's **country**? | (a) server-side IP lookup (b) user selects it (c) browser GPS | **(a) IP lookup** with the free DB-IP Lite database. The country is derived by the server, can't simply be faked by the client, and needs no permission prompt. Only the 2-letter country code is kept, in memory | ⏸ |
| D-02 | **Interests**: free text or a fixed list? | (a) predefined list (b) free text (c) both | **(a) Predefined list (~30 tags, max 5)**. Free text lets people type slurs, phone numbers or social handles, and matching typos is hard | ⏸ |
| D-03 | Minimum age | 18+ / 16+ / 13+ | **18+ (self-declared)**. Minors chatting with anonymous adults is the highest-risk scenario (Omegle lesson) | ⏸ |
| D-04 | How long to wait for an interest match before a random stranger | 5 s / 10 s / 20 s / never | **10 s**, configurable | ⏸ |
| D-05 | Keep SQLite (`better-sqlite3`)? | keep / remove | **Remove** from dependencies: we store no messages (ADR-0005). Bans live in memory | ⏸ |
| D-06 | Should users see a global "N people online" count? | yes / no | **Yes**: harmless aggregate and it builds trust that people are there | ⏸ |
| D-07 | Rename F-02 (themes)? You said it "will be modified" | — | Waiting for your new requirements | ⏸ |
| D-08 | Encrypted typing indicator? | plaintext signal / encrypted | **Plaintext start/stop signal** (it carries no content, just timing). Revisit later | ⏸ |
| D-09 | Original project scope listed "message history in SQLite" | keep / replace | **Replace** with "session-only history in the browser" (your new requirement). Update the project description | ⏸ |

When a decision is made: mark ✅, add the date, and if it's architectural, write an ADR.
