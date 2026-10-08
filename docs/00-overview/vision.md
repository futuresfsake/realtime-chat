# Vision

## Problem
We want a small, real chat product that anyone can open in a browser and use instantly, and that is built the way production software is built: tested, documented, secure and observable.

## Goal
**Ship realtime-chat to the public internet: free, safe and secure.**

| Pillar | What it means for us | How we'll know |
|---|---|---|
| **Free** | $0/month to run | Runs on Render free tier, no paid add-ons |
| **Safe** | Users can't be harmed by other users (XSS, spam, impersonation abuse) | Threat model items all ✅ or explicitly accepted |
| **Secure** | The server can't be crashed, flooded or exploited by common attacks | Security checklist passes before "public launch" |
| **Reliable enough** | Recovers on its own from restarts and reconnects | Clients auto-reconnect; health check green |
| **Maintainable** | A new dev can run it and change it in < 30 min | README + docs + CI green on every PR |

## Users
- **Casual chatter:** opens the link, picks a name, joins a room and talks. No signup.
- **Maintainer (us):** deploys, monitors and fixes it.

## Scope (v1)
Rooms, usernames, online list, typing indicator, input validation, rate limiting, message history, tests, CI, docs.

## Non-goals (v1)
- User accounts / passwords / OAuth
- Private messages, file uploads, images, reactions
- End-to-end encryption
- Horizontal scaling (multiple server instances)
- Moderation tooling beyond rate limiting and length limits

## Constraints
- Free hosting only → the instance sleeps after 15 min idle, the disk is ephemeral, it's a single instance
- Browser-only dev environment (GitHub Codespaces)
- Plain HTML/CSS/JS frontend (no framework, no build step for the client)

## Guiding principles
1. **Never trust the client.** Validate everything on the server.
2. **Secure by default.** Safe behavior is the default; unsafe behavior must be explicit.
3. **Small, reviewed changes.** One branch → one PR → CI green → merge.
4. **Measure before optimizing.** Optimize only what tests or metrics show is slow.
