import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GraceTimers } from "../../../src/sessions/reconnectGrace.js";
import { SessionManager } from "../../../src/sessions/sessionManager.js";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("GraceTimers", () => {
  it("runs onExpire once after the grace period", () => {
    const grace = new GraceTimers();
    const onExpire = vi.fn();
    grace.hold("a", 30_000, onExpire);
    expect(grace.has("a")).toBe(true);
    vi.advanceTimersByTime(29_999);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(grace.has("a")).toBe(false);
    expect(grace.size).toBe(0);
  });

  it("does not run onExpire when cancelled in time", () => {
    const grace = new GraceTimers();
    const onExpire = vi.fn();
    grace.hold("a", 30_000, onExpire);
    vi.advanceTimersByTime(10_000);
    expect(grace.cancel("a")).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("reports false when there is nothing to cancel", () => {
    const grace = new GraceTimers();
    expect(grace.cancel("nobody")).toBe(false);
    grace.hold("a", 10, vi.fn());
    vi.advanceTimersByTime(10);
    expect(grace.cancel("a")).toBe(false); // already expired
  });

  it("restarts the countdown when the same socket is held again", () => {
    const grace = new GraceTimers();
    const first = vi.fn();
    const second = vi.fn();
    grace.hold("a", 1000, first);
    vi.advanceTimersByTime(900);
    grace.hold("a", 1000, second);
    vi.advanceTimersByTime(900);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("keeps separate countdowns per socket", () => {
    const grace = new GraceTimers();
    const a = vi.fn();
    const b = vi.fn();
    grace.hold("a", 1000, a);
    grace.hold("b", 2000, b);
    grace.cancel("a");
    vi.advanceTimersByTime(2000);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("clear() drops every countdown without running it", () => {
    const grace = new GraceTimers();
    const onExpire = vi.fn();
    grace.hold("a", 1000, onExpire);
    grace.hold("b", 1000, onExpire);
    grace.clear();
    vi.advanceTimersByTime(5000);
    expect(onExpire).not.toHaveBeenCalled();
    expect(grace.size).toBe(0);
  });
});

// How the gateway combines the two pieces: the session is kept while the
// countdown runs, and ended only when it expires.
describe("connection recovery (grace + sessions)", () => {
  function paired() {
    const sessions = new SessionManager();
    sessions.registerClient("a");
    sessions.registerClient("b");
    sessions.startSearching("a");
    sessions.startSearching("b");
    sessions.createSession("a", "b");
    const grace = new GraceTimers();
    const drop = (id: string) => grace.hold(id, 30_000, () => sessions.removeClient(id));
    return { sessions, grace, drop };
  }

  it("disconnect + reconnect within 30s: the session continues", () => {
    const { sessions, grace, drop } = paired();
    drop("b");
    vi.advanceTimersByTime(29_000);
    expect(sessions.getPartner("a")).toBe("b");
    expect(grace.cancel("b")).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(sessions.getClientState("b")).toBe("CHATTING");
    expect(sessions.getPartner("a")).toBe("b");
  });

  it("disconnect + no reconnect after 30s: the session ends for both", () => {
    const { sessions, drop } = paired();
    drop("b");
    vi.advanceTimersByTime(30_000);
    expect(sessions.getClientState("b")).toBeUndefined();
    expect(sessions.getClientState("a")).toBe("ENDED");
    expect(sessions.sessionCount()).toBe(0);
  });

  it("partner leaves while I am away: nothing breaks when my countdown expires", () => {
    const { sessions, drop } = paired();
    drop("b");
    sessions.leave("a");
    expect(sessions.getClientState("b")).toBe("ENDED");
    vi.advanceTimersByTime(30_000);
    expect(sessions.getClientState("b")).toBeUndefined();
    expect(sessions.getClientState("a")).toBe("READY");
  });

  it("both sides drop: each countdown is independent", () => {
    const { sessions, grace, drop } = paired();
    drop("a");
    vi.advanceTimersByTime(10_000);
    drop("b");
    grace.cancel("a"); // a is back
    vi.advanceTimersByTime(30_000); // b never returns
    expect(sessions.getClientState("a")).toBe("ENDED");
    expect(sessions.getClientState("b")).toBeUndefined();
  });
});
