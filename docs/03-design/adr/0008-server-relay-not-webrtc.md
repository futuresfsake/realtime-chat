# ADR-0008: Relay through the server, not peer-to-peer WebRTC

- **Status:** Accepted · **Date:** 2026-10-08

## Context
WebRTC data channels could send messages directly browser-to-browser, which would offload our server.

## Options
| Option | Pros | Cons |
|---|---|---|
| **Server relay (Socket.IO)** | Partners never learn each other's IP; we can rate-limit and end sessions; simple | Server bandwidth for every message (tiny for text) |
| WebRTC peer-to-peer | Less server traffic | **Exposes each user's IP address to the stranger** (doxxing risk); ~10–20% of connections need a TURN relay server anyway (costs bandwidth); can't enforce rate limits |

## Decision
Server relay. **Hiding users' IPs from strangers is a safety requirement.**

## Consequences
- ✅ Strangers can't geolocate each other
- ⚠️ All traffic crosses our free-tier bandwidth (5 GB/month ≈ millions of short text messages; monitored)
