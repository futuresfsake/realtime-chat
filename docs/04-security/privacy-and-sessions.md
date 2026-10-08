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
| Server memory | ❌ Never: envelopes are relayed and dropped immediately |
| Server disk / database | ❌ There is no database |
| Server logs | ❌ No content, no ciphertext |
| Browser `localStorage` / `sessionStorage` / cookies | ❌ Never used for messages |
| **Browser memory (a JavaScript array)** | ✅ Only during the session, max 500 lines |

**So:** if you're in the session, you can scroll your history. When the session ends, or you refresh or close the tab, it's gone for good, for you, your stranger and us.

**Network blips** (e.g. switching Wi-Fi to mobile data) don't end the session: Socket.IO *connection state recovery* restores the connection within **30 s** and delivers missed envelopes. The page and keys stay in memory, so history survives a blip, but **not** a refresh.

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
| Data | Why we need it | Where | Retention | Shared with |
|---|---|---|---|---|
| IP address | Connection, rate limits, country lookup | Process memory (transient) | Discarded after lookup/hash; never logged | Render (platform level) |
| IP hash (HMAC, daily salt) | Per-IP limits, bans, no-rematch | Memory | ≤ 24 h; unlinkable once the salt rotates | No one |
| Country code | Country matching | Memory | While connected | Partner? **No**, only used for matching |
| Interests | Matching | Memory | While searching; shared interests are shown to the matched partner | Partner (only the shared ones) |
| Random name | Display | Memory | One session | Partner |
| Public keys | Key exchange | Memory | One session | Partner (relayed) |
| Ciphertext envelopes | Relay | Memory, milliseconds | Not retained | Partner (relayed) |
| Message plaintext | — | **Only in the two browsers** | One session | — |
| Reports (reason + IP hash) | Temporary bans | Memory | ≤ 24 h | No one |
| Theme preference | UI | Browser `localStorage` | Until cleared by the user | No one |
| Age/rules consent | Gate | Browser `sessionStorage` | Until the tab closes | No one |
| Aggregate counters | Monitoring | Logs | Per Render's log retention | Render |

## 6. Logging policy
- ✅ Log: event types, error codes, counts, durations, `ipHash` prefix (first 8 chars) for abuse investigation
- ❌ Never log: message content, ciphertext, keys, raw IPs, interests tied to an IP hash, user agents

## 7. Third parties
| Party | What they get |
|---|---|
| Render (hosting) | Network-level data (IPs, request metadata) per their own policies |
| DB-IP | **Nothing**: the database is a local file, with no API calls |
| GitHub | Our source code only |

## 8. Legal note *(not legal advice)*
We operate from the Philippines, where the **Data Privacy Act of 2012 (RA 10173)** applies. A global audience may bring in other laws (e.g. GDPR for EU users). Minimizing data, as above, is the strongest compliance position. **Have the privacy notice reviewed by someone qualified before launch (M8).**
