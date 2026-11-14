# Scaling Strategy

> **Goal:** reach people all over the world while staying **free** for as long as possible, and know exactly what to do (and what it costs) when we outgrow free.

## 1. Vertical vs. horizontal
| | Vertical | Horizontal |
|---|---|---|
| How | Bigger machine | More machines (instances) |
| Limit | One machine's maximum | Practically none |
| Hard part | Cost | **Shared state** between instances |

## 2. Why real-time chat is hard to scale horizontally
Our server keeps **state in memory**: who is waiting, which two sockets form a session, rate-limit buckets, bans. With 2+ instances:
1. A and B may be connected to **different instances**, so a relayed envelope must cross instances
2. The **matchmaking pool** must be shared, or people on instance 1 never meet people on instance 2
3. Pairing must be **atomic** across instances (two instances could grab the same waiting user)
4. Socket.IO's HTTP long-polling fallback needs **sticky sessions**

## 3. The honest free-tier reality
- Render free = **1 instance per service** and **750 instance-hours per month per workspace**, which is about **one** always-on instance.
- So **true always-on horizontal scaling isn't free.** Anyone promising otherwise is relying on trial credits that run out.
- **Good news:** one instance goes a long way for us, because **encryption runs in the users' browsers**, not on the server. Our server only matches and relays small encrypted packets.

## 4. Staged plan
| Stage | Trigger | What we do | Cost |
|---|---|---|---|
| **0: Single instance** (now) | — | In-memory state behind interfaces (`SessionStore`, `WaitingPool`, `TtlStore`) | $0 |
| **1: Measure & optimize** | M7 | Load test (~200 clients); fix hot paths; bucket the open pool by country; cap memory per socket | $0 |
| **2: Stay free longer** | Cold starts hurt, or hours run out | Reduce wasted work; keep payloads tiny; consider other always-free hosts (verify their current terms at that time) | $0 |
| **3: Horizontal (multi-instance)** | Sustained load above what one instance handles in the load test, or reliability needs | Socket.IO **Redis adapter** (cross-instance relay) · matchmaking pool in Redis with atomic pairing (Lua script / transactions) · sticky sessions · rate limits and bans in Redis | Usually paid: managed Redis free tiers are small; multiple always-on instances cost money |
| **4: Multi-region** | Users far from Singapore complain about latency | Instances in several regions; match within a region first; cross-region relay via Redis | Paid |

**Code we write now so Stage 3 is a configuration change, not a rewrite:**
- All state access goes through interfaces; the in-memory versions are just one implementation
- No module except `gateway/` touches Socket.IO directly
- Pairing is one function that could become one atomic Redis script
- Connection-state recovery: note that Socket.IO's **classic Redis adapter doesn't support it**; the **Redis Streams adapter** does. Choose that one at Stage 3.

## 5. Measured capacity: the M7 load test

`npm run load:test` (`scripts/load-test.ts`) starts a real server and drives simulated people through the **real** flow: each has its own address, takes a connection token, connects, pairs, exchanges keys and sends and decrypts **real end-to-end encrypted messages** using the browser's own crypto code. It measures what a person would feel (sender-to-receiver latency, time to be paired) and what the server costs.

**Results, 2026-11-14** (16-core i5-13450HX, 15.8 GB, Node 22, Windows; server and load generator on the **same machine**; each person sends one message every 4 s; 75 s run):

| | 200 people (100 chats) | 400 people (200 chats) |
|---|---|---|
| Connected, paired and encrypted | 200 / 200 | 400 / 400 |
| Messages sent / received | 3,693 / 3,693 | 7,704 / 7,704 |
| Decryption failures, refused messages, chats ended early | 0, 0, 0 | 0, 0, 0 |
| Message latency, sender to receiver (p50 / p95 / p99 / max) | 1 / 2 / 4 / 9 ms | 1 / 2 / 4 / 14 ms |
| Time to be paired (p50 / p95) | 8 / 33 ms | 24 / 34 ms |
| Server relay time (p50 / p95 / max) | 0.08 / 0.15 / 2.36 ms | 0.07 / 0.15 / 2.25 ms |
| Server memory (peak) | 112 MB | 117 MB |
| Server event loop busy | 2.6% | 4% |

Targets for the run, all met: everyone connected; at least 95% secured; zero decryption failures or refusals; p95 latency under 100 ms; memory under 400 MB. **NFR-02 (at least 200 concurrent clients) and the 50 ms relay target are met on this machine.** Raw output is reproducible with `npm run load:test -- --users 200 --seconds 75`.

### What this test does not show (read before quoting it)
- **It ran on one fast machine over `localhost`.** There was no network latency, no TLS, and the server had a whole modern CPU. A free-tier instance has a small fraction of one CPU and 512 MB, so **real numbers will be worse**; the ratios (relay time is tiny, memory is about 100 MB, the loop is nearly idle) are the useful part.
- The load generator shares the machine. It was only about 4 to 5% busy, so it was not the limit, but it is not independent.
- Messages are short and steady (one every 4 s per person). Bursty typing, reactions, mass reconnects after a network blip, reports and blocks were **not** loaded.
- The proof-of-work puzzle was off (it costs the client, not the server).
- Every person had a different address, as real users would, so per-address limits were not stressed.
- 75 seconds is not a soak test: memory growth over hours, leaks and long-run timers are untested (M9: 200 chats for 10 minutes, then 8 hours).
- The server caps connections at 500, so 400 is close to the ceiling; behaviour at the cap is tested separately, not here.

## 5b. Capacity estimate (the earlier assumption, kept for comparison)
Each connected client costs a few KB of server memory plus small buffers. On a 512 MB free instance, **hundreds to low thousands of concurrent chatters** is a reasonable working assumption. The M7 load test above supports this: about 100 MB with 400 people connected. It was run on a fast machine, so treat free-tier numbers as unmeasured until the service is hosted.

## 6. Global reach without new servers
- Keep the page tiny (< 100 KB, excluding the Socket.IO client) for slow networks
- WebSocket keeps one connection open, so there's no per-message connection overhead across oceans
- Text-only messages are ~100s of bytes, fast even on 3G
- Later: **i18n** (UI in multiple languages) matters more for "global" than extra regions

## 7. Cost triggers: when "free" stops being the right answer
Write down the number before it happens, so the decision isn't made in panic:
- Bandwidth > 4 GB in a month (80% of the free quota)
- Instance hours > 700 in a month
- Load test shows p95 relay latency > 50 ms at expected peak
- Cold starts generate user complaints
