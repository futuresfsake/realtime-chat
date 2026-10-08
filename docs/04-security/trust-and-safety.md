# Trust & Safety

Security protects the **system** from attackers. Trust & Safety protects **users from each other**. For an anonymous stranger chat, this is the make-or-break part.

## 1. Why this matters
- **Omegle (2009–2023)** connected anonymous strangers and shut down after sustained abuse, including harm to minors. Our product has the same shape, so these controls are **launch requirements**.
- E2EE means **we can't read or scan content**. Safety must come from design (limits, gates, reporting, friction for abusers), not from moderators reading chats.

## 2. Risks
| Risk | Who's harmed | Likelihood |
|---|---|---|
| Minors using the service | Minors | High without a gate |
| Harassment, hate, sexual messages | Chatters | High |
| Users sharing personal info (doxxing themselves or others) | Chatters | Medium |
| Spam / scam links / bots | Chatters | High |
| Ban evasion via VPN | Everyone | Medium |

## 3. Controls
| # | Control | How | Milestone |
|---|---|---|---|
| S-01 | **18+ gate + rules** | Must confirm "I am 18 or older" and accept the rules before the first search; the server refuses `session:start` without consent | M6 |
| S-02 | **Text only** | No images, files, voice or video, which removes the worst content types | by design |
| S-03 | **No user-chosen names, no profiles** | Nothing to impersonate or search for | M3 |
| S-04 | **Instant exit** | `/next` and `/leave` always work, in one keystroke | M3 |
| S-05 | **Report** | `/report <reason>` ends the chat and prevents rematch | M6 |
| S-06 | **Automatic temporary bans** | 3 reports from **distinct** IP hashes within 1 h → blocked from matching for 24 h | M6 |
| S-07 | **Rate limits** | Messages, `/start`/`/next` (stops bots "farming" matches), reports | M2 |
| S-08 | **Personal info warning** | First message of every session: `*** stay safe: don't share your name, address, phone or social accounts` | M3 |
| S-09 | **Link friction** | URLs are displayed as plain text, never clickable | M3 |
| S-10 | **IP hidden from partners** | Server relay, not WebRTC (ADR-0008) | by design |
| S-11 | **Curated interests** | No dating/sexual/political tags (matchmaking.md) | M5 |
| S-12 | **Clear rules page** | Plain language; what's not allowed; how reporting works | M6 |

### Why "distinct reporters"?
One angry user could report everyone they meet. Requiring 3 **different** reporters within an hour makes bans reflect a pattern, not one opinion.

### Collateral risk of IP-based bans
Mobile carriers often share one public IP among many users (CGNAT). A ban could hit innocent people on the same IP, so bans are **short (24 h)** and affect **matching only** (the page still loads with an explanation).

## 4. What we deliberately don't do
| Not doing | Why |
|---|---|
| Reading or scanning messages | E2EE: impossible, by design |
| Collecting report transcripts | Unverifiable, nobody to review them, and a privacy cost |
| Identity / ID verification | Contradicts anonymity; costly |
| Permanent bans | No reliable identity; collateral damage |

## 5. Rules (draft for the rules page)
1. You must be **18 or older**.
2. No harassment, threats, hate speech or bullying.
3. No sexual content involving minors, ever. No unsolicited sexual content.
4. Don't share personal information, yours or anyone else's.
5. No spam, scams, or advertising.
6. Be kind. You can always `/next`.

## 6. Legal note *(not legal advice)*
Platforms that let users message each other are regulated in many countries (child-safety, online-safety and data-protection laws). With a global audience, several may apply at once. **Before M8, have the rules, the age gate and the privacy notice reviewed by someone qualified.**
