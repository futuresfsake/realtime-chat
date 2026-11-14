import { describe, expect, it } from "vitest";
import { Alerts } from "../../../src/observability/alerts.js";
import type { Logger } from "../../../src/observability/logger.js";
import type { MetricsSnapshot } from "../../../src/observability/metrics.js";

const INTERVAL = 60_000;

function setup(memoryCeilingMb = 400) {
  const lines: { level: string; event: string; data: Record<string, unknown> }[] = [];
  const log =
    (level: string) =>
    (event: string, fields?: { data?: Record<string, unknown> }) =>
      void lines.push({ level, event, data: fields?.data ?? {} });
  const logger = { error: log("error"), warn: log("warn"), info: log("info"), debug: log("debug") } as Logger;
  const alerts = new Alerts(logger, { memoryCeilingMb, intervalMs: INTERVAL });
  const snap = (counters: Record<string, number> = {}, gauges: Record<string, number> = {}): MetricsSnapshot => ({
    intervalSec: 60,
    counters,
    totals: {},
    timings: {},
    gauges: { rssMb: 100, ...gauges },
  });
  return { lines, alerts, snap };
}
const raised = (lines: { event: string; data: Record<string, unknown> }[]) =>
  lines.filter((l) => l.event === "alert").map((l) => l.data.rule);

describe("alert rules", () => {
  it("say nothing on a quiet, healthy server", () => {
    const { alerts, lines, snap } = setup();
    for (let i = 0; i < 20; i++) alerts.evaluate(snap({ ws_connected: 3, events_total: 40, events_rejected: 1 }));
    expect(lines).toEqual([]);
  });

  it("connection_spike: more than 200 new connections in a minute", () => {
    const { alerts, lines, snap } = setup();
    alerts.evaluate(snap({ ws_connected: 200 }));
    expect(raised(lines)).toEqual([]);
    alerts.evaluate(snap({ ws_connected: 201 }));
    expect(lines.at(-1)).toMatchObject({
      level: "warn",
      event: "alert",
      data: { rule: "connection_spike", severity: "warning", value: 201, limit: 200 },
    });
  });

  it("report_spike: more than 20 reports in 10 minutes, added up across categories", () => {
    const { alerts, lines, snap } = setup();
    for (let i = 0; i < 10; i++) alerts.evaluate(snap({ "reports.harassment": 1, "reports.spam": 1 })); // 20: not over
    expect(raised(lines)).toEqual([]);
    alerts.evaluate(snap({ "reports.hate": 5 }));
    expect(raised(lines)).toContain("report_spike");
  });

  it("report_spike forgets reports older than ten minutes and clears", () => {
    const { alerts, lines, snap } = setup();
    alerts.evaluate(snap({ "reports.spam": 25 }));
    expect(raised(lines)).toEqual(["report_spike"]);
    for (let i = 0; i < 10; i++) alerts.evaluate(snap());
    expect(lines.some((l) => l.event === "alert_cleared" && l.data.rule === "report_spike")).toBe(true);
  });

  it("error_rate: over 5 percent of events rejected, but only with enough traffic", () => {
    const { alerts, lines, snap } = setup();
    alerts.evaluate(snap({ events_total: 10, events_rejected: 10 })); // 100 percent but only 10 events
    expect(raised(lines)).toEqual([]);
    alerts.evaluate(snap({ events_total: 100, events_rejected: 2 })); // 12 of 110, about 10.9 percent
    expect(raised(lines)).toEqual(["error_rate"]);
    expect(lines.at(-1)?.data).toMatchObject({ rule: "error_rate", limit: 5 });
  });

  it("crypto_failures: more than 3 chats that could not be secured in 5 minutes", () => {
    const { alerts, lines, snap } = setup();
    alerts.evaluate(snap({ "sessions_ended.crypto_timeout": 3 }));
    expect(raised(lines)).toEqual([]);
    alerts.evaluate(snap({ "sessions_ended.crypto_timeout": 1 }));
    expect(raised(lines)).toEqual(["crypto_failures"]);
  });

  it("ban_surge: more than 10 blocks in an hour, at info level", () => {
    const { alerts, lines, snap } = setup();
    alerts.evaluate(snap({ blocks: 11 }));
    expect(lines.at(-1)).toMatchObject({ event: "alert", data: { rule: "ban_surge", severity: "info" } });
  });

  it("high_memory: above the ceiling for five snapshots in a row, not for one spike", () => {
    const { alerts, lines, snap } = setup(400);
    for (let i = 0; i < 4; i++) alerts.evaluate(snap({}, { rssMb: 450 }));
    expect(raised(lines)).toEqual([]);
    alerts.evaluate(snap({}, { rssMb: 100 })); // it dips: the run is broken
    for (let i = 0; i < 4; i++) alerts.evaluate(snap({}, { rssMb: 450 }));
    expect(raised(lines)).toEqual([]);
    alerts.evaluate(snap({}, { rssMb: 450 }));
    expect(raised(lines)).toEqual(["high_memory"]);
  });
});

describe("alert behaviour", () => {
  it("raises once while a condition lasts, and says when it clears", () => {
    const { alerts, lines, snap } = setup();
    alerts.evaluate(snap({ ws_connected: 500 }));
    alerts.evaluate(snap({ ws_connected: 500 }));
    alerts.evaluate(snap({ ws_connected: 500 }));
    expect(raised(lines)).toEqual(["connection_spike"]); // not three times
    expect(alerts.activeAlerts).toEqual(["connection_spike"]);
    alerts.evaluate(snap({ ws_connected: 5 }));
    expect(lines.at(-1)).toMatchObject({ level: "info", event: "alert_cleared", data: { rule: "connection_spike" } });
    expect(alerts.activeAlerts).toEqual([]);
    alerts.evaluate(snap({ ws_connected: 500 })); // and it can be raised again
    expect(raised(lines)).toEqual(["connection_spike", "connection_spike"]);
  });

  it("an alert carries only a rule, a severity and two numbers", () => {
    const { alerts, lines, snap } = setup();
    alerts.evaluate(snap({ ws_connected: 500 }));
    expect(Object.keys(lines[0]!.data).sort()).toEqual(["limit", "rule", "severity", "value"]);
  });
});
