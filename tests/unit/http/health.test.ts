import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { healthRoute } from "../../../src/http/health.js";
import type { HealthDeps } from "../../../src/http/health.js";

const MB = 1024 * 1024;

function call(overrides: Partial<HealthDeps> = {}, headers: Record<string, string> = {}) {
  const deps: HealthDeps = {
    isShuttingDown: () => false,
    connectionCount: () => 10,
    rssBytes: () => 100 * MB,
    maxConnections: 500,
    memoryCeilingMb: 400,
    healthKey: undefined,
    alwaysShowDetails: false,
    ...overrides,
  };
  const out: { status: number; body: Record<string, any>; headers: Record<string, string> } = {
    status: 0,
    body: {},
    headers: {},
  };
  const res = {
    set(name: string, value: string) {
      out.headers[name.toLowerCase()] = value;
      return res;
    },
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: Record<string, any>) {
      out.body = body;
      return res;
    },
  };
  const req = { get: (name: string) => headers[name.toLowerCase()] };
  healthRoute(deps)(req as unknown as Request, res as unknown as Response);
  return out;
}

describe("healthRoute", () => {
  it("returns 200 ok when everything is within limits", () => {
    const out = call();
    expect(out.status).toBe(200);
    expect(out.body.status).toBe("ok");
    expect(out.headers["cache-control"]).toBe("no-store");
    expect(out.body.details).toBeUndefined();
  });

  it("returns 200 degraded when memory passes 80% of the ceiling", () => {
    const out = call({ rssBytes: () => 321 * MB });
    expect(out.status).toBe(200);
    expect(out.body.status).toBe("degraded");
    expect(out.body.checks.memory).toBe("degraded");
    expect(out.body.checks.connections).toBe("ok");
  });

  it("returns 200 degraded when connections pass 80% of the maximum", () => {
    const out = call({ connectionCount: () => 401 });
    expect(out.body.status).toBe("degraded");
    expect(out.body.checks.connections).toBe("degraded");
  });

  it("returns 503 unhealthy while shutting down", () => {
    const out = call({ isShuttingDown: () => true });
    expect(out.status).toBe(503);
    expect(out.body.status).toBe("unhealthy");
    expect(out.headers["cache-control"]).toBe("no-store");
  });

  it("shows exact numbers only with the right key", () => {
    const key = "k".repeat(24);
    expect(call({ healthKey: key }).body.details).toBeUndefined();
    expect(call({ healthKey: key }, { "x-health-key": "wrong" }).body.details).toBeUndefined();
    expect(call({ healthKey: key }, { "x-health-key": key }).body.details).toMatchObject({
      rssMb: 100,
      connections: 10,
    });
  });
});
