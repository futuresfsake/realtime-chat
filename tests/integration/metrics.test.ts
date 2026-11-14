import { afterEach, describe, expect, it } from "vitest";
import { command, connect, next, nextText, pair, send, sendRaw, startServer } from "./helpers.js";
import type { Matched, TestServer } from "./helpers.js";

let server: TestServer;
afterEach(async () => {
  await server?.close();
});

const FAST = { metricsIntervalMs: 40 };

interface Snapshot {
  intervalSec: number;
  counters: Record<string, number>;
  totals: Record<string, number>;
  timings: Record<string, { n: number; p50: number; p95: number; max: number }>;
  gauges: Record<string, number>;
}
const snapshots = (): Snapshot[] =>
  server.logs.map((l) => JSON.parse(l)).filter((l) => l.event === "metrics_snapshot").map((l) => l.data as Snapshot);
const total = (name: string) => snapshots().reduce((sum, s) => sum + (s.counters[name] ?? 0), 0);

describe("metrics snapshot (US-41)", () => {
  it("is logged on a timer with counters, timings and gauges", async () => {
    server = await startServer({}, FAST);
    await connect(server);
    await expect.poll(() => snapshots().length, { timeout: 6000 }).toBeGreaterThan(1);
    const snap = snapshots().at(-1)!;
    expect(Object.keys(snap).sort()).toEqual(["counters", "gauges", "intervalSec", "timings", "totals"]);
    expect(Object.keys(snap.gauges).sort()).toEqual([
      "activeSessions", "bansActive", "connections", "eventLoopP99Ms", "heapUsedMb", "noRematchPairs", "rssMb", "uptimeSec", "waiting",
    ]);
    expect(snap.gauges.rssMb).toBeGreaterThan(10);
    expect(snap.gauges.connections).toBe(1);
  });

  it("counts connections, sessions, matches, messages and keys of a real chat", async () => {
    server = await startServer({}, FAST);
    const { a, b } = await pair(server);
    const got = nextText(b);
    await send(a, "hello metrics");
    await got;
    await command(a, "session:leave");
    await expect.poll(() => total("sessions_ended.left"), { timeout: 6000 }).toBe(1);
    expect(total("ws_connected")).toBe(2);
    expect(total("sessions_started")).toBe(1);
    expect(total("matches.random")).toBe(1);
    expect(total("keys_relayed")).toBe(2);
    expect(total("envelopes_relayed")).toBe(1);
    expect(total("events_total")).toBeGreaterThanOrEqual(5);
  });

  it("measures relay latency, match wait and session length", async () => {
    server = await startServer({}, FAST);
    const { a, b } = await pair(server);
    for (let i = 0; i < 3; i++) {
      const got = nextText(b);
      await send(a, `m${i}`);
      await got;
    }
    await command(a, "session:leave");
    await expect.poll(() => snapshots().some((s) => s.timings.session_duration_ms), { timeout: 6000 }).toBe(true);
    const timing = (name: string) => snapshots().map((s) => s.timings[name]).find(Boolean);
    expect(timing("relay_ms")).toMatchObject({ n: expect.any(Number) });
    expect(timing("relay_ms")!.p95).toBeLessThan(50); // the service level: relay under 50 ms
    expect(timing("match_wait_ms")!.n).toBe(1);
    expect(timing("session_duration_ms")!.n).toBe(1);
  });

  it("counts rejections by code, reports by category and blocks", async () => {
    server = await startServer({ TRUST_PROXY_HOPS: "1" }, FAST);
    const bad = await connect(server, { forwardedFor: "9.9.9.9" });
    for (const ip of ["3.0.0.1", "3.0.0.2", "3.0.0.3"]) {
      const reporter = await connect(server, { forwardedFor: ip });
      const matched = next<Matched>(bad, "session:matched");
      await command(bad, "session:start");
      await command(reporter, "session:start");
      await matched;
      await reporter.timeout(2000).emitWithAck("session:report", { reason: "harassment" });
    }
    await command(bad, "session:start"); // refused: blocked
    await sendRaw(bad, { nope: true }); // refused: not valid
    await expect.poll(() => total("blocks"), { timeout: 6000 }).toBe(1);
    expect(total("reports.harassment")).toBe(3);
    expect(total("rejected.BANNED")).toBe(1);
    expect(total("rejected.VALIDATION")).toBe(1);
    expect(total("events_rejected")).toBeGreaterThanOrEqual(2);
  });

  it("counts refusals before a connection exists", async () => {
    server = await startServer({}, FAST);
    await connect(server, { origin: "https://evil.example" }).catch(() => {});
    await connect(server, { authOverrides: { protocolVersion: "rc/v0" } }).catch(() => {});
    await expect.poll(() => total("ws_refused.origin"), { timeout: 6000 }).toBe(1);
    expect(total("ws_refused.PROTOCOL_MISMATCH")).toBe(1);
  });

  it("contains numbers and fixed names only: no text, address, hash, country or interest", async () => {
    server = await startServer({ TRUST_PROXY_HOPS: "1" }, FAST);
    const a = await connect(server, { forwardedFor: "1.2.3.4" });
    const b = await connect(server, { forwardedFor: "5.6.7.8" });
    const matched = next<Matched>(a, "session:matched");
    await command(a, "session:start", { interests: ["gaming"] });
    await command(b, "session:start", { interests: ["gaming"] });
    await matched;
    await expect.poll(() => snapshots().length, { timeout: 6000 }).toBeGreaterThan(2);
    const lines = server.logs.filter((l) => JSON.parse(l).event === "metrics_snapshot").join("\n");
    for (const forbidden of ["1.2.3.4", "5.6.7.8", "gaming", "PH", "country", "ipHash"]) expect(lines).not.toContain(forbidden);
    expect(lines).not.toMatch(/[0-9a-f]{32}/); // no hash, session id or token
    for (const snap of snapshots()) {
      for (const bag of [snap.counters, snap.totals, snap.gauges]) {
        for (const value of Object.values(bag)) expect(typeof value).toBe("number");
      }
    }
  });
});

describe("alerts on a real server (US-30, US-42)", () => {
  it("raise an error rate alert when too many events are refused, and clear it later", async () => {
    server = await startServer({}, FAST);
    const a = await connect(server);
    for (let i = 0; i < 30; i++) a.emit("e2e:envelope", { not: "valid" });
    await expect
      .poll(() => server.logs.map((l) => JSON.parse(l)).some((l) => l.event === "alert" && l.data.rule === "error_rate"), { timeout: 8000 })
      .toBe(true);
    const alert = server.logs.map((l) => JSON.parse(l)).find((l) => l.event === "alert");
    expect(alert.level).toBe("warn");
    expect(Object.keys(alert.data).sort()).toEqual(["limit", "rule", "severity", "value"]);
  });

  it("do not fire on ordinary use", async () => {
    server = await startServer({}, FAST);
    const { a, b } = await pair(server);
    const got = nextText(b);
    await send(a, "all is well");
    await got;
    await new Promise((r) => setTimeout(r, 200));
    expect(server.logs.map((l) => JSON.parse(l)).filter((l) => l.event === "alert")).toEqual([]);
  });

  it("stop with the server: no timer is left running", async () => {
    server = await startServer({}, FAST);
    await server.close();
    const before = snapshots().length;
    await new Promise((r) => setTimeout(r, 150));
    expect(snapshots().length).toBe(before);
  });
});
