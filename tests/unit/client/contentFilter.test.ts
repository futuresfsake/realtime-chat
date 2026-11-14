import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

interface Verdict {
  blocked: boolean;
  reason: string | null;
  warnings: string[];
}
interface Filter {
  check(text: unknown): Verdict;
  hasBannedContent(text: string): boolean;
  normalize(text: string): string;
  WARNING_TEXT: Record<string, string>;
}

// Runs the browser scripts in isolation, the way the page loads them.
function load(): Filter {
  const sandbox: Record<string, any> = {};
  sandbox.globalThis = sandbox;
  for (const file of ["bannedWords.js", "contentFilter.js"]) {
    const full = path.join(process.cwd(), "public", "js", file);
    vm.runInNewContext(readFileSync(full, "utf8"), sandbox, { filename: full });
  }
  return sandbox.ContentFilter as Filter;
}
const filter = load();
const check = (text: unknown) => filter.check(text);

describe("clean messages", () => {
  it.each([
    "hey, where are you from?",
    "Kumusta ka? Taga-Cebu ako, ikaw?",
    "I love gaming and music :)",
    "see https://example.com/page for the recipe",
    "I'm 25 and I live in room 101",
    "你好，很高兴认识你",
    "ok thanks",
    "😂😂😂",
  ])("lets %j through with no warnings", (text) => {
    expect(check(text)).toEqual({ blocked: false, reason: null, warnings: [] });
  });

  it("treats a link as plain text: no block, no warning", () => {
    expect(check("https://example.com/login?x=1")).toEqual({ blocked: false, reason: null, warnings: [] });
  });

  it("does not choke on things that are not text", () => {
    for (const value of [undefined, null, 42, {}, ["hi"]]) {
      expect(check(value)).toEqual({ blocked: false, reason: null, warnings: [] });
    }
  });
});

describe("banned content is blocked", () => {
  it.each([
    "kill yourself",
    "KILL YOURSELF",
    "Kill   yourself!!!",
    "kys",
    "K.Y.S.",
    "you should just killlllll yourself",
    "ill kill you",
    "i will rape you",
    "magpakamatay ka",
    "patayin kita",
    "send nudes",
    "send n00ds? no: SEND NUDES pls",
    "n1gg3r",
    "ni99er",
    "niiigger",
    "faggots",
    "you are a Retard",
    "child porn",
    "loli",
  ])("blocks %j", (text) => {
    const verdict = check(text);
    expect(verdict.blocked).toBe(true);
    expect(verdict.reason).toBe("banned");
    expect(filter.hasBannedContent(text)).toBe(true);
  });

  it("finds a banned word anywhere in a sentence", () => {
    expect(check("hey so anyway kys lol").blocked).toBe(true);
    expect(check("honestly. kill yourself.").blocked).toBe(true);
  });

  it("a blocked message gets no other verdict: it is simply not sent", () => {
    const verdict = check("kys 09171234567");
    expect(verdict.blocked).toBe(true);
    expect(verdict.warnings).toEqual([]);
  });
});

describe("it does not block innocent words that contain a banned one (whole words only)", () => {
  it.each([
    "class", "assassin", "grape", "analysis", "Scunthorpe", "skills", "kill time", "Kyiv", "shotaro", "lolipop",
    "fagot", "fagin", "nudest", "cuntry", "I am retarding the process", "kill it", "yourself",
    "kill the lights yourself", "send the notes", "child care", "porn-free", "rapeseed oil",
  ])("%j is fine", (text) => {
    expect(check(text).blocked).toBe(false);
  });
});

describe("personal information warnings", () => {
  it.each([
    ["09171234567", "phone_number"],
    ["call me on 0917 123 4567", "phone_number"],
    ["0917-123-4567", "phone_number"],
    ["+63 917 123 4567", "phone_number"],
    ["+63(917)1234567", "phone_number"],
    ["my number is 639171234567", "phone_number"],
  ])("%j -> %s", (text, warning) => {
    expect(check(text).warnings).toContain(warning);
    expect(check(text).blocked).toBe(false); // a warning, not a block
  });

  it.each(["I'm 25", "room 101", "call 911", "it costs 1,500 pesos", "born in 1998", "12345678"])(
    "%j is not a phone number",
    (text) => {
      expect(check(text).warnings).not.toContain("phone_number");
    },
  );

  it("recognises an email address, and only calls it an email", () => {
    expect(check("juan.dela@example.com").warnings).toEqual(["email"]);
    expect(check("write to maria_cruz+chat@mail.ph please").warnings).toEqual(["email"]);
  });

  it.each(["@juan_delacruz", "add me @maria.c", "ig: juan123", "IG juan123", "my insta is juan123", "telegram: juan_dc", "fb juan.dc"])(
    "%j looks like a social media account",
    (text) => {
      expect(check(text).warnings).toContain("social_handle");
    },
  );

  it.each(["@", "I'm @ home", "email me at 5 pm", "the ig of it all"])("%j is not a social media account", (text) => {
    expect(check(text).warnings).not.toContain("social_handle");
  });

  it("reports every kind it finds", () => {
    const { warnings } = check("text 09171234567 or mail a@b.co, ig: juan123");
    expect(warnings.sort()).toEqual(["email", "phone_number", "social_handle"]);
  });

  it("has a plain sentence for every warning it can give", () => {
    for (const key of ["phone_number", "email", "social_handle", "spam_repetition", "excessive_caps"]) {
      expect(filter.WARNING_TEXT[key], key).toMatch(/^That looks like/);
    }
  });
});

describe("spam patterns", () => {
  it("warns about one character stretched out", () => {
    expect(check("a".repeat(12)).warnings).toContain("spam_repetition");
    expect(check("a".repeat(11)).warnings).not.toContain("spam_repetition");
    expect(check("haha" + "a".repeat(5)).warnings).not.toContain("spam_repetition");
  });

  it("warns about a long shout, not a short one or a normal sentence", () => {
    expect(check("THIS IS A VERY LONG SHOUT").warnings).toContain("excessive_caps");
    expect(check("OK THANKS").warnings).toEqual([]);
    expect(check("Hello, this is a normal sentence.").warnings).toEqual([]);
    expect(check("12345 67890 !!!!!").warnings).not.toContain("excessive_caps");
  });
});

describe("normalising", () => {
  it("makes disguises comparable", () => {
    expect(filter.normalize("K.Y.S.")).toBe("kys");
    expect(filter.normalize("Kíll  yoürself!!")).toBe("kill yourself");
    expect(filter.normalize("n1gg3r")).toBe("nigger");
  });
});

describe("the word list", () => {
  const source = (file: string) => readFileSync(path.join(process.cwd(), "public", "js", file), "utf8");

  it("is frozen, so the page cannot change it by accident", () => {
    const sandbox: Record<string, any> = {};
    sandbox.globalThis = sandbox;
    vm.runInNewContext(source("bannedWords.js"), sandbox);
    expect(Object.isFrozen(sandbox.BannedWords)).toBe(true);
    expect(sandbox.BannedWords.length).toBeGreaterThan(10);
  });

  it("says plainly that it needs the owner's review", () => {
    expect(source("bannedWords.js")).toMatch(/OWNER REVIEW REQUIRED/);
  });

  it("is plain data and the filter never writes to the page, the network or storage", () => {
    for (const file of ["bannedWords.js", "contentFilter.js"]) {
      const code = source(file);
      expect(code, file).not.toMatch(/innerHTML|document\.|fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|console\./);
    }
  });
});
