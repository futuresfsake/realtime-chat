// In-process counters and timings (US-41). Everything is a number: no names,
// no addresses, no content, no countries, no interests. A name is always one of
// a small fixed set (an event, an error code, a report category), never
// something a client typed, so the set cannot grow without bound.
//
// Once a minute the server logs a snapshot of what happened since the last
// one. That log line is the whole monitoring interface: a log platform, an
// operator with `jq`, or the alert rules in alerts.ts read it.

export interface TimingSummary {
  n: number;
  p50: number;
  p95: number;
  max: number;
}

export interface MetricsSnapshot {
  intervalSec: number;
  counters: Record<string, number>; // what happened since the last snapshot
  totals: Record<string, number>; // since the server started
  timings: Record<string, TimingSummary>; // milliseconds, since the last snapshot
  gauges: Record<string, number>; // how things are right now
}

const MAX_NAMES = 200; // a safety net against a bug that builds names from input
const MAX_SAMPLES = 2_000; // per timing, per interval

function summarise(samples: number[]): TimingSummary {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  return { n: sorted.length, p50: round(at(0.5)), p95: round(at(0.95)), max: round(sorted[sorted.length - 1] ?? 0) };
}
const round = (n: number) => Math.round(n * 100) / 100;

export class Metrics {
  private readonly totals = new Map<string, number>();
  private interval = new Map<string, number>();
  private samples = new Map<string, number[]>();
  private readonly sessionStarts = new Map<string, number>();
  private lastSnapshotAt: number;

  // `now` is a millisecond clock for durations (real time in production, a
  // fake in tests).
  constructor(private readonly now: () => number = () => performance.now()) {
    this.lastSnapshotAt = now();
  }

  count(name: string, by = 1): void {
    if (!this.totals.has(name) && this.totals.size >= MAX_NAMES) return;
    this.totals.set(name, (this.totals.get(name) ?? 0) + by);
    this.interval.set(name, (this.interval.get(name) ?? 0) + by);
  }

  total(name: string): number {
    return this.totals.get(name) ?? 0;
  }

  // A duration or size in milliseconds (or any number).
  observe(name: string, value: number): void {
    if (!Number.isFinite(value) || value < 0) return;
    let list = this.samples.get(name);
    if (!list) {
      if (this.samples.size >= MAX_NAMES) return;
      list = [];
      this.samples.set(name, list);
    }
    if (list.length < MAX_SAMPLES) list.push(value);
  }

  // Session length is measured from the match to the end, by session id. Only
  // the id (a random value) and a start time are held, and only until it ends.
  sessionStarted(sessionId: string): void {
    this.count("sessions_started");
    this.sessionStarts.set(sessionId, this.now());
  }

  sessionEnded(sessionId: string, reason: string): void {
    this.count(`sessions_ended.${reason}`);
    const started = this.sessionStarts.get(sessionId);
    if (started === undefined) return;
    this.sessionStarts.delete(sessionId);
    this.observe("session_duration_ms", this.now() - started);
  }

  get openSessions(): number {
    return this.sessionStarts.size;
  }

  // What happened since the last call, plus how things are now. Starts a new interval.
  snapshot(gauges: Record<string, number>): MetricsSnapshot {
    const at = this.now();
    const snapshot: MetricsSnapshot = {
      intervalSec: Math.round((at - this.lastSnapshotAt) / 1000),
      counters: Object.fromEntries(this.interval),
      totals: Object.fromEntries(this.totals),
      timings: Object.fromEntries([...this.samples].map(([name, list]) => [name, summarise(list)])),
      gauges,
    };
    this.interval = new Map();
    this.samples = new Map();
    this.lastSnapshotAt = at;
    return snapshot;
  }
}
