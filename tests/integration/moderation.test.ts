import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { renderModerationSummary, summariseModerationLogs } from "../../src/observability/moderationSummary.js";
import { command, connect, next, startServer } from "./helpers.js";
import type { Matched, TestServer } from "./helpers.js";

let server: TestServer;
afterEach(async () => {
  await server?.close();
});

const from = (address: string) => ({ forwardedFor: address });
const start = (s: Parameters<typeof command>[0]) => command(s, "session:start", {});

describe("the moderator summary of real server logs", () => {
  it("reflects reports, a priority report and a block, and nothing personal", async () => {
    server = await startServer({ TRUST_PROXY_HOPS: "1" });
    const bad = await connect(server, from("9.9.9.9"));
    const categories = ["harassment", "minor", "harassment"];
    for (const [i, ip] of ["3.0.0.1", "3.0.0.2", "3.0.0.3"].entries()) {
      const reporter = await connect(server, from(ip));
      const matched = next<Matched>(bad, "session:matched");
      await start(bad);
      await start(reporter);
      await matched;
      await reporter.timeout(2000).emitWithAck("session:report", { reason: categories[i] });
    }
    await connect(server, { origin: "https://evil.example" }).catch(() => {});

    const summary = summariseModerationLogs(server.logs);
    expect(summary.reports.total).toBe(3);
    expect(summary.reports.byCategory).toEqual({ harassment: 2, minor: 1 });
    expect(summary.reports.priority).toBe(1);
    expect(summary.blocks).toHaveLength(1);
    expect(summary.repeatReported).toEqual([{ ipHashPrefix: summary.blocks[0]!.ipHashPrefix, reports: 3 }]);
    expect(summary.signals.connectionsRefused).toEqual({ origin: 1 });
    expect(summary.attention[0]).toMatch(/priority report/);

    // What is shown cannot identify anyone.
    const shown = renderModerationSummary(summary) + JSON.stringify(summary);
    for (const secret of ["9.9.9.9", "3.0.0.1", "3.0.0.2", "3.0.0.3", "evil.example"]) expect(shown).not.toContain(secret);
    expect(shown).not.toMatch(/[0-9a-f]{9,}/); // nothing longer than the 8 character prefix
  });

  it("works from the command line on a log file, as plain text and as JSON", async () => {
    server = await startServer({ TRUST_PROXY_HOPS: "1" });
    const a = await connect(server, from("1.1.1.1"));
    const b = await connect(server, from("2.2.2.2"));
    const matched = next<Matched>(a, "session:matched");
    await start(a);
    await start(b);
    await matched;
    await b.timeout(2000).emitWithAck("session:report", { reason: "threats" });

    const dir = mkdtempSync(path.join(tmpdir(), "moderation-"));
    try {
      const file = path.join(dir, "server.log");
      writeFileSync(file, `${server.logs.join("\n")}\nthis line is not json\n`);
      const run = (...args: string[]) =>
        spawnSync(process.execPath, ["--import", "tsx", "scripts/moderation-report.ts", ...args], { encoding: "utf8" });

      const text = run(file);
      expect(text.status).toBe(0);
      expect(text.stdout).toMatch(/MODERATION SUMMARY/);
      expect(text.stdout).toMatch(/1 priority report/);
      expect(text.stdout).toMatch(/threats\s+1/);

      const json = run(file, "--json", "--since", "2025-12-31");
      expect(json.status).toBe(0);
      expect(JSON.parse(json.stdout).reports.byCategory).toEqual({ threats: 1 });

      const none = run(file, "--since", "2020-01-01T00:00:00Z");
      expect(none.status).toBe(0);
      const future = run(file, "--since", "2999-01-01");
      expect(future.stdout).toMatch(/0 log lines/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("explains itself when used wrongly, and fails with a clear code", () => {
    const run = (...args: string[]) =>
      spawnSync(process.execPath, ["--import", "tsx", "scripts/moderation-report.ts", ...args], { encoding: "utf8" });
    expect(run().status).toBe(2);
    expect(run().stderr).toMatch(/usage/);
    expect(run("does-not-exist.log").status).toBe(2);
    expect(run("does-not-exist.log").stderr).toMatch(/could not read/);
    expect(run("package.json", "--since", "soon").status).toBe(2);
  });
});

