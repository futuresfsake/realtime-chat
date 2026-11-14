import { describe, expect, it } from "vitest";
import { SessionManager } from "../../../src/sessions/sessionManager.js";

function setup() {
  let n = 0;
  const sm = new SessionManager({ newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` });
  for (const id of ["a", "b", "c"]) sm.registerClient(id);
  return sm;
}

function paired() {
  const sm = setup();
  sm.startSearching("a");
  sm.startSearching("b");
  return { sm, s: sm.createSession("a", "b") };
}

describe("SessionManager", () => {
  describe("registerClient", () => {
    it("starts a new client in READY", () => {
      expect(setup().getClientState("a")).toBe("READY");
    });
    it("returns undefined state for unknown sockets", () => {
      expect(setup().getClientState("zzz")).toBeUndefined();
    });
  });

  describe("startSearching", () => {
    it("moves READY -> SEARCHING", () => {
      const sm = setup();
      expect(sm.startSearching("a")).toEqual({ ok: true });
      expect(sm.getClientState("a")).toBe("SEARCHING");
    });
    it("refuses when already searching or chatting", () => {
      const { sm } = paired();
      expect(sm.startSearching("a")).toEqual({ ok: false, code: "INVALID_STATE" });
      sm.startSearching("c");
      expect(sm.startSearching("c")).toEqual({ ok: false, code: "INVALID_STATE" });
    });
    it("allows a new search after a session ended", () => {
      const { sm, s } = paired();
      sm.endSession(s.id);
      expect(sm.startSearching("a")).toEqual({ ok: true });
    });
    it("refuses unknown sockets", () => {
      expect(setup().startSearching("zzz")).toEqual({ ok: false, code: "INVALID_STATE" });
    });
    it("can stop searching", () => {
      const sm = setup();
      sm.startSearching("a");
      expect(sm.stopSearching("a")).toBe(true);
      expect(sm.getClientState("a")).toBe("READY");
      expect(sm.stopSearching("a")).toBe(false);
    });
  });

  describe("createSession", () => {
    it("moves both clients to CHATTING with exactly two participants and a UUID", () => {
      const { sm, s } = paired();
      expect(sm.getClientState("a")).toBe("CHATTING");
      expect(sm.getClientState("b")).toBe("CHATTING");
      expect(s.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect([s.a, s.b]).toEqual(["a", "b"]);
    });
    it("gives the two participants different, well-formed names", () => {
      const { sm } = paired();
      const na = sm.getName("a")!;
      const nb = sm.getName("b")!;
      expect(na).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);
      expect(nb).not.toBe(na);
    });
    it("refuses the same socket twice or a client that is not searching", () => {
      const sm = setup();
      sm.startSearching("a");
      expect(() => sm.createSession("a", "a")).toThrow();
      expect(() => sm.createSession("a", "b")).toThrow(); // b is READY
    });
  });

  describe("getPartner", () => {
    it("returns the other participant", () => {
      const { sm } = paired();
      expect(sm.getPartner("a")).toBe("b");
      expect(sm.getPartner("b")).toBe("a");
    });
    it("returns null when not in a session", () => {
      const sm = setup();
      expect(sm.getPartner("a")).toBeNull();
      expect(sm.getPartner("zzz")).toBeNull();
    });
  });

  describe("endSession", () => {
    it("moves both to ENDED and forgets the session and the names", () => {
      const { sm, s } = paired();
      expect(sm.endSession(s.id)).toEqual(s);
      expect(sm.getClientState("a")).toBe("ENDED");
      expect(sm.getClientState("b")).toBe("ENDED");
      expect(sm.getPartner("a")).toBeNull();
      expect(sm.getName("a")).toBeUndefined();
      expect(sm.sessionCount()).toBe(0);
    });
    it("is a no-op for an unknown or already ended session", () => {
      const { sm, s } = paired();
      expect(sm.endSession("nope")).toBeNull();
      sm.endSession(s.id);
      expect(sm.endSession(s.id)).toBeNull();
    });
  });

  describe("removeClient", () => {
    it("ends the session and reports the partner", () => {
      const { sm, s } = paired();
      expect(sm.removeClient("a")).toEqual({ ended: s, partner: "b" });
      expect(sm.getClientState("a")).toBeUndefined();
      expect(sm.getClientState("b")).toBe("ENDED");
    });
    it("reports nothing for a client not in a session", () => {
      expect(setup().removeClient("c")).toEqual({ ended: null, partner: null });
    });
  });

  describe("key exchange", () => {
    it("is complete only after both sides sent a key", () => {
      const { sm, s } = paired();
      expect(sm.isSecured("a")).toBe(false);
      expect(sm.recordKey("a")).toEqual({ ok: true, sessionId: s.id, partner: "b", complete: false });
      expect(sm.isSecured("a")).toBe(false);
      expect(sm.recordKey("b")).toEqual({ ok: true, sessionId: s.id, partner: "a", complete: true });
      expect(sm.isSecured("a")).toBe(true);
      expect(sm.isSecured("b")).toBe(true);
    });
    it("accepts one key per side: a second one is refused and does not complete the exchange", () => {
      const { sm } = paired();
      sm.recordKey("a");
      expect(sm.recordKey("a")).toEqual({ ok: false, code: "INVALID_STATE" });
      expect(sm.isSecured("a")).toBe(false);
    });
    it("refuses a key outside a session", () => {
      const sm = setup();
      expect(sm.recordKey("c")).toEqual({ ok: false, code: "NOT_IN_SESSION" });
      expect(sm.recordKey("zzz")).toEqual({ ok: false, code: "NOT_IN_SESSION" });
      expect(sm.isSecured("c")).toBe(false);
    });
    it("starts clean in a new session between the same two clients", () => {
      const { sm, s } = paired();
      sm.recordKey("a");
      sm.recordKey("b");
      sm.endSession(s.id);
      sm.startSearching("a");
      sm.startSearching("b");
      sm.createSession("a", "b");
      expect(sm.isSecured("a")).toBe(false);
      expect(sm.recordKey("a").ok).toBe(true);
    });
    it("endIfNotSecured ends a half-keyed session, and leaves a secured or finished one alone", () => {
      const { sm, s } = paired();
      sm.recordKey("a");
      expect(sm.endIfNotSecured(s.id)?.id).toBe(s.id);
      expect(sm.getClientState("a")).toBe("ENDED");
      expect(sm.endIfNotSecured(s.id)).toBeNull(); // already over

      sm.startSearching("a");
      sm.startSearching("b");
      const second = sm.createSession("a", "b");
      sm.recordKey("a");
      sm.recordKey("b");
      expect(sm.endIfNotSecured(second.id)).toBeNull();
      expect(sm.getClientState("a")).toBe("CHATTING");
    });
  });

  describe("session integrity", () => {
    it("accepts only the two participants", () => {
      const { sm, s } = paired();
      expect(sm.isMember("a", s.id)).toBe(true);
      expect(sm.isMember("b", s.id)).toBe(true);
      expect(sm.isMember("c", s.id)).toBe(false);
    });
    it("rejects a forged session id", () => {
      const { sm } = paired();
      expect(sm.isMember("a", "6f1c2b0e-0000-4000-8000-000000000000")).toBe(false);
    });
    it("rejects everyone once the session ended, and never lets it be rejoined", () => {
      const { sm, s } = paired();
      sm.endSession(s.id);
      expect(sm.isMember("a", s.id)).toBe(false);
      expect(sm.isMember("b", s.id)).toBe(false);
    });
  });

  describe("leave", () => {
    it("CHATTING -> READY, session ended, partner reported and ENDED", () => {
      const { sm, s } = paired();
      expect(sm.leave("a")).toEqual({ ok: true, ended: s, partner: "b", wasSearching: false });
      expect(sm.getClientState("a")).toBe("READY");
      expect(sm.getClientState("b")).toBe("ENDED");
      expect(sm.sessionCount()).toBe(0);
    });
    it("SEARCHING -> READY", () => {
      const sm = setup();
      sm.startSearching("a");
      expect(sm.leave("a")).toEqual({ ok: true, ended: null, partner: null, wasSearching: true });
      expect(sm.getClientState("a")).toBe("READY");
    });
    it("ENDED -> READY", () => {
      const { sm } = paired();
      sm.leave("a");
      expect(sm.leave("b").ok).toBe(true);
      expect(sm.getClientState("b")).toBe("READY");
    });
    it("READY -> INVALID_STATE", () => {
      expect(setup().leave("a")).toEqual({ ok: false, code: "INVALID_STATE" });
    });
    it("unknown socket -> INVALID_STATE", () => {
      expect(setup().leave("zzz")).toEqual({ ok: false, code: "INVALID_STATE" });
    });
  });

  describe("next", () => {
    it("CHATTING -> SEARCHING, session ended, partner reported", () => {
      const { sm, s } = paired();
      expect(sm.next("a")).toEqual({ ok: true, ended: s, partner: "b", wasSearching: false });
      expect(sm.getClientState("a")).toBe("SEARCHING");
      expect(sm.getClientState("b")).toBe("ENDED");
    });
    it("SEARCHING stays SEARCHING", () => {
      const sm = setup();
      sm.startSearching("a");
      expect(sm.next("a")).toMatchObject({ ok: true, ended: null, wasSearching: true });
      expect(sm.getClientState("a")).toBe("SEARCHING");
    });
    it("ENDED -> SEARCHING", () => {
      const { sm } = paired();
      sm.leave("a");
      expect(sm.next("b").ok).toBe(true);
      expect(sm.getClientState("b")).toBe("SEARCHING");
    });
    it("READY -> INVALID_STATE", () => {
      expect(setup().next("a")).toEqual({ ok: false, code: "INVALID_STATE" });
    });
    it("a new name is given in the next session", () => {
      const sm = new SessionManager();
      for (const id of ["a", "b", "c"]) sm.registerClient(id);
      sm.startSearching("a");
      sm.startSearching("b");
      sm.createSession("a", "b");
      expect(sm.next("a").ok).toBe(true);
      sm.startSearching("c");
      sm.createSession("a", "c");
      expect(sm.getName("a")).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);
    });
  });
});
