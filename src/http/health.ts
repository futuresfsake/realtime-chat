import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { PROTOCOL_VERSION } from "../types/events.js";

type CheckState = "ok" | "degraded";

export interface HealthDeps {
  isShuttingDown: () => boolean;
  connectionCount: () => number;
  rssBytes: () => number;
  maxConnections: number;
  memoryCeilingMb: number;
  // When set, exact numbers are returned only to callers that send this key
  // in the "x-health-key" header. Everyone else sees ok/degraded only.
  healthKey: string | undefined;
  alwaysShowDetails: boolean; // true outside production
}

const DEGRADED_AT = 0.8;

// GET /health
//   200 ok        everything normal
//   200 degraded  memory or connections above 80% of their limit
//   503 unhealthy shutting down: the platform must stop sending traffic here
// The public answer is deliberately coarse: exact counts help an attacker
// measure the effect of a flood.
export function healthRoute(deps: HealthDeps) {
  return (req: Request, res: Response): void => {
    res.set("Cache-Control", "no-store");

    if (deps.isShuttingDown()) {
      res.status(503).json({ status: "unhealthy", reason: "shutting_down", version: PROTOCOL_VERSION });
      return;
    }

    const rssMb = deps.rssBytes() / (1024 * 1024);
    const connections = deps.connectionCount();
    const checks: Record<"memory" | "connections" | "socketio", CheckState> = {
      memory: rssMb > deps.memoryCeilingMb * DEGRADED_AT ? "degraded" : "ok",
      connections: connections > deps.maxConnections * DEGRADED_AT ? "degraded" : "ok",
      socketio: "ok",
    };
    const status: CheckState = Object.values(checks).includes("degraded") ? "degraded" : "ok";

    const body: Record<string, unknown> = { status, checks, version: PROTOCOL_VERSION };
    if (deps.alwaysShowDetails || hasValidKey(req, deps.healthKey)) {
      body.details = {
        rssMb: Math.round(rssMb),
        memoryCeilingMb: deps.memoryCeilingMb,
        connections,
        maxConnections: deps.maxConnections,
        uptimeSec: Math.round(process.uptime()),
      };
    }
    res.status(200).json(body);
  };
}

function hasValidKey(req: Request, expected: string | undefined): boolean {
  if (!expected) return false;
  const given = req.get("x-health-key");
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
