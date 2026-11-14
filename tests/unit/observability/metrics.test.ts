import { describe, expect, it } from "vitest";
import { Metrics } from "../../../src/observability/metrics.js";

function setup() {
  let time = 1_000;
  const metrics = new Metrics(() => time);
  return { metrics, advance: (ms: number) => (time += ms) };
}

describe("counters", () => {
  it("count what happened since the last snapshot, and keep a running total", () => {
    const { metrics, advance } = setup();
    metrics.count("ws_connected");
    metrics.count("ws_connected");
    metrics.count("events_total", 5);
    advance(60_000);
    const first = metrics.snapshot({});
    expect(first.counters).toEqual({ ws_connected: 2, events_total: 5 });
    expect(first.totals).toEqual({ ws_connected: 2, events_total: 5 });
    expect(first.intervalSec).toBe(60);

    metrics.count("ws_connected");
    advance(30_000);
    const second = metrics.snapshot({});
    expect(second.counters).toEqual({ ws_connected: 1 }); // a new interval starts at zero
    expect(second.totals.ws_connected).toBe(3);
    expect(second.intervalSec).toBe(30);
    expect(metrics.total("ws_connected")).toBe(3);
    expect(metrics.total("never_counted")).toBe(0);
  });

  it("stop accepting new names after a bound, so a bug cannot grow them without limit", () => {
    const { metrics } = setup();
    for (let i = 0; i < 500; i++) metrics.count(`name_${i}`);
    expect(Object.keys(metrics.snapshot({}).totals).length).toBe(200);
    metrics.count("name_0"); // an existing name still counts
    expect(metrics.total("name_0")).toBe(2);
    expect(metrics.total("name_499")).toBe(0);
  });
});

describe("timings", () => {
  it("summarise as count, median, 95th percentile and maximum, then reset", () => {
    const { metrics } = setup();
    for (let i = 1; i <= 100; i++) metrics.observe("relay_ms", i);
    const { timings } = metrics.snapshot({});
    expect(timings.relay_ms).toEqual({ n: 100, p50: 51, p95: 96, max: 100 });
    expect(metrics.snapshot({}).timings).toEqual({});
  });

  it("handle one sample, and ignore values that are not sensible", () => {
    const { metrics } = setup();
    metrics.observe("x", 4.126);
    metrics.observe("x", Number.NaN);
    metrics.observe("x", -1);
    metrics.observe("x", Number.POSITIVE_INFINITY);
    expect(metrics.snapshot({}).timings.x).toEqual({ n: 1, p50: 4.13, p95: 4.13, max: 4.13 });
  });

  it("keep a bounded number of samples per interval", () => {
    const { metrics } = setup();
    for (let i = 0; i < 5_000; i++) metrics.observe("relay_ms", 1);
    expect(metrics.snapshot({}).timings.relay_ms?.n).toBe(2_000);
  });
});

describe("session length", () => {
  it("is measured from match to end by session id, and counted by reason", () => {
    const { metrics, advance } = setup();
    metrics.sessionStarted("s1");
    metrics.sessionStarted("s2");
    expect(metrics.openSessions).toBe(2);
    advance(180_000);
    metrics.sessionEnded("s1", "left");
    advance(60_000);
    metrics.sessionEnded("s2", "partner_left");
    const snap = metrics.snapshot({});
    expect(snap.counters).toMatchObject({ sessions_started: 2, "sessions_ended.left": 1, "sessions_ended.partner_left": 1 });
    expect(snap.timings.session_duration_ms).toMatchObject({ n: 2, max: 240_000 });
    expect(metrics.openSessions).toBe(0); // nothing is kept once it has ended
  });

  it("an end for a session it never saw still counts, and does not throw", () => {
    const { metrics } = setup();
    metrics.sessionEnded("unknown", "timeout");
    expect(metrics.total("sessions_ended.timeout")).toBe(1);
  });
});

describe("gauges", () => {
  it("are passed through as given", () => {
    const { metrics } = setup();
    expect(metrics.snapshot({ connections: 3, rssMb: 80 }).gauges).toEqual({ connections: 3, rssMb: 80 });
  });
});
