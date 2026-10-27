# Data Governance Requirements — IT Manager Review

**Date:** 2026-10-27

---

## 1. Data Classification

Every piece of data the system touches must be classified. This is a **RA 10173 requirement** (Data Privacy Act) and a prerequisite for the Privacy Impact Assessment.

### 1.1 Data Inventory

| Data Element | Classification | Where | Retention | RA 10173 Category |
|---|---|---|---|---|
| Raw IP address | **PII — Sensitive** | Server memory (transient) | Milliseconds (used for hash, then discarded) | Personal information |
| IP hash (HMAC-SHA-256) | **Pseudonymized PII** | Server memory | 24 hours (salt rotation) | Pseudonymized data |
| Country code (ISO 3166-1) | **Non-PII** | Server memory | Session duration | Derived, non-identifying |
| Session ID (UUID) | **Session identifier** | Server + client memory | Session duration | Not personal data |
| Random name (adj-animal-NN) | **Non-PII** | Server + client memory | Session duration | System-generated, non-identifying |
| Interests (tags) | **Non-PII** | Server memory | Session duration | User preference, non-identifying |
| ECDH public key | **Cryptographic material** | Server relay (transient), client memory | Session duration | Not personal data |
| ECDH private key | **Secret cryptographic material** | Client memory only | Session duration (non-extractable) | Not applicable (never leaves client) |
| AES-GCM session keys | **Secret cryptographic material** | Client memory only | Session duration (non-extractable) | Not applicable |
| Encrypted envelope (ciphertext) | **Encrypted content** | Server relay (transient) | Milliseconds (relay only) | Encrypted, not readable |
| Plaintext message | **Content — Sensitive** | Client memory only | Session duration | Not applicable (never reaches server) |
| Report reason code | **Operational data** | Server memory | 24 hours (salt rotation) | Not personal data |
| Report count per IP hash | **Operational data** | Server memory | 24 hours | Linked to pseudonymized PII |
| Ban record (IP hash) | **Access control data** | Server memory | 24 hours | Linked to pseudonymized PII |
| No-rematch list | **Session preference** | Server memory | 24 hours | Linked to pseudonymized PII |
| Typing indicator | **Behavioral signal** | Server relay (transient) | Milliseconds | Not personal data |
| Online count | **Aggregate statistic** | Server memory, broadcast | Real-time only | Not personal data |
| Abuse score per IP hash | **Operational metric** | Server memory | Session/24h | Linked to pseudonymized PII |
| Safety metrics (aggregated) | **Operational metric** | Server logs | 7-30 days | Aggregated, non-identifying |
| Server logs (JSON) | **Operational data** | Render log stream | Render retention (~7 days) | Must not contain PII |
| WebSocket connection metadata | **Connection data** | Server memory | Connection duration | Contains IP (transient) |

### 1.2 PII Flow Diagram

```
   ┌─────────────────────────────────────────────────────────────────────┐
   │                        CLIENT (Browser)                            │
   │                                                                     │
   │  [Plaintext] → [Encrypt] → [Ciphertext]                           │
   │  [Private Key] (non-extractable, never leaves)                     │
   │  [Public Key] (shared with server for relay)                       │
   │  [Session History] (memory only, wiped on end)                     │
   └──────────────────────────┬──────────────────────────────────────────┘
                              │ TLS (HTTPS/WSS)
                              ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │                     RENDER EDGE (TLS Termination)                  │
   │                                                                     │
   │  [Raw IP] → visible here (Render infrastructure)                   │
   │  [X-Forwarded-For header] → passed to app                         │
   └──────────────────────────┬──────────────────────────────────────────┘
                              │
                              ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │                     NODE.JS APPLICATION                            │
   │                                                                     │
   │  PII TOUCHPOINTS:                                                  │
   │                                                                     │
   │  1. [Raw IP] → clientIp.ts → HMAC-SHA-256(dailySalt, ip) → [Hash] │
   │     ↳ Raw IP DISCARDED immediately after hashing                   │
   │     ↳ Hash used for: rate limits, ban checks, no-rematch          │
   │                                                                     │
   │  2. [Raw IP] → geo/countryLookup.ts → [Country Code]              │
   │     ↳ Raw IP DISCARDED immediately after lookup                    │
   │     ↳ Country code used for: matchmaking scope                    │
   │                                                                     │
   │  3. [Ciphertext] → sessionManager.ts → relay to partner            │
   │     ↳ Ciphertext NOT STORED, NOT LOGGED                           │
   │     ↳ Server cannot read content (no keys)                        │
   │                                                                     │
   │  NEVER STORED:                                                     │
   │  - Raw IP addresses                                                │
   │  - Message content (plaintext or ciphertext)                       │
   │  - Encryption keys                                                 │
   │  - Session history                                                 │
   │                                                                     │
   │  STORED IN MEMORY (not persisted):                                 │
   │  - IP hashes (24h TTL)                                             │
   │  - Ban records (24h TTL)                                           │
   │  - Report counts (24h TTL)                                         │
   │  - No-rematch pairs (24h TTL)                                      │
   │  - Session metadata (session duration)                             │
   └─────────────────────────────────────────────────────────────────────┘
```

## 2. Data Retention Schedule

| Data | Retention | Enforcement Mechanism | Justification |
|---|---|---|---|
| Raw IP | ~0ms (immediate discard) | Code design: hash-then-discard | RA 10173 data minimization |
| IP hash | Max 24 hours | Daily salt rotation + TTL maps | Short-lived pseudonymized identifier |
| Session data | Session duration only | In-memory, deleted on session end | No persistent storage needed |
| Ban records | 24 hours | TTL-based expiry in memory | Proportionate to abuse severity |
| Report counts | 24 hours | TTL-based expiry in memory | Rolling window for ban threshold |
| No-rematch list | 24 hours | TTL-based expiry in memory | User safety |
| Safety metrics | 7-30 days | Log stream retention (Render) | Trend analysis for moderation |
| Server logs | ~7 days | Render log retention (platform default) | Operational debugging |
| Audit trail (agents-run.jsonl) | Indefinite | Git repository | Process compliance |

## 3. Gaps Identified

### 3.1 CRITICAL: No Data Flow Diagram in Formal Documentation (DG-01)
The data flow above must be formalized as a standalone document in `docs/04-security/` and referenced in the Privacy Impact Assessment.

### 3.2 CRITICAL: No Breach Notification Procedure (DG-02)
RA 10173 (via NPC Circular 16-03) requires:
- Notification to the National Privacy Commission within 72 hours of discovery
- Notification to affected data subjects if the breach involves sensitive personal information
- Documentation of the breach, its effects, and remedial measures

**Required action:** Create `docs/04-security/breach-notification.md` with:
- Breach identification criteria
- Internal escalation chain
- NPC notification template
- Data subject notification template (even though we collect minimal PII, a breach of IP hashes or behavioral data may qualify)
- Post-breach review process

### 3.3 MAJOR: No Privacy Impact Assessment Template (DG-03)
RA 10173 requires a PIA for processing that is likely to result in a high risk to rights and freedoms. An anonymous chat platform handling minors-related reports qualifies.

**Required action:** Create a PIA template before M6 and complete it before M8.

### 3.4 MAJOR: No Data Subject Rights Procedure (DG-04)
Even with minimal data collection, RA 10173 grants data subjects the right to:
- Be informed about data processing
- Access their personal data
- Object to processing
- Erasure (right to be forgotten)

For this platform, most rights are satisfied by design (no persistent data). But the privacy notice must explicitly state this.

### 3.5 MAJOR: No Data Processing Agreement with Render (DG-05)
Render processes data on behalf of the platform (logs, IP addresses transit their infrastructure). Under RA 10173, a Data Processing Agreement or equivalent terms must exist between the data controller (operator) and the data processor (Render).

**Required action:** Review Render's Terms of Service and Data Processing Addendum. Document compliance in a memo.

### 3.6 MINOR: Log Sanitization Not Verified (DG-06)
The plan says "no raw IPs in logs" but this isn't enforced by code yet. A single `console.log(req.ip)` or `console.log(socket.handshake.address)` would violate the privacy design.

**Required action:** Add a CI check (grep/semgrep rule) that fails if any log statement could contain a raw IP.
