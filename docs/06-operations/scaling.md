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

## 5. Capacity estimate (to verify with the M7 load test)
Each connected client costs a few KB of server memory plus small buffers. On a 512 MB free instance, **hundreds to low thousands of concurrent chatters** is a reasonable working assumption. **We'll replace this estimate with measured numbers** from the M7 load test (NFR-02 target: ≥ 200).

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
