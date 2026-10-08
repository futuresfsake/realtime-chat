# User Stories

Format: *As a **role**, I want **goal**, so that **benefit**.*
Acceptance criteria use **Given / When / Then**.

---

### US-01 Send and receive messages ✅
As a **chatter**, I want my message to appear for everyone in the room instantly, so that we can talk in real time.
- Given two users in the same room, when one sends "hi", then both see "hi" within 1 second.
- Given an empty or whitespace-only message, when sent, then nothing is broadcast.

### US-02 Choose a username 🔜 (M3)
As a **chatter**, I want to pick a display name, so that others know who's talking.
- Given a valid name (2–20 chars, `[A-Za-z0-9_-]`), when I join, then my messages show that name.
- Given an invalid name, when I join, then I see a clear error and stay on the name prompt.
- Given a name already used in that room, when I join, then I'm asked to choose another.

### US-03 Join and switch rooms 🔜 (M3)
As a **chatter**, I want to join a named room, so that I can talk about one topic with one group.
- Given I'm in `#general`, when I type `/join random`, then I leave `#general` and only receive `#random` messages.
- Room names: 1–30 chars, lowercase `[a-z0-9-]`.

### US-04 See who's online 🔜 (M3)
As a **chatter**, I want to see who's in my room, so that I know who'll read my message.
- When someone joins or leaves, the ONLINE list updates for everyone in that room within 1 second.

### US-05 Typing indicator 🔜 (M3)
As a **chatter**, I want to see when someone is typing, so that I don't talk over them.
- When a user types, others in the room see "ana is typing...".
- It disappears 3 s after they stop typing, or immediately when they send.

### US-06 See recent history 🔜 (M4)
As a **chatter**, I want to see the last messages when I join, so that I have context.
- When I join a room, I see up to the last 50 messages, oldest first.

### US-07 Bad input is rejected safely 🔜 (M2)
As the **maintainer**, I want every incoming event validated, so that malformed data can't crash or corrupt the server.
- Given a payload of the wrong type, too long, or with extra fields, when received, then it's rejected and the sender gets an error ack, and the server keeps running.

### US-08 Abuse is limited 🔜 (M2)
As a **chatter**, I want spammers slowed down, so that the room stays usable.
- Given a user sending more than 5 messages in a burst, when they continue, then extra messages are rejected with "slow down".
- Given a payload over 1 KB, it is dropped before parsing.

### US-09 Survive disconnects ✅
As a **chatter**, I want the app to reconnect by itself, so that a network blip doesn't break my session.
- When the connection drops, the status shows OFFLINE; when it returns, it shows ONLINE without a page reload.

### US-10 Personalize the look ✅
As a **chatter**, I want to choose a theme, so that the app is comfortable to read.
- `/theme amber` or clicking a theme applies it instantly and remembers it after reload.

### US-11 Power-user shortcuts ✅
As a **chatter**, I want terminal-style commands and history, so that I can chat quickly with the keyboard.

### US-12 Use it from anywhere 🚧 (M1)
As a **chatter**, I want to open a public URL, so that I can chat from my phone or any computer.
- The app is reachable over HTTPS at a public URL, and works between a phone on mobile data and a laptop.
