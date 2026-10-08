# ADR-0001: Use Socket.IO for real-time messaging

- **Status:** Accepted · **Date:** 2026-10-08

## Context
Chat needs the server to push messages to clients instantly. Plain HTTP is request/response only.

## Options
| Option | Pros | Cons |
|---|---|---|
| Raw WebSocket (`ws`) | Lightweight, standard | We'd build rooms, reconnection, acks and heartbeats ourselves |
| **Socket.IO** | Rooms, auto-reconnect, acks, fallback to HTTP long-polling, typed events | Custom protocol (clients must use the Socket.IO client), slightly larger |
| Server-Sent Events | Simple, plain HTTP | One-way only (server → client) |
| Polling | Works everywhere | Slow and wasteful |

## Decision
Socket.IO.

## Consequences
- ✅ Rooms, reconnection and acks for free, so less code and fewer bugs
- ✅ Typed events with TypeScript generics
- ⚠️ Scaling to multiple instances later needs `@socket.io/redis-adapter` + sticky sessions
