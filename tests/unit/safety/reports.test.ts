import { describe, expect, it } from "vitest";
import { FakeClock } from "../../../src/lib/clock.js";
import { REPORT_CATEGORIES, PRIORITY_CATEGORIES } from "../../../src/safety/categories.js";
import { BanList } from "../../../src/safety/bans.js";
import { ReportTracker } from "../../../src/safety/reports.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function tracker(max?: number) {
  const clock = new FakeClock(1_000_000);
  return { clock, t: new ReportTracker(clock, HOUR, 3, max) };
}

describe("ReportTracker", () => {
  it("one or two different reporters do not reach the threshold; the third does", () => {
    const { t } = tracker();
    expect(t.record("bad", "r1")).toEqual({ distinctReporters: 1, reachedThreshold: false });
    expect(t.record("bad", "r2")).toEqual({ distinctReporters: 2, reachedThreshold: false });
    expect(t.record("bad", "r3")).toEqual({ distinctReporters: 3, reachedThreshold: true });
  });

  it("the same reporter three times is still one reporter", () => {
    const { t } = tracker();
    for (let i = 0; i < 5; i++) expect(t.record("bad", "r1").reachedThreshold).toBe(false);
    expect(t.record("bad", "r1").distinctReporters).toBe(1);
  });

  it("counts each target separately", () => {
    const { t } = tracker();
    t.record("a", "r1");
    t.record("a", "r2");
    expect(t.record("b", "r3").distinctReporters).toBe(1);
  });

  it("reports older than the window stop counting, one by one", () => {
    const { clock, t } = tracker();
    t.record("bad", "r1");
    clock.advance(HOUR / 2);
    t.record("bad", "r2");
    clock.advance(HOUR / 2); // r1's report is now exactly an hour old: gone
    expect(t.record("bad", "r3")).toEqual({ distinctReporters: 2, reachedThreshold: false });
  });

  it("three reports spread over more than an hour never add up", () => {
    const { clock, t } = tracker();
    t.record("bad", "r1");
    clock.advance(HOUR);
    t.record("bad", "r2");
    clock.advance(HOUR);
    expect(t.record("bad", "r3").reachedThreshold).toBe(false);
  });

  it("a report about someone on your own address is not counted", () => {
    const { t } = tracker();
    expect(t.record("same", "same")).toEqual({ distinctReporters: 0, reachedThreshold: false });
    expect(t.size).toBe(0);
  });

  it("clear() starts the count again", () => {
    const { t } = tracker();
    t.record("bad", "r1");
    t.record("bad", "r2");
    t.clear("bad");
    expect(t.record("bad", "r3").distinctReporters).toBe(1);
  });

  it("is bounded in memory, forgetting the oldest targets", () => {
    const { clock, t } = tracker(3);
    for (let i = 0; i < 6; i++) {
      t.record(`t${i}`, `r${i}`);
      clock.advance(1);
    }
    expect(t.size).toBe(3);
  });

  it("forgets targets whose reports have all expired", () => {
    const { clock, t } = tracker();
    t.record("old", "r1");
    clock.advance(HOUR + 1);
    t.record("new", "r2");
    expect(t.size).toBe(1);
  });
});

describe("BanList", () => {
  function bans(max?: number) {
    const clock = new FakeClock(1_000_000);
    return { clock, list: new BanList(clock, DAY, max) };
  }

  it("blocks for exactly the duration, and only that connection", () => {
    const { clock, list } = bans();
    list.ban("bad");
    expect(list.isBanned("bad")).toBe(true);
    expect(list.isBanned("other")).toBe(false);
    clock.advance(DAY - 1);
    expect(list.isBanned("bad")).toBe(true);
    clock.advance(1);
    expect(list.isBanned("bad")).toBe(false);
    expect(list.size).toBe(0);
  });

  it("banning again restarts the period", () => {
    const { clock, list } = bans();
    list.ban("bad");
    clock.advance(DAY - 10);
    list.ban("bad");
    clock.advance(20);
    expect(list.isBanned("bad")).toBe(true);
    expect(list.size).toBe(1);
  });

  it("is bounded in memory", () => {
    const { clock, list } = bans(3);
    for (let i = 0; i < 6; i++) {
      list.ban(`h${i}`);
      clock.advance(1);
    }
    expect(list.size).toBe(3);
    expect(list.isBanned("h5")).toBe(true);
    expect(list.isBanned("h0")).toBe(false);
  });
});

describe("categories", () => {
  it("are exactly the seven in the law-aligned list, and only minor and threats are priority", () => {
    expect([...REPORT_CATEGORIES]).toEqual(["harassment", "sexual", "spam", "hate", "minor", "threats", "other"]);
    expect([...PRIORITY_CATEGORIES].sort()).toEqual(["minor", "threats"]);
  });
});
