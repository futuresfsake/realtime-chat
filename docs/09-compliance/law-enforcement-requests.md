# Law-Enforcement and Court Requests

**Last reviewed:** 2026-11-13 · **Owner:** DPO (D-12), with counsel · **Blocked on:** D-11

How we respond when police, the NBI, a prosecutor or a court asks for data. Two things must both be true: we obey valid legal process, and we never hand over more than the law requires or pretend to have data we do not.

## 1. What we can and cannot produce
Tell every requester this at the start. It saves everyone time.

| Asked for | Can we produce it? |
|---|---|
| Message content | **No.** Never stored. From M4 the server cannot read it even in transit |
| A user's name, email, phone, account | **No.** We never collect them. There are no "subscribers" |
| A user's IP address | **No.** Not kept after the connection is hashed |
| Which session a given IP used | Only on the same day, only by recomputing the keyed hash, and only if a matching record still exists |
| Report cases (category, time, pseudonymous IDs) | Yes, from M6, for 30 days or while on legal hold |
| Ban records | Yes, from M6, while they last |
| Aggregate logs (event types, counts, hash prefix) | Yes, within the platform's log retention |

Render, as the host, may hold network-level logs under its own policies. Requests for those go to Render.

## 2. The open question: six-month preservation (D-11)
RA 10175 Sec 13 says a service provider preserves the integrity of **traffic data and subscriber information for at least six months** from the transaction. RA 11930 Sec 9 has a similar duty for internet intermediaries, for data **in their control and possession**. We deliberately hold almost none of either.

| Option | What we would do | For | Against |
|---|---|---|---|
| **A. Hold nothing extra** | Keep the design as is. State that we have no subscriber information and no retained traffic data | Strongest privacy; least breach risk | Legal risk if a court reads the duty as "you must collect and keep" |
| **B. Retain a minimum for six months** | Store keyed IP hash, timestamp and country per connection for six months | Lowest legal risk | A six-month linkable record of every visitor; weakens the anonymity promise; must be in the notice and PIA; needs the database sooner |
| **C. Preserve on demand** | Keep the design, plus a legal-hold switch that stops deletion of named records the moment a request arrives | Middle path; keeps the promise for almost everyone | Does not help for events before the request |

**Recommendation: C, with counsel's written opinion before M8.** If counsel requires B, store only the keyed hash and timestamp, never a raw IP, and rewrite the privacy notice before turning it on.

This decision changes the safety-ledger schema, the retention table and the privacy notice, so it must be made in M6, not at launch.

## 3. Kinds of request
| Request | Legal basis ◻ | Who may send it | What we do |
|---|---|---|---|
| Preservation request or order | RA 10175 Sec 13 | Law enforcement | Set a legal hold on the named records. No disclosure yet |
| Warrant to disclose computer data | RA 10175 Sec 14; Rule on Cybercrime Warrants (A.M. No. 17-11-03-SC) | A court | Disclose what the warrant names, within 72 hours of receipt |
| Warrant to search, seize and examine | RA 10175 Sec 15; same Rule | A court | Cooperate; counsel present |
| Warrant to intercept | Same Rule | A court | We have no ability to intercept content after M4. Say so through counsel |
| Subpoena | Rules of Court; agency powers | Court, prosecutor, some agencies | Counsel checks scope and validity |
| Notice under RA 11930 | RA 11930 Sec 9 | Competent authority | Follow [child-protection-and-online-safety.md](child-protection-and-online-safety.md). Short deadlines apply |
| Informal request by email, phone or chat | None | Anyone | **Do not disclose.** Ask for formal process. Offer to preserve |
| Request from a foreign authority | Treaty or mutual legal assistance | Through the DOJ Office of Cybercrime | Refer them to the DOJ. Do not answer directly |

Real-time collection of traffic data without a warrant (RA 10175 Sec 12) was struck down by the Supreme Court in 2014. A request citing it alone is not valid process.

## 4. Steps
1. **Receive.** All requests go to the DPO. Staff who receive one say only "I will pass this to our Data Protection Officer" and forward it.
2. **Log.** Date and time received, agency, officer, case number, what is asked, legal basis cited, deadline.
3. **Verify.** Is it from a real authority? Call the agency back on a number we find ourselves. Is the document signed by a judge where a warrant is required? Is it addressed to us? Is it in date?
4. **Preserve first.** Set the legal hold at once, even while verifying. Preserving is reversible; deletion is not.
5. **Call counsel** before any disclosure.
6. **Scope.** Produce only what the document names and only what exists. Nothing extra, no guesses, no commentary.
7. **Respond in writing** within the deadline. Include the plain statement of what we do not hold.
8. **Record** what was sent, when, to whom, and on what basis.
9. **Release the hold** when counsel confirms the matter is closed. The purge job then deletes as normal.

## 5. Emergencies
If a request says a life is in immediate danger (a threat of violence, a child at risk): the DPO preserves at once, calls counsel, and may share the minimum necessary with the PNP or NBI where the law allows disclosure to protect life. Record the reason. We do not wait for paperwork to **preserve**; we do not skip counsel to **disclose** unless delay itself is the danger.

## 6. What we never do
- Build a way to read messages, weaken encryption, or log content for one user
- Disclose on an informal request
- Tell one user about a request concerning another
- Destroy data after learning of a request

## 7. Transparency
After launch, publish once a year: how many requests we received, of what kind, and how many led to disclosure. No case details.

## 8. Done when
- [ ] D-11 decided, with counsel's opinion on file
- [ ] Legal hold implemented and tested (M7)
- [ ] Request log exists, restricted to the DPO
- [ ] Standard response letter reviewed by counsel
- [ ] Public law-enforcement guidelines page drafted ([public-policies.md](public-policies.md))
