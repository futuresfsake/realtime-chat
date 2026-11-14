import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { ALLOWED_REACTIONS } from "../../../src/types/events.js";

// Runs the browser script in isolation, the way a page would load it.
function load() {
  const file = path.join(process.cwd(), "public", "js", "sessionStore.js");
  const sandbox: Record<string, any> = {};
  sandbox.globalThis = sandbox;
  vm.runInNewContext(readFileSync(file, "utf8"), sandbox);
  return sandbox.SessionStore as { create(): any; ALLOWED_REACTIONS: string[] };
}

const msg = (seq: number, from = "quiet-otter-42") => ({ seq, from, text: `m${seq}`, sentAt: seq });

describe("session history (browser memory)", () => {
  it("stores messages and counts them", () => {
    const store = load().create();
    store.addMessage(msg(1), false);
    store.addMessage(msg(2), true);
    expect(store.size()).toBe(2);
  });

  it("clear() empties it, and nothing from before can be reacted to", () => {
    const store = load().create();
    store.addMessage(msg(1), false);
    store.clear();
    expect(store.size()).toBe(0);
    expect(store.lastPartnerSeq()).toBeNull();
    expect(store.addReaction("them:1", "👍", "x")).toBeNull();
  });

  it("keeps at most 500 messages, dropping the oldest", () => {
    const store = load().create();
    for (let i = 1; i <= 505; i++) store.addMessage(msg(i), false);
    expect(store.size()).toBe(500);
    expect(store.addReaction("them:5", "👍", "x")).toBeNull(); // dropped
    expect(store.addReaction("them:6", "👍", "x")).not.toBeNull(); // oldest kept
  });

  it("two stores do not share anything", () => {
    const { create } = load();
    const a = create();
    const b = create();
    a.addMessage(msg(1), false);
    expect(b.size()).toBe(0);
  });
});

describe("reactions in the store", () => {
  it("stacks different reactions on one message", () => {
    const store = load().create();
    store.addMessage(msg(1), false);
    expect(store.addReaction("them:1", "😂", "a")).toEqual([{ from: "a", emoji: "😂" }]);
    expect(store.addReaction("them:1", "👍", "b")).toHaveLength(2);
  });

  it("ignores a repeat of the same reaction by the same person", () => {
    const store = load().create();
    store.addMessage(msg(1), false);
    store.addReaction("them:1", "😂", "a");
    expect(store.addReaction("them:1", "😂", "a")).toBeNull();
    expect(store.addReaction("them:1", "😂", "b")).toHaveLength(2);
  });

  it("ignores reactions to unknown messages and to emojis that are not allowed", () => {
    const store = load().create();
    store.addMessage(msg(1), false);
    expect(store.addReaction("them:99", "😂", "a")).toBeNull();
    expect(store.addReaction("them:1", "🔥", "a")).toBeNull();
  });

  it("caps the reactions on one message", () => {
    const store = load().create();
    store.addMessage(msg(1), false);
    for (let i = 0; i < 12; i++) store.addReaction("them:1", "👍", `p${i}`);
    expect(store.addReaction("them:1", "👍", "one-too-many")).toBeNull();
  });

  it("lastPartnerSeq is the partner's latest message, not the user's own", () => {
    const store = load().create();
    expect(store.lastPartnerSeq()).toBeNull();
    store.addMessage(msg(1), false);
    store.addMessage(msg(2), true);
    store.addMessage(msg(3), true);
    expect(store.lastPartnerSeq()).toBe(1);
    store.addMessage(msg(4), false);
    expect(store.lastPartnerSeq()).toBe(4);
  });

  it("uses the same reaction list as the server", () => {
    expect(load().ALLOWED_REACTIONS).toEqual([...ALLOWED_REACTIONS]);
  });
});

describe("nothing about messages is stored on the server or in browser storage", () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

  it("the client never writes messages to localStorage, sessionStorage, cookies or IndexedDB", () => {
    for (const file of ["public/client.js", "public/js/sessionStore.js"]) {
      const code = read(file);
      expect(code, file).not.toMatch(/indexedDB|document\.cookie/);
      // Storage is only used for the theme and the consent flag.
      for (const use of code.match(/(?:local|session)Storage\.\w+\([^)]*\)/g) ?? []) {
        expect(use, `${file}: ${use}`).toMatch(/THEME_KEY|CONSENT_KEY/);
      }
    }
  });

  it("the server keeps no list or map of message text", () => {
    const relay = read("src/gateway/registerHandlers.ts");
    // The relay builds a message, emits it and forgets it. Nothing is pushed
    // or set into a collection with the text in it.
    expect(relay).not.toMatch(/\.(push|set|add|unshift)\([^)]*\b(text|msg|message)\b/);
    const sessions = read("src/sessions/sessionManager.ts");
    expect(sessions).not.toMatch(/\btext\b/); // the session manager never sees message text
  });
});

describe("message ids (each side numbers its own messages)", () => {
  it("keeps my message 2 and their message 2 apart", () => {
    const store = load().create();
    expect(store.addMessage(msg(2), true)).toBe("me:2");
    expect(store.addMessage(msg(2), false)).toBe("them:2");
    expect(store.addReaction("me:2", "👍", "x")).toHaveLength(1);
    expect(store.addReaction("them:2", "👍", "x")).toHaveLength(1);
    expect(store.addReaction("them:3", "👍", "x")).toBeNull();
  });
});
