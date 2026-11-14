// A small load test (M7): many simulated people chat at once against a real
// server. Each one has its own address, goes through the real handshake, pairs,
// exchanges keys and sends and decrypts real end-to-end encrypted messages,
// using the same crypto code the browser runs.
//
//   npm run load:test -- [--users 200] [--seconds 75] [--every 4000] [--json]
//   npm run load:test -- --url http://localhost:3000   (a server you started with TRUST_PROXY_HOPS=1)
//
// By default it starts its own server. It measures what a user would feel
// (one-way message latency from sender to receiver, time to be paired) and
// what the server costs (memory, and its own relay timing from its metrics
// snapshot). Exit code 1 if a target is missed. See docs/06-operations/scaling.md.
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { cpus, totalmem } from "node:os";
import { createServer } from "node:net";
import { performance } from "node:perf_hooks";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { ALLOWED_REACTIONS, PROTOCOL_VERSION, RULES_VERSION } from "../src/types/events.js";
import { loadE2ee } from "../tests/helpers/e2ee.js";
import type { Channel } from "../tests/helpers/e2ee.js";

const args = process.argv.slice(2);
const num = (name: string, fallback: number) => {
  const at = args.indexOf(name);
  const parsed = at >= 0 ? Number(args[at + 1]) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const USERS = Math.max(2, Math.floor(num("--users", 200) / 2) * 2); // pairs
const SECONDS = num("--seconds", 75);
const EVERY_MS = num("--every", 4000); // one message per user this often
const RAMP_MS = 20; // gap between new connections
const externalUrl = args.includes("--url") ? args[args.indexOf("--url") + 1] : undefined;
const JSON_OUT = args.includes("--json");

const e2ee = loadE2ee();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const pct = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
const round = (n: number) => Math.round(n * 10) / 10;

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

// ---------- the server under test ----------
let child: ChildProcess | null = null;
const snapshots: { timings?: Record<string, { n: number; p50: number; p95: number; max: number }>; gauges?: Record<string, number>; counters?: Record<string, number> }[] = [];
let url: string;
if (externalUrl) {
  url = externalUrl;
} else {
  const port = await freePort();
  url = `http://localhost:${port}`;
  child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
    env: {
      ...process.env,
      PORT: String(port),
      ALLOWED_ORIGINS: url,
      NODE_ENV: "development",
      TRUST_PROXY_HOPS: "1", // every simulated person arrives from their own address
      POW_DIFFICULTY_BITS: "0", // the puzzle costs the client, not the server: keep the generator free
      LOG_LEVEL: "info",
    },
    stdio: ["ignore", "pipe", "inherit"],
  });
  let buffer = "";
  child.stdout!.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const text of lines) {
      try {
        const entry = JSON.parse(text) as { event?: string; data?: (typeof snapshots)[number] };
        if (entry.event === "metrics_snapshot" && entry.data) snapshots.push(entry.data);
      } catch {
        /* not a log line */
      }
    }
  });
}
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch(`${url}/health`)).ok) break;
  } catch {
    /* not up yet */
  }
  await sleep(150);
}

// ---------- the people ----------
const stats = {
  connected: 0,
  connectFailed: 0,
  paired: 0,
  secured: 0,
  sent: 0,
  received: 0,
  decryptFailed: 0,
  ackErrors: {} as Record<string, number>,
  endedEarly: 0,
  disconnects: 0,
};
const latency: number[] = [];
const pairWait: number[] = [];
const sockets: Socket[] = [];
const timers: NodeJS.Timeout[] = [];

function addressOf(i: number): string {
  return `10.${(i >> 8) & 255}.${i & 255}.${1 + (i % 250)}`; // distinct, valid
}

async function startUser(i: number): Promise<void> {
  const address = addressOf(i);
  let token: string;
  try {
    const res = await fetch(`${url}/connect-token`, { headers: { "x-forwarded-for": address } });
    if (!res.ok) throw new Error(String(res.status));
    token = ((await res.json()) as { token: string }).token;
  } catch {
    stats.connectFailed++;
    return;
  }
  const socket = io(url, {
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
    auth: { protocolVersion: PROTOCOL_VERSION, token, consent: { adult: true, rulesVersion: RULES_VERSION } },
    extraHeaders: { origin: url, "x-forwarded-for": address },
  });
  sockets.push(socket);
  let channel: Channel | null = null;
  let searchStartedAt = 0;

  socket.on("connect", () => {
    stats.connected++;
    searchStartedAt = Date.now();
    socket.emit("session:start", {}, (ack: { ok: boolean; error?: { code: string } }) => {
      if (!ack?.ok) stats.ackErrors[`start.${ack?.error?.code ?? "none"}`] = (stats.ackErrors[`start.${ack?.error?.code ?? "none"}`] ?? 0) + 1;
    });
  });
  socket.on("connect_error", () => {
    stats.connectFailed++;
  });
  socket.on("disconnect", () => {
    stats.disconnects++;
  });
  socket.on("session:matched", async ({ sessionId, role }: { sessionId: string; role: string }) => {
    stats.paired++;
    pairWait.push(Date.now() - searchStartedAt);
    channel = e2ee.createChannel({ sessionId, role, allowedReactions: ALLOWED_REACTIONS });
    socket.emit("e2e:key", { publicKey: await channel.publicKey() });
  });
  socket.on("e2e:key", async ({ publicKey }: { publicKey: string }) => {
    if (!channel) return;
    try {
      await channel.receiveKey(publicKey);
    } catch {
      stats.decryptFailed++;
      return;
    }
    stats.secured++;
    const mine = channel;
    // Each person sends on their own timer, started at a random moment so the load is even.
    const startTimer = setTimeout(() => {
      const timer = setInterval(async () => {
        try {
          const envelope = await mine.seal({ t: "msg", text: `${Date.now()}|${"x".repeat(40)}` });
          stats.sent++;
          socket.emit("e2e:envelope", envelope, (ack: { ok: boolean; error?: { code: string } }) => {
            if (ack && !ack.ok) {
              const code = ack.error?.code ?? "none";
              stats.ackErrors[code] = (stats.ackErrors[code] ?? 0) + 1;
            }
          });
        } catch {
          stats.decryptFailed++;
        }
      }, EVERY_MS);
      timers.push(timer);
    }, Math.random() * EVERY_MS);
    timers.push(startTimer);
  });
  socket.on("e2e:envelope", async (envelope: unknown) => {
    if (!channel) return;
    try {
      const plain = await channel.open(envelope);
      if (plain.t === "msg") {
        const sentAt = Number(plain.text.split("|")[0]);
        if (Number.isFinite(sentAt)) latency.push(Date.now() - sentAt);
        stats.received++;
      }
    } catch {
      stats.decryptFailed++;
    }
  });
  socket.on("session:ended", () => {
    stats.endedEarly++;
  });
}

// ---------- run ----------
const loopStart = performance.eventLoopUtilization();
const memory: number[] = [];
const sampler = setInterval(async () => {
  try {
    const body = (await (await fetch(`${url}/health`)).json()) as { details?: { rssMb?: number } };
    if (body.details?.rssMb) memory.push(body.details.rssMb);
  } catch {
    /* ignore a missed sample */
  }
}, 2000);

const startedAt = Date.now();
if (!JSON_OUT) process.stdout.write(`starting ${USERS} users against ${url} for ${SECONDS}s\n`);
for (let i = 0; i < USERS; i++) {
  void startUser(i);
  await sleep(RAMP_MS);
}
const rampedAt = Date.now();
await sleep(SECONDS * 1000);

// ---------- results ----------
clearInterval(sampler);
for (const t of timers) clearInterval(t);
const generatorBusyPct = performance.eventLoopUtilization(loopStart).utilization * 100;
for (const s of sockets) s.disconnect();
await sleep(300);
const last = [...snapshots].reverse().find((s) => s.timings?.relay_ms);
child?.kill();

const sorted = [...latency].sort((a, b) => a - b);
const waits = [...pairWait].sort((a, b) => a - b);
const ackErrorCount = Object.values(stats.ackErrors).reduce((a, b) => a + b, 0);
const results = {
  machine: { cpus: cpus().length, cpuModel: cpus()[0]?.model.trim(), memoryGb: round(totalmem() / 1024 ** 3), node: process.version },
  run: { users: USERS, pairs: USERS / 2, seconds: SECONDS, messageEveryMs: EVERY_MS, rampSeconds: round((rampedAt - startedAt) / 1000) },
  people: { connected: stats.connected, connectFailed: stats.connectFailed, paired: stats.paired, secured: stats.secured, endedEarly: stats.endedEarly, disconnects: stats.disconnects },
  messages: { sent: stats.sent, received: stats.received, decryptFailed: stats.decryptFailed, ackErrors: stats.ackErrors },
  messageLatencyMs: { n: sorted.length, p50: round(pct(sorted, 0.5)), p95: round(pct(sorted, 0.95)), p99: round(pct(sorted, 0.99)), max: round(sorted.at(-1) ?? 0) },
  timeToPairMs: { p50: round(pct(waits, 0.5)), p95: round(pct(waits, 0.95)), max: round(waits.at(-1) ?? 0) },
  server: {
    rssMbPeak: Math.max(0, ...memory),
    rssMbFirst: memory[0] ?? null,
    rssMbLast: memory.at(-1) ?? null,
    relayMs: last?.timings?.relay_ms ?? null,
    eventLoopBusyPct: last?.gauges?.eventLoopBusyPct ?? null,
    snapshots: snapshots.length,
  },
  loadGenerator: { eventLoopBusyPct: round(generatorBusyPct) },
};

const targets: [string, boolean][] = [
  [`every person connected (${results.people.connected}/${USERS})`, results.people.connected === USERS],
  [`at least 95% paired and secured (${results.people.secured}/${USERS})`, results.people.secured >= USERS * 0.95],
  [`no message failed to decrypt (${results.messages.decryptFailed})`, results.messages.decryptFailed === 0],
  [`no message refused (${ackErrorCount})`, ackErrorCount === 0],
  [`no chat ended early (${results.people.endedEarly})`, results.people.endedEarly === 0],
  [`message latency p95 under 100 ms (${results.messageLatencyMs.p95} ms)`, results.messageLatencyMs.p95 < 100],
  [`server memory under 400 MB (peak ${results.server.rssMbPeak} MB)`, results.server.rssMbPeak < 400],
];

if (JSON_OUT) {
  process.stdout.write(`${JSON.stringify({ results, targets: Object.fromEntries(targets) }, null, 2)}\n`);
} else {
  const o = results;
  process.stdout.write(
    [
      "",
      `machine        ${o.machine.cpus} cpus (${o.machine.cpuModel}), ${o.machine.memoryGb} GB, node ${o.machine.node}`,
      `run            ${o.run.users} users (${o.run.pairs} chats), ${o.run.seconds}s, one message each every ${o.run.messageEveryMs / 1000}s, ramp ${o.run.rampSeconds}s`,
      `people         connected ${o.people.connected}, paired ${o.people.paired}, secured ${o.people.secured}, ended early ${o.people.endedEarly}, failed ${o.people.connectFailed}`,
      `messages       sent ${o.messages.sent}, received ${o.messages.received}, decrypt failures ${o.messages.decryptFailed}, refused ${ackErrorCount}`,
      `latency (ms)   p50 ${o.messageLatencyMs.p50}, p95 ${o.messageLatencyMs.p95}, p99 ${o.messageLatencyMs.p99}, max ${o.messageLatencyMs.max}  (sender to receiver, n=${o.messageLatencyMs.n})`,
      `time to pair   p50 ${o.timeToPairMs.p50} ms, p95 ${o.timeToPairMs.p95} ms`,
      `server memory  first ${o.server.rssMbFirst} MB, last ${o.server.rssMbLast} MB, peak ${o.server.rssMbPeak} MB`,
      `server relay   ${o.server.relayMs ? `p50 ${o.server.relayMs.p50} ms, p95 ${o.server.relayMs.p95} ms, max ${o.server.relayMs.max} ms` : "no snapshot (run 60 s or more)"}; event loop busy ${o.server.eventLoopBusyPct ?? "n/a"}%`,
      `generator      event loop busy ${o.loadGenerator.eventLoopBusyPct}% (near 100 means the generator, not the server, is the limit)`,
      "",
      ...targets.map(([name, ok]) => `${ok ? "PASS" : "FAIL"}  ${name}`),
      "",
    ].join("\n"),
  );
}
process.exit(targets.every(([, ok]) => ok) ? 0 : 1);
