import { describe, expect, it } from "vitest";
import { parseSince, renderModerationSummary, summariseModerationLogs } from "../../../src/observability/moderationSummary.js";

const line = (event: string, data: Record<string, unknown> = {}, ts = "2026-11-14T10:00:00.000Z", level = "info") =>
  JSON.stringify({ ts, level, event, data });

describe("summariseModerationLogs", () => {
  it("is empty and calm for logs with nothing to review", () => {
    const summary = summariseModerationLogs([line("ws_connect"), line("session_start"), line("metrics_snapshot", { counters: {} })]);
    expect(summary.reports).toEqual({ total: 0, byCategory: {}, priority: 0 });
    expect(summary.attention).toEqual([]);
    expect(summary.period.lines).toBe(3);
  });

  it("counts reports by category and flags priority ones first", () => {
    const summary = summariseModerationLogs([
      line("report", { reason: "harassment", targetIpHashPrefix: "aaaaaaaa" }),
      line("report", { reason: "harassment", targetIpHashPrefix: "bbbbbbbb" }),
      line("report", { reason: "minor", targetIpHashPrefix: "cccccccc" }),
      line("report_priority", { reason: "minor" }),
    ]);
    expect(summary.reports).toEqual({ total: 3, byCategory: { harassment: 2, minor: 1 }, priority: 1 });
    expect(summary.attention[0]).toMatch(/1 priority report/);
    expect(summary.attention[0]).toMatch(/child-safety escalation/);
  });

  it("finds connections that were reported more than once, most first", () => {
    const summary = summariseModerationLogs([
      line("report", { reason: "spam", targetIpHashPrefix: "aaaaaaaa" }),
      line("report", { reason: "spam", targetIpHashPrefix: "bbbbbbbb" }),
      line("report", { reason: "hate", targetIpHashPrefix: "bbbbbbbb" }),
      line("report", { reason: "hate", targetIpHashPrefix: "bbbbbbbb" }),
      line("report", { reason: "hate", targetIpHashPrefix: "aaaaaaaa" }),
    ]);
    expect(summary.repeatReported).toEqual([
      { ipHashPrefix: "bbbbbbbb", reports: 3 },
      { ipHashPrefix: "aaaaaaaa", reports: 2 },
    ]);
  });

  it("lists blocks with time and prefix, and asks for a check of the reasons", () => {
    const summary = summariseModerationLogs([line("connection_blocked", { ipHashPrefix: "deadbeef" }, "2026-11-14T11:00:00.000Z", "warn")]);
    expect(summary.blocks).toEqual([{ at: "2026-11-14T11:00:00.000Z", ipHashPrefix: "deadbeef" }]);
    expect(summary.attention.join(" ")).toMatch(/blocked after reports/);
    expect(summary.attention.join(" ")).toMatch(/false reporting/);
  });

  it("lists alerts, with critical ones in the attention list by name", () => {
    const summary = summariseModerationLogs([
      line("alert", { rule: "report_spike", severity: "warning", value: 25, limit: 20 }, undefined, "warn"),
      line("alert", { rule: "service_down", severity: "critical", value: 2, limit: 2 }, undefined, "warn"),
    ]);
    expect(summary.alerts).toHaveLength(2);
    expect(summary.attention.join("\n")).toMatch(/critical alert.*service_down/);
    expect(summary.attention.join("\n")).toMatch(/other alert.*report_spike/);
  });

  it("counts automation signals by reason", () => {
    const summary = summariseModerationLogs([
      line("pow_refused", { reason: "replayed" }),
      line("pow_refused", { reason: "replayed" }),
      line("pow_refused", { reason: "insufficient" }),
      line("ws_refused", { reason: "origin" }),
      line("rate_limited", { bucket: "connect_token" }),
    ]);
    expect(summary.signals.powRefused).toEqual({ replayed: 2, insufficient: 1 });
    expect(summary.signals.connectionsRefused).toEqual({ origin: 1 });
    expect(summary.signals.rateLimited).toEqual({ connect_token: 1 });
  });

  it("ignores lines that are not logs, and keeps a bad field from becoming a new name", () => {
    const summary = summariseModerationLogs(["", "not json", "{\"no\":\"event\"}", "42", "null", "[1]", line("report", { reason: "<script>alert(1)</script>" })]);
    expect(summary.reports.byCategory).toEqual({ other: 1 }); // never printed as typed
    expect(summary.period.lines).toBe(1);
  });

  it("only believes a hash prefix that looks like one", () => {
    const summary = summariseModerationLogs([
      line("report", { reason: "spam", targetIpHashPrefix: "203.0.113.7" }),
      line("report", { reason: "spam", targetIpHashPrefix: "203.0.113.7" }),
      line("connection_blocked", { ipHashPrefix: "not-a-prefix" }),
    ]);
    expect(summary.repeatReported).toEqual([]);
    expect(summary.blocks).toEqual([]);
  });

  it("can look only at a recent period", () => {
    const summary = summariseModerationLogs(
      [
        line("report", { reason: "spam" }, "2026-11-10T10:00:00.000Z"),
        line("report", { reason: "hate" }, "2026-11-14T10:00:00.000Z"),
      ],
      { since: Date.parse("2026-11-13T00:00:00.000Z") },
    );
    expect(summary.reports.byCategory).toEqual({ hate: 1 });
    expect(summary.period.from).toBe("2026-11-14T10:00:00.000Z");
  });
});

describe("parseSince", () => {
  const now = Date.parse("2026-11-14T12:00:00.000Z");
  it("understands minutes, hours and days, and dates", () => {
    expect(parseSince("90m", now)).toBe(now - 90 * 60_000);
    expect(parseSince("24h", now)).toBe(now - 24 * 3_600_000);
    expect(parseSince("7d", now)).toBe(now - 7 * 86_400_000);
    expect(parseSince("2026-11-01", now)).toBe(Date.parse("2026-11-01"));
  });
  it("says null for anything else", () => {
    for (const bad of ["", "soon", "24", "h", "-5h", "99999d", "2026-13-45"]) expect(parseSince(bad, now), bad).toBeNull();
  });
});

describe("renderModerationSummary", () => {
  it("reads as plain sections, says when nothing needs a person, and ends with what it cannot show", () => {
    const text = renderModerationSummary(summariseModerationLogs([line("ws_connect")]));
    expect(text).toMatch(/NEEDS A PERSON\n {2}- nothing/);
    expect(text).toMatch(/REPORTS: 0 \(0 priority\)/);
    expect(text).toMatch(/no messages, addresses or names/);
  });

  it("shows what a moderator needs for a busy day", () => {
    const text = renderModerationSummary(
      summariseModerationLogs([
        line("report", { reason: "threats", targetIpHashPrefix: "aaaaaaaa" }),
        line("report", { reason: "threats", targetIpHashPrefix: "aaaaaaaa" }),
        line("report_priority", { reason: "threats" }),
        line("connection_blocked", { ipHashPrefix: "aaaaaaaa" }),
      ]),
    );
    expect(text).toMatch(/priority report/);
    expect(text).toMatch(/threats\s+2/);
    expect(text).toMatch(/aaaaaaaa\s+2 reports/);
    expect(text).toMatch(/BLOCKS: 1/);
  });
});
