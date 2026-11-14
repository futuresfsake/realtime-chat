import type { Clock } from "../lib/clock.js";

// Counts how many DIFFERENT people reported the same connection recently
// (US-20). Both sides are identified by their keyed IP hash, so one person
// opening three tabs and reporting three times is still one reporter.
// Held in memory only, bounded, and forgotten after the window.
export class ReportTracker {
  // target hash -> (reporter hash -> when that reporter last reported)
  private readonly byTarget = new Map<string, Map<string, number>>();

  constructor(
    private readonly clock: Clock,
    private readonly windowMs: number,
    private readonly threshold: number,
    private readonly maxTargets = 5_000, // memory bound on a small instance
  ) {}

  get size(): number {
    return this.byTarget.size;
  }

  // Records one report and says whether the target has now reached the
  // threshold. A report about yourself or about someone on your own address
  // (same hash) is not counted: you cannot get a neighbour blocked alone.
  record(targetHash: string, reporterHash: string): { distinctReporters: number; reachedThreshold: boolean } {
    if (targetHash === reporterHash) return { distinctReporters: 0, reachedThreshold: false };
    const now = this.clock.now();
    this.purge(now);

    let reporters = this.byTarget.get(targetHash);
    if (!reporters) {
      reporters = new Map();
      this.byTarget.set(targetHash, reporters);
      // Over the bound: forget the oldest targets first rather than grow without limit.
      while (this.byTarget.size > this.maxTargets) {
        const oldest = this.byTarget.keys().next().value;
        if (oldest === undefined) break;
        this.byTarget.delete(oldest);
      }
    }
    reporters.set(reporterHash, now);
    const distinct = this.countLive(reporters, now);
    return { distinctReporters: distinct, reachedThreshold: distinct >= this.threshold };
  }

  // Forget everything about a target (once it has been blocked, the count starts again).
  clear(targetHash: string): void {
    this.byTarget.delete(targetHash);
  }

  private countLive(reporters: Map<string, number>, now: number): number {
    let live = 0;
    for (const [reporter, at] of reporters) {
      if (now - at >= this.windowMs) reporters.delete(reporter);
      else live++;
    }
    return live;
  }

  private purge(now: number): void {
    for (const [target, reporters] of this.byTarget) {
      if (this.countLive(reporters, now) === 0) this.byTarget.delete(target);
    }
  }
}
