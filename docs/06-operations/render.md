# Render

## Definition
**Render** is a **PaaS** (Platform as a Service): you connect a GitHub repo, and Render **builds, runs, secures (TLS) and monitors** your app. You don't manage servers, operating systems or certificates.

## Where it fits in the stack
```
Your code (GitHub) ──▶ Render: build → container → TLS edge/proxy → public URL ──▶ users' browsers
                       └─ you manage: code, build/start commands, env vars
                       └─ Render manages: machines, OS, networking, HTTPS certificates, restarts
```

## What problem it solves for us
We need a **long-running Node.js process** that keeps **WebSocket** connections open, with HTTPS, for **$0**. Serverless platforms (Vercel, Netlify) run code per request and can't keep sockets open; raw servers (VPS) cost money and require OS maintenance.

## How it works internally (simplified)
1. A push to `main` → Render pulls the commit
2. **Build:** runs `npm ci && npm run build` in a fresh container
3. **Start:** runs `npm start`, which must listen on `process.env.PORT`
4. **Health check:** calls `/health`; only when it passes does traffic switch to the new version (zero-downtime deploy). If it fails, the old version keeps serving
5. **Edge proxy:** terminates TLS and forwards HTTP/WebSocket traffic to the container. The real client IP arrives in the `X-Forwarded-For` header
6. **Free tier:** no traffic for 15 min → the container is stopped; the next request starts it again (~1 min)

## Free tier (as of Oct 2026, verify before relying on it)
| Limit | Value | Impact on us |
|---|---|---|
| Price | $0, no card needed | ✅ |
| Spin-down | After 15 min idle; ~1 min cold start | First visitor waits; open chats keep it awake (WebSocket messages count as activity) |
| Instance hours | 750 / month per workspace | ≈ 1 always-on instance. **Two instances would run out mid-month** |
| Outbound bandwidth | 5 GB / month (Hobby workspace) | Plenty for text; without a card, overage **suspends** services |
| Filesystem | Ephemeral (wiped on restart/deploy) | Fine: we store nothing (ADR-0005) |
| Instances | 1 per free service | No horizontal scaling on free (see scaling.md) |

## Alternatives
| Option | Free? | Fit |
|---|---|---|
| Railway | Trial, then ~$1/mo credit | Not enough to run all month |
| Fly.io | Trial only, card required | Good tech, not free |
| Vercel / Netlify | Free | ❌ No long-lived WebSockets |
| Own VPS (~$4–6/mo) | No | Full control, but you patch the OS yourself |

## When NOT to use Render's free tier
Anything needing always-on uptime guarantees, more than one instance, persistent disk, or more than ~5 GB/month of traffic. That's when to move to a paid plan or another host (cost triggers in scaling.md).

## Common mistakes
- Hard-coding the port instead of `process.env.PORT`
- Expecting files written at runtime to persist
- Using the IP from `socket.handshake.address` (that's Render's proxy). Read `X-Forwarded-For` correctly (`src/security/clientIp.ts`)
- Load-testing the free instance
