# Privacy and Sessions

This doc answers: **what is a session, where does history live, do we use JWT, and exactly what data do we touch and for how long?**

## 1. What is a "session"?
A **session** is one 1:1 conversation between two strangers, from the moment they're matched until either leaves.

| Property | Value |
|---|---|
| Participants | Exactly 2 |
| Identity inside it | Random system names (e.g. `quiet-otter-42`), new every session |
| Identifier | `sessionId`: 128-bit random (`crypto.randomUUID()`), server memory only |
| Keys | Ephemeral E2EE keys, created at the start, destroyed at the end |
| Lifetime | Ends on `/next`, `/leave`, `/report`, tab close/refresh, or > 30 s disconnect |
| After it ends | **Nothing remains**: no history, no keys, no names, no link to the next session |

## 2. Message history: "only while you're in the session"
| Where | Stored? |
|---|---|
| Server memory | ⚠️ Briefly: relayed envelopes are kept for up to about 100 seconds so that a dropped connection can catch up (see *Network blips* below), then dropped. Never written anywhere |
| Server disk / database | ❌ There is no database |
| Server logs | ❌ No content, no ciphertext |
| Browser `localStorage` / `sessionStorage` / cookies | ❌ Never used for messages |
| **Browser memory (a JavaScript array)** | ✅ Only during the session, max 500 lines |

**So:** if you're in the session, you can scroll your history. When the session ends, or you refresh or close the tab, it's gone for good, for you, your stranger and us.

**Network blips** (e.g. switching Wi-Fi to mobile data) don't end the session: Socket.IO *connection state recovery* restores the connection within **30 s** and delivers missed envelopes. The page and keys stay in memory, so history survives a blip, but **not** a refresh.

**What that costs:** to replay what a dropped client missed, Socket.IO keeps every relayed event in a memory buffer. Events older than the recovery window (40 s) are removed by a sweep that runs once a minute, so an event can stay in memory for up to about 100 seconds. The buffer is never written to disk or to logs, and it is lost on restart. Until M4 these events are plaintext; from M4 they are ciphertext the server cannot read. The private id a client presents to be restored is a random secret sent only to that client over the encrypted connection, and a restored socket must still pass the normal handshake (fresh connect token, consent, rate limits).

## 3. Do we use JWT? **No.** Here's why.

### What is a JWT?
A **JSON Web Token** is a string like `xxxxx.yyyyy.zzzzz` made of three base64url parts:
1. **Header**: the signing algorithm
2. **Payload**: *claims* such as `{"sub":"user123","exp":1760000000}`
3. **Signature**: proves the server issued it and that it wasn't modified

A server gives you a JWT after login; you send it with every request; any server holding the key can verify it **without a database lookup** (it's "stateless").

### When JWT is the right tool
Logged-in users with accounts, multiple backend services that must trust the same identity, APIs called from many clients.

### Why it's wrong for us
| JWT gives you… | Our situation |
|---|---|
| Proof of a **persistent identity** | We deliberately have **no** identity, so there's nothing to prove |
| Stateless verification across many servers | One server; the live socket already *is* the authenticated connection |
| Tokens that last minutes to days | A long-lived token would be a **tracking identifier** linking sessions together, the opposite of anonymity |
| — | It also brings a signing secret to protect, token theft risks, and hard revocation |

**Our model:** identity = the live WebSocket connection + a random per-session name. Nothing is issued, nothing is stored, nothing persists. (ADR-0006.)

**When we'd revisit:** with multiple server instances, a reconnecting client may land on another instance. A **short-lived (≤ 30 s), signed session ticket** could then prove "I was in session X". Even then it would be random, single-session and short-lived. See [scaling.md](../06-operations/scaling.md).

## 4. "Anonymous even to us": what we can and can't promise
| We can promise | We can't promise (and say so) |
|---|---|
| No accounts, emails, phone numbers or user-chosen names | Your IP address is visible to Render's infrastructure and briefly to our process (that's how the internet works) |
| No message content ever reaches us in readable form (E2EE) | The stranger can screenshot the chat |
| No raw IPs stored or logged by us | Users who need strong anonymity should use a VPN/Tor (and they'll appear in that country) |
| Sessions can't be linked to each other by us | Web E2EE relies on the JavaScript we serve (see e2ee.md §7) |

## 5. Data inventory: everything we touch
The inventory is kept in one place: [09-compliance/data-inventory-and-retention.md](../09-compliance/data-inventory-and-retention.md). It lists every item, its purpose, lawful basis, location, retention and who else sees it, for today's code and for each later milestone.

A PR that adds a field, a log line or a vendor updates that file.

## 6. Logging policy
- ✅ Log: event types, error codes, counts, durations, `ipHash` prefix (first 8 chars) for abuse investigation
- ❌ Never log: message content, ciphertext, keys, raw IPs, interests tied to an IP hash, user agents

## 7. Third parties
| Party | What they get |
|---|---|
| Render (hosting) | Network-level data (IPs, request metadata) per their own policies |
| DB-IP | **Nothing**: the database is a local file, with no API calls |
| GitHub | Our source code only |

## 8. Data retention policy
Retention periods are in the [data inventory](../09-compliance/data-inventory-and-retention.md). They are provisional until decision D-11 (six-month preservation) is made.

## 9. Legal compliance
Our legal duties and how we meet them are in [09-compliance](../09-compliance/README.md):

| Topic | Document |
|---|---|
| Which laws apply | [regulatory-register.md](../09-compliance/regulatory-register.md) |
| Status of each obligation | [compliance-matrix.md](../09-compliance/compliance-matrix.md) |
| Privacy risks | [privacy-impact-assessment.md](../09-compliance/privacy-impact-assessment.md) |
| User rights | [data-subject-rights.md](../09-compliance/data-subject-rights.md) |
| Breaches | [breach-notification.md](../09-compliance/breach-notification.md) |
| Court and police requests | [law-enforcement-requests.md](../09-compliance/law-enforcement-requests.md) |

### International
A global audience may bring in other laws (GDPR for EU users, various US state privacy laws). Our data minimization approach simplifies compliance across jurisdictions. **Have the privacy notice and terms reviewed by a qualified Philippine lawyer before launch (M8).**
