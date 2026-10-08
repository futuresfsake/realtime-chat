# User Stories

Format: *As a **role**, I want **goal**, so that **benefit**.* Acceptance criteria (AC) use **Given / When / Then**.
Status: ✅ done · 🔜 planned

## Definition of Done: for every story
A story is **Done** only when **all** of these are true:
1. ✅ Every acceptance criterion passes, verified by a test or a written manual check
2. ✅ Automated tests added: unit tests for logic, integration test if it crosses client ↔ server
3. ✅ New input from clients has a zod schema; new abuse risk has a threat-model row
4. ✅ `npm run typecheck`, `npm test` and `npm run build` pass, and CI is green
5. ✅ No message plaintext ever reaches the server or the logs (from M4 onward)
6. ✅ Works on desktop **and** a 360 px-wide phone screen; keyboard usable
7. ✅ Docs updated: feature status, specs, LLD if structure changed
8. ✅ Merged to `main` through a PR, deployed, and smoke-tested on the live URL

*(Milestone and release DoD: see [milestones.md](milestones.md).)*

---

## Epic A: Chat sessions (M3)

### US-01 Get a random name 🔜
As a **chatter**, I want the system to give me a random name, so that I stay anonymous and nobody can impersonate a real person.
- Given I start a session, then I'm assigned a name like `quiet-otter-42` (adjective-animal-two digits) from curated word lists.
- Given I start a **new** session (`/next`), then I get a **new** name.
- There is **no way** to type or change my own name.
- **Features:** F-12

### US-02 Start a chat with a stranger 🔜
As a **chatter**, I want to be connected to one stranger, so that I can have a private conversation.
- Given I'm READY, when I type `/start`, then I see `searching...` and, once matched, `connected to <name>`.
- Given I'm matched, then only my partner receives my messages.
- **Features:** F-01, F-13

### US-03 Exactly two people per chat 🔜
As a **chatter**, I want my chat to be strictly between me and one stranger, so that nobody else can join or read it.
- A session always has exactly 2 sockets. A third client can never join, even by sending a fake session id.
- When one side leaves, the session is closed for good. It can't be re-joined.
- **Features:** F-13

### US-04 Skip to the next stranger 🔜
As a **chatter**, I want to end this chat and meet someone new instantly, so that I'm never stuck in a bad conversation.
- Given I'm CHATTING, when I type `/next`, then my partner sees `*** stranger left`, my screen clears, and I start SEARCHING.
- `/next` is limited to 10 per minute.
- **Features:** F-16

### US-05 Leave without searching again 🔜
As a **chatter**, I want to stop chatting completely, so that I can take a break.
- When I type `/leave`, the session ends and I return to READY. No new search starts.
- **Features:** F-16

### US-06 See my partner's status 🔜
As a **chatter**, I want to see whether my stranger is still there, so that I don't talk to an empty room.
- The sidebar shows `● connected`, `✎ typing…` or `○ left` within 1 s of a change.
- If my partner's connection drops briefly, I see `reconnecting…`; after 30 s without recovery, the session ends.
- **Features:** F-14

### US-07 See when the stranger is typing 🔜
- When my partner types, I see `<name> is typing…`; it disappears 3 s after they stop, or as soon as their message arrives.
- **Features:** F-18

### US-08 React to a message 🔜
As a **chatter**, I want to react with an emoji, so that I can respond quickly without typing.
- `/react 😂` adds the reaction to the stranger's latest message; both sides see it.
- Only `👍 ❤️ 😂 😮 😢 🙏` are accepted.
- **Features:** F-19

### US-09 History only while I'm in the session 🔜
As a **chatter**, I want messages to exist only during the chat, so that nothing can be read later by anyone.
- Messages are held **only in browser memory** (not localStorage, not cookies, not the server).
- When the session ends (`/next`, `/leave`, partner left, tab closed or refreshed), the history is wiped and **can't be recovered**.
- The server never stores messages (verified by code review + a test that the server has no storage for messages).
- **Features:** F-17

### US-10 See how many people are online 🔜
- The top bar shows `N online`, updated at most every 5 s. No names, no locations.
- **Features:** F-15

### US-11 Survive short network drops 🔜 (basic ✅)
As a **chatter** on a mobile network, I want brief disconnects not to end my chat.
- Given my connection drops for < 30 s, when it comes back, then my session continues and missed messages are delivered.
- Given it drops for > 30 s, then the session ends for both sides.
- **Features:** F-05

## Epic B: Privacy (M4)

### US-12 Messages are end-to-end encrypted 🔜
As a **chatter**, I want only my stranger to be able to read my messages, so that not even the operators can see them.
- Every message and reaction is encrypted in my browser before sending.
- The server only receives and forwards ciphertext. Server logs contain no message content.
- The UI shows `🔒 end-to-end encrypted` once keys are exchanged. **No message can be sent before that.**
- If key exchange fails or the browser lacks WebCrypto, the chat ends with a clear error. It **never falls back to unencrypted**.
- **Features:** F-20

### US-13 Verify nobody is in the middle 🔜
As a **privacy-conscious chatter**, I want to compare a safety code with my stranger, so that I can confirm nobody swapped our keys.
- `/verify` shows a code like `48213 99307 17742 03621`, identical on both sides when keys weren't tampered with.
- The help text explains the code is only meaningful if compared over a **different** channel.
- **Features:** F-21

## Epic C: Matching (M5)

### US-14 Choose my interests 🔜
- I can pick up to 5 interests from a predefined list (e.g. `music, gaming, coding, anime, travel…`).
- Given I and a waiting stranger share ≥ 1 interest, then we are matched and see `shared: <interest>`.
- **Features:** F-22

### US-15 My country or worldwide 🔜
- `/country local` → I'm only matched with people the server detects in the same country as me.
- `/country world` → I can be matched with anyone whose own setting allows me.
- A local-only user is never matched with someone outside their country.
- **Features:** F-23

### US-16 Fall back to a random stranger 🔜
- Given no interest match within 10 s, then I'm matched with any compatible stranger and see `no shared interests found - connected to a random stranger`.
- **Features:** F-24

## Epic D: Safety (M6)

### US-17 Confirm age and rules before chatting 🔜
- Before the first search I must confirm **I am 18 or older** and accept the rules (no harassment, no sharing personal info, no sexual content involving minors, etc.).
- The confirmation is remembered only for the browser session (`sessionStorage`).
- **Features:** F-25

### US-18 Report a stranger 🔜
- `/report harassment` ends the chat, prevents rematching, and sends the report (reason code only).
- **No transcript is sent.** The server never had the messages, and with no human moderators nobody would read them. Bans are based on *how many different people* report someone (US-20).
- **Features:** F-26

### US-19 Never meet the same person again 🔜
- Strangers I skipped or reported aren't matched with me again for 24 h (best effort, using the same daily-salted IP hash as bans, so no extra identifier is created).
- **Features:** F-27

### US-20 Abusers are temporarily blocked 🔜
As the **operator**, I want repeat abusers blocked automatically, so that others stay safe without us reading chats.
- If **3 different** users report the same client within 1 hour, that client is blocked from matching for 24 h.
- The block uses a salted hash of the IP that rotates daily. Raw IPs are never stored.
- **Features:** F-28

## Epic E: Platform (M2, M7)

### US-21 Bad input is rejected safely (M2) 🔜
- Payloads of the wrong type, with unknown fields, or too large → rejected with `{ ok:false, error:{ code:"VALIDATION" } }`; the server keeps running.
- **Features:** F-07

### US-22 Spam is limited (M2) 🔜
- More than 5 messages in a burst → `slow down`. More than 5 sockets from one IP → refused.
- **Features:** F-08

### US-23 Only our website can connect (M2) 🔜
- A socket opened from another website's origin is refused. Security headers grade A on securityheaders.com.
- **Features:** F-09

### US-24 Use it from anywhere (M2) 🔜
- The app is reachable over HTTPS at a public URL; a phone on mobile data can chat with a laptop.
- **Features:** F-11

### US-25 Operator knows when it's down (M7) 🔜
- An uptime monitor checks `/health` every 5 minutes and alerts by email.
- **Features:** F-06, F-29, F-30

## Epic F: Already delivered (M1)

### US-26 Personalize the look ✅
- `/theme amber` or clicking a theme switches instantly and is remembered. *(F-02 will be revised, see D-07)*

### US-27 Power-user keyboard control ✅
- Slash commands and ↑/↓ input history.
