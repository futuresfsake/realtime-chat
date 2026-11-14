import type { Logger } from "./logger.js";
import type { MetricsSnapshot } from "./metrics.js";

export type AlertSeverity = "critical" | "warning" | "info";

export interface AlertThresholds {
  memoryCeilingMb: number;
  intervalMs: number; // how often snapshots arrive, to turn minutes into snapshot counts
}

interface Rule {
  name: string;
  severity: AlertSeverity;
  windowMs: number;
  // Looks at the snapshots inside the window (oldest first). Returns the
  // measured value and the limit, and whether the rule is breached.
  check(window: MetricsSnapshot[], t: AlertThresholds): { value: number; limit: number; breached: boolean };
}

const sum = (window: MetricsSnapshot[], pick: (s: MetricsSnapshot) => number) =>
  window.reduce((total, s) => total + pick(s), 0);
const sumPrefix = (s: MetricsSnapshot, prefix: string) =>
  Object.entries(s.counters).reduce((total, [name, n]) => (name.startsWith(prefix) ? total + n : total), 0);
const MINUTE = 60_000;

// The alert rules from docs/06-operations/monitoring-observability.md section 6.
// Each is evaluated on every snapshot. A rule that becomes true writes ONE
// warning-level `alert` log line (so a log platform or a person watching can
// alert on it) and one `alert_cleared` line when it stops. It never repeats
// while the condition lasts. An alert carries a rule name and two numbers.
const RULES: Rule[] = [
  {
    name: "high_memory",
    severity: "warning",
    windowMs: 5 * MINUTE,
    check: (window, t) => {
      const needed = Math.max(1, Math.round((5 * MINUTE) / t.intervalMs));
      const recent = window.slice(-needed);
      const lowest = Math.min(...recent.map((s) => s.gauges.rssMb ?? 0));
      return { value: lowest, limit: t.memoryCeilingMb, breached: recent.length >= needed && lowest > t.memoryCeilingMb };
    },
  },
  {
    name: "connection_spike",
    severity: "warning",
    windowMs: MINUTE,
    check: (window) => {
      const value = sum(window.slice(-1), (s) => s.counters.ws_connected ?? 0);
      return { value, limit: 200, breached: value > 200 };
    },
  },
  {
    name: "report_spike",
    severity: "warning",
    windowMs: 10 * MINUTE,
    check: (window) => {
      const value = sum(window, (s) => sumPrefix(s, "reports."));
      return { value, limit: 20, breached: value > 20 };
    },
  },
  {
    name: "error_rate",
    severity: "warning",
    windowMs: 5 * MINUTE,
    check: (window) => {
      const events = sum(window, (s) => s.counters.events_total ?? 0);
      const errors = sum(window, (s) => s.counters.events_rejected ?? 0);
      const rate = events === 0 ? 0 : (errors / events) * 100;
      // Needs a minimum of traffic, or one bad event in a quiet hour would raise it.
      return { value: Math.round(rate * 10) / 10, limit: 5, breached: events >= 20 && rate > 5 };
    },
  },
  {
    name: "crypto_failures",
    severity: "warning",
    windowMs: 5 * MINUTE,
    check: (window) => {
      const value = sum(window, (s) => s.counters["sessions_ended.crypto_timeout"] ?? 0);
      return { value, limit: 3, breached: value > 3 };
    },
  },
  {
    name: "ban_surge",
    severity: "info",
    windowMs: 60 * MINUTE,
    check: (window) => {
      const value = sum(window, (s) => s.counters.blocks ?? 0);
      return { value, limit: 10, breached: value > 10 };
    },
  },
];

export class Alerts {
  private readonly history: MetricsSnapshot[] = [];
  private readonly active = new Set<string>();
  private readonly maxWindowMs = Math.max(...RULES.map((r) => r.windowMs));

  constructor(
    private readonly logger: Logger,
    private readonly thresholds: AlertThresholds,
  ) {}

  get activeAlerts(): string[] {
    return [...this.active];
  }

  evaluate(snapshot: MetricsSnapshot): void {
    this.history.push(snapshot);
    const keep = Math.ceil(this.maxWindowMs / this.thresholds.intervalMs);
    while (this.history.length > keep) this.history.shift();

    for (const rule of RULES) {
      const take = Math.max(1, Math.ceil(rule.windowMs / this.thresholds.intervalMs));
      const { value, limit, breached } = rule.check(this.history.slice(-take), this.thresholds);
      const wasActive = this.active.has(rule.name);
      if (breached && !wasActive) {
        this.active.add(rule.name);
        this.logger.warn("alert", { data: { rule: rule.name, severity: rule.severity, value, limit } });
      } else if (!breached && wasActive) {
        this.active.delete(rule.name);
        this.logger.info("alert_cleared", { data: { rule: rule.name } });
      }
    }
  }
}
