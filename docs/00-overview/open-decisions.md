# Open Decisions

Decisions the **product owner** must confirm. Each has a recommendation. Status: ⏸ open · ✅ decided.

> **Updated 2026-11-14.** The project is a portfolio project ([ADR-0012](../03-design/adr/0012-portfolio-scope-not-launched.md)). Product questions were decided in the build and are recorded, with reasons and costs, in the [decision log](decision-log.md). Questions that need a lawyer, an entity or officers are parked as ⏸ "needed before any launch". The original recommendations are kept below.

| ID | Question | Options | Recommendation | Status |
|---|---|---|---|---|
| D-01 | How do we know a user's **country**? | (a) server-side IP lookup (b) user selects it (c) browser GPS | **(a) IP lookup** with the free DB-IP Lite database. The country is derived by the server, can't simply be faked by the client, and needs no permission prompt. Only the 2-letter country code is kept, in memory | ✅ decided, built (DL-12) |
| D-02 | **Interests**: free text or a fixed list? | (a) predefined list (b) free text (c) both | **(a) Predefined list (~30 tags, max 5)**. Free text lets people type slurs, phone numbers or social handles, and matching typos is hard | ✅ decided, built (DL-07) |
| D-03 | Minimum age | 18+ / 16+ / 13+ | **18+ (self-declared)**. Minors chatting with anonymous adults is the highest-risk scenario (Omegle lesson) | ✅ decided, built (DL-18) |
| D-04 | How long to wait for an interest match before a random stranger | 5 s / 10 s / 20 s / never | **10 s**, configurable | ✅ decided, built (DL-08) |
| D-05 | Keep SQLite (`better-sqlite3`)? | keep / remove | **Remove** from dependencies: we store no messages (ADR-0005). Bans live in memory | ✅ 2026-10-28 removed |
| D-06 | Should users see a global "N people online" count? | yes / no | **Yes**: harmless aggregate and it builds trust that people are there | ✅ decided, built (DL-09) |
| D-07 | Rename F-02 (themes)? You said it "will be modified" | — | Waiting for your new requirements | ✅ decided: themes removed (DL-11) |
| D-08 | Encrypted typing indicator? | plaintext signal / encrypted | **Plaintext start/stop signal** (it carries no content, just timing). Revisit later | ✅ decided, built (DL-10) |
| D-09 | Original project scope listed "message history in SQLite" | keep / replace | **Replace** with "session-only history in the browser" (your new requirement). Update the project description | ✅ decided, built (DL-13) |
| D-10 | Durable safety ledger? | none / SQLite disk / managed Postgres | **Managed Postgres (Singapore) from M6**, minimal and expiring. See [data inventory, section 6](../09-compliance/data-inventory-and-retention.md) | ✅ decided: **no ledger**, memory only (DL-17) |
| D-11 | Position on RA 10175 Sec 13 and RA 11930 Sec 9 (6-month traffic data) | A hold nothing / B retain 6 mo / C preserve on demand | **C**, confirmed by counsel. Must be decided in M6 because it changes the ledger schema and the privacy notice. See [law-enforcement-requests.md](../09-compliance/law-enforcement-requests.md) | ⏸ not needed unless launched (see decision log) |
| D-12 | Who is the DPO, who is the child-safety officer, and who is each one's backup? | name people | Name them in **M6**, not M8: the report flow cannot go live without them. See [roles-and-access.md](../09-compliance/roles-and-access.md) | ⏸ needed before any launch (see decision log) |
| D-13 | Hosting region | Singapore / other | Keep Singapore; record transfer in PIA | ⏸ Singapore if ever hosted (see decision log) |
| D-14 | Report case retention | 7 / 30 / 90 days | **30 days** | ✅ moot: reports live 1 hour in memory (DL-17) |
| D-15 | Vulnerability disclosure policy | yes / no | **Yes** (`SECURITY.md` added) | ✅ decided, built (`SECURITY.md`) |
| D-16 | What legal entity operates the service? | individual / sole proprietorship (DTI) / one-person corporation (SEC) | Register one before M8. Without it there is no NPC registration, no processor agreement and no named controller. Ask counsel which form. See [ict-deployment-standards.md](../09-compliance/ict-deployment-standards.md) | ⏸ needed before any launch (see decision log) |
| D-17 | Engage a Philippine lawyer: who, when, what budget? | now / M6 / M8 | **Engage during M6.** Every citation in `09-compliance` is unverified until then. Earlier estimate: PHP 15,000 to 50,000 | ⏸ needed before any launch (see decision log) |
| D-18 | How is the "Philippines beta" enforced? | invitation only / country allowlist / terms only | **Country allowlist** (uses the M5 lookup) plus the terms, so one legal regime applies while moderation capacity is small | ⏸ moot while not launched (see decision log) |

When a decision is made: mark ✅, add the date, and if it's architectural, write an ADR.
