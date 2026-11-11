import { describe, expect, it } from "vitest";
import { FakeClock } from "../../../src/lib/clock.js";
import { createLogger } from "../../../src/observability/logger.js";

function capture(level: "error" | "warn" | "info" | "debug" = "info") {
  const lines: string[] = [];
  const logger = createLogger({ level, write: (line) => lines.push(line), clock: new FakeClock(0) });
  return { logger, lines, last: () => JSON.parse(lines[lines.length - 1] ?? "{}") as Record<string, any> };
}

describe("createLogger", () => {
  it("writes one JSON object per line with ts, level, event, correlationId and data", () => {
    const { logger, lines, last } = capture();
    logger.info("ws_connect", { correlationId: "abc12345", data: { connectionCount: 3 } });
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("\n");
    expect(last()).toEqual({
      ts: "1970-01-01T00:00:00.000Z",
      level: "info",
      event: "ws_connect",
      correlationId: "abc12345",
      data: { connectionCount: 3 },
    });
  });

  it("drops lines below the configured level", () => {
    const { logger, lines } = capture("warn");
    logger.debug("a");
    logger.info("b");
    logger.warn("c");
    logger.error("d");
    expect(lines.map((line) => JSON.parse(line).event)).toEqual(["c", "d"]);
  });

  it("redacts fields that could hold personal data or content, at any depth", () => {
    const { logger, lines, last } = capture();
    logger.info("oops", {
      data: {
        ip: "203.0.113.7",
        text: "my number is 0917",
        userAgent: "Mozilla",
        ipHash: "f".repeat(64),
        nested: { remoteAddress: "203.0.113.7", list: [{ token: "t0k3n" }] },
        ipHashPrefix: "abcdef01",
      },
    });
    expect(lines[0]).not.toContain("203.0.113.7");
    expect(lines[0]).not.toContain("0917");
    expect(lines[0]).not.toContain("Mozilla");
    expect(lines[0]).not.toContain("t0k3n");
    expect(last().data.ipHashPrefix).toBe("abcdef01");
    expect(last().data.ip).toBe("[redacted]");
  });

  it("describes errors by name and stack", () => {
    const { logger, last } = capture();
    logger.error("event_failed", { err: new TypeError("bad") });
    expect(last().err.name).toBe("TypeError");
    expect(last().err.stack).toContain("TypeError");
  });

  it("does not serialise non-Error throwables (they could be user data)", () => {
    const { logger, lines, last } = capture();
    logger.error("event_failed", { err: "user supplied string" });
    expect(last().err).toEqual({ name: "NonError" });
    expect(lines[0]).not.toContain("user supplied");
  });
});
