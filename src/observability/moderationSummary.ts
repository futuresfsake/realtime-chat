// What a moderator needs, worked out from the server's own logs (US-31). It
// reads log lines and nothing else: it never talks to the server, so it can
// only ever show what the logs already contain, which is a category, a count,
// a time and an 8 character hash prefix. There are no messages, no addresses
// and no names in the logs, so there are none here.
//
// It is a pure function over lines, so it can be tested without a server, and
// the command-line wrapper (scripts/moderation-report.ts) is only plumbing.

export interface ModerationSummary {
  period: { from: string | null; to: string | null; lines: number };
  reports: {
    total: number;
    byCategory: Record<string, number>;
    priority: number; // minor and threats: need a person today
  };
  // Connections that several reports named. A prefix is only 8 characters, so
  // two different connections can share one: treat it as a hint, not proof.
  repeatReported: { ipHashPrefix: string; reports: number }[];
  blocks: { at: string; ipHashPrefix: string }[];
  alerts: { at: string; rule: string; severity: string; value: number; limit: number }[];
  signals: {
    powRefused: Record<string, number>;
    connectionsRefused: Record<string, number>;
    rateLimited: Record<string, number>;
  };
  // Plain sentences, most urgent first. Empty when nothing needs a person.
  attention: string[];
}

interface LogLine {
  ts?: unknown;
  event?: unknown;
  data?: Record<string, unknown>;
}

const bump = (bag: Record<string, number>, key: unknown) => {
  const name = typeof key === "string" && /^[A-Za-z0-9_.-]{1,40}$/.test(key) ? key : "other";
  bag[name] = (bag[name] ?? 0) + 1;
};

// "24h", "7d", "90m", or a date. Returns epoch ms, or null if not understood.
export function parseSince(value: string, now: number): number | null {
  const relative = /^(\d{1,4})([mhd])$/.exec(value);
  if (relative) {
    const unit = { m: 60_000, h: 3_600_000, d: 86_400_000 }[relative[2] as "m" | "h" | "d"];
    return now - Number(relative[1]) * unit;
  }
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : date;
}

export function summariseModerationLogs(lines: Iterable<string>, options: { since?: number } = {}): ModerationSummary {
  const summary: ModerationSummary = {
    period: { from: null, to: null, lines: 0 },
    reports: { total: 0, byCategory: {}, priority: 0 },
    repeatReported: [],
    blocks: [],
    alerts: [],
    signals: { powRefused: {}, connectionsRefused: {}, rateLimited: {} },
    attention: [],
  };
  const perTarget = new Map<string, number>();

  for (const raw of lines) {
    let line: LogLine;
    try {
      line = JSON.parse(raw) as LogLine;
    } catch {
      continue; // not a log line (a blank line, a stack trace)
    }
    if (typeof line !== "object" || line === null || typeof line.event !== "string") continue;
    const at = typeof line.ts === "string" ? line.ts : null;
    const time = at ? Date.parse(at) : Number.NaN;
    if (options.since !== undefined && !(time >= options.since)) continue;

    summary.period.lines++;
    if (at) {
      if (summary.period.from === null || at < summary.period.from) summary.period.from = at;
      if (summary.period.to === null || at > summary.period.to) summary.period.to = at;
    }
    const data = line.data ?? {};

    switch (line.event) {
      case "report": {
        summary.reports.total++;
        bump(summary.reports.byCategory, data.reason);
        const prefix = data.targetIpHashPrefix;
        if (typeof prefix === "string" && /^[0-9a-f]{8}$/.test(prefix)) perTarget.set(prefix, (perTarget.get(prefix) ?? 0) + 1);
        break;
      }
      case "report_priority":
        summary.reports.priority++;
        break;
      case "connection_blocked":
        if (at && typeof data.ipHashPrefix === "string" && /^[0-9a-f]{8}$/.test(data.ipHashPrefix)) {
          summary.blocks.push({ at, ipHashPrefix: data.ipHashPrefix });
        }
        break;
      case "alert":
        if (at && typeof data.rule === "string") {
          summary.alerts.push({
            at,
            rule: data.rule,
            severity: typeof data.severity === "string" ? data.severity : "warning",
            value: typeof data.value === "number" ? data.value : 0,
            limit: typeof data.limit === "number" ? data.limit : 0,
          });
        }
        break;
      case "pow_refused":
        bump(summary.signals.powRefused, data.reason);
        break;
      case "ws_refused":
        bump(summary.signals.connectionsRefused, data.reason);
        break;
      case "rate_limited":
        bump(summary.signals.rateLimited, data.bucket);
        break;
    }
  }

  summary.repeatReported = [...perTarget]
    .filter(([, reports]) => reports >= 2)
    .map(([ipHashPrefix, reports]) => ({ ipHashPrefix, reports }))
    .sort((a, b) => b.reports - a.reports);

  // What needs a person, most urgent first.
  if (summary.reports.priority > 0) {
    summary.attention.push(
      `${summary.reports.priority} priority report(s) (a possible minor or a threat of harm). Review today, and follow the child-safety escalation procedure.`,
    );
  }
  const critical = summary.alerts.filter((a) => a.severity === "critical");
  if (critical.length > 0) summary.attention.push(`${critical.length} critical alert(s): ${[...new Set(critical.map((a) => a.rule))].join(", ")}.`);
  if (summary.blocks.length > 0) {
    summary.attention.push(`${summary.blocks.length} connection(s) were blocked after reports. Check the reasons are genuine and that none looks like coordinated false reporting.`);
  }
  if (summary.repeatReported.length > 0) {
    summary.attention.push(`${summary.repeatReported.length} connection(s) were reported more than once.`);
  }
  const warnings = summary.alerts.filter((a) => a.severity !== "critical");
  if (warnings.length > 0) summary.attention.push(`${warnings.length} other alert(s): ${[...new Set(warnings.map((a) => a.rule))].join(", ")}.`);

  return summary;
}

const table = (bag: Record<string, number>) =>
  Object.entries(bag)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `    ${name.padEnd(24)} ${count}`)
    .join("\n") || "    none";

export function renderModerationSummary(summary: ModerationSummary): string {
  const { period, reports, repeatReported, blocks, alerts, signals, attention } = summary;
  const out: string[] = [];
  out.push("MODERATION SUMMARY");
  out.push(`  ${period.lines} log lines, ${period.from ?? "n/a"} to ${period.to ?? "n/a"}`);
  out.push("");
  out.push("NEEDS A PERSON");
  out.push(attention.length > 0 ? attention.map((line) => `  - ${line}`).join("\n") : "  - nothing");
  out.push("");
  out.push(`REPORTS: ${reports.total} (${reports.priority} priority)`);
  out.push(table(reports.byCategory));
  if (repeatReported.length > 0) {
    out.push("");
    out.push("REPORTED MORE THAN ONCE (8 character prefix, a hint and not proof)");
    out.push(repeatReported.map((r) => `    ${r.ipHashPrefix}   ${r.reports} reports`).join("\n"));
  }
  out.push("");
  out.push(`BLOCKS: ${blocks.length}`);
  if (blocks.length > 0) out.push(blocks.map((b) => `    ${b.at}  ${b.ipHashPrefix}`).join("\n"));
  out.push("");
  out.push(`ALERTS: ${alerts.length}`);
  if (alerts.length > 0) out.push(alerts.map((a) => `    ${a.at}  ${a.severity.padEnd(8)} ${a.rule} (${a.value} against ${a.limit})`).join("\n"));
  out.push("");
  out.push("AUTOMATION SIGNALS");
  out.push("  puzzle refusals");
  out.push(table(signals.powRefused));
  out.push("  connections refused");
  out.push(table(signals.connectionsRefused));
  out.push("  rate limited");
  out.push(table(signals.rateLimited));
  out.push("");
  out.push("There are no messages, addresses or names in this report: the server never has them.");
  return out.join("\n");
}
