# Slash Commands

Commands start with `/`. They're **never sent as chat messages**.
- **Local** = handled entirely in the browser
- **Server** = sends a control event to the server (never message content)

Names are case-insensitive. Unknown commands show `!!! unknown command: /x (try /help)`.
Allowed states: `READY` (not chatting) · `SEARCHING` · `CHATTING` · `ANY`.

## Reference

| Command | Args | Type | Allowed in | What it does | Milestone |
|---|---|---|---|---|---|
| `/help` | — | Local | ANY | Lists the commands you can use **in your current state** | ✅ |
| `/clear` | — | Local | ANY | Clears the screen. **Session history is wiped from memory too** (it can't be scrolled back) | ✅ |
| `/whoami` | — | Local | ANY | Shows your random name, interests and country scope for this session | ✅ → M3 |
| `/theme` | `[name]` | Local | ANY | No arg: lists themes. With arg: switches theme (saved in this browser) | ✅ |
| `/start` | — | Server | READY | Starts searching for a stranger with your current preferences | M3 |
| `/next` | — | Server | CHATTING, SEARCHING | Ends the current chat (the partner sees "stranger left") and immediately searches again. Alias: `/skip` | M3 |
| `/leave` | — | Server | CHATTING, SEARCHING | Ends the chat or search and returns to READY. Doesn't search again | M3 |
| `/react` | `<emoji>` | Server (encrypted) | CHATTING | Reacts to the stranger's **latest** message. Allowed: `👍 ❤️ 😂 😮 😢 🙏` (or the shortcodes `+1 heart laugh wow sad thanks`) | M3 |
| `/verify` | — | Local | CHATTING | Shows the session's **safety code**. Explains how to compare it (see E2EE doc) | M4 |
| `/interests` | `[add\|remove] <tag…>` / `clear` / `list` | Local (sent on `/start`) | READY | Manage up to 5 interests from the allowed list. No args: shows current + available | M5 |
| `/country` | `local\|world` | Local (sent on `/start`) | READY | `local` = match only within your country, `world` = anyone | M5 |
| `/report` | `<reason>` | Server | CHATTING | Reports the stranger, ends the chat, prevents rematching. Reasons: `spam`, `harassment`, `sexual`, `minor`, `hate`, `other` | M6 |
| `/online` | — | Server | ANY | Shows the global online count | M3 |

## Examples
```
/interests add music gaming coding
/country world
/start
*** searching for someone who likes music, gaming or coding...
*** connected to brave-falcon-17 · shared: gaming · 🔒 end-to-end encrypted
/react 😂
/report harassment
*** reported. you won't be matched with brave-falcon-17 again.
```

## Errors (shown in red with `!!!`)
| Situation | Message |
|---|---|
| Wrong state | `!!! /next only works while chatting or searching` |
| Bad argument | `!!! unknown interest "cooking". try /interests to see the list` |
| Too many interests | `!!! max 5 interests` |
| Rate limited | `!!! slow down - try again in a few seconds` |

## Design rules
- Every server-type command is validated by a **zod schema** on the server (see `03-design/validation-zod.md`).
- `/next` and `/start` are rate-limited separately (max 10 per minute) to stop "matchmaking farming" bots.
- Commands never reveal anything about the stranger beyond their random name and shared interests.
