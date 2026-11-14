import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

// NFR-10: the first page must stay small enough for a 3G-class connection:
// under 100 KB, not counting the Socket.IO client (which the server serves).
const BUDGET_BYTES = 100 * 1024;
const root = path.join(process.cwd(), "public");
const read = (file: string) => readFileSync(path.join(root, file));

const textFiles = [
  "index.html",
  "styles.css",
  "client.js",
  "favicon.svg",
  ...readdirSync(path.join(root, "js")).map((f) => `js/${f}`),
];
const fonts = readdirSync(path.join(root, "fonts")).filter((f) => f.endsWith(".woff2"));

// What travels: text is compressed (the host does this), fonts already are.
const transferred = () =>
  textFiles.reduce((sum, f) => sum + gzipSync(read(f), { level: 9 }).length, 0) +
  fonts.reduce((sum, f) => sum + statSync(path.join(root, "fonts", f)).size, 0);

describe("page size (NFR-10)", () => {
  it("is under 100 KB on the wire: compressed text plus fonts", () => {
    const total = transferred();
    expect(total, `page weighs ${(total / 1024).toFixed(1)} KB`).toBeLessThan(BUDGET_BYTES);
  });

  it("keeps some headroom, so one small change does not break the budget", () => {
    expect(transferred()).toBeLessThan(BUDGET_BYTES * 0.95);
  });

  it("loads no script, style or font from anywhere but our own origin", () => {
    const html = read("index.html").toString("utf8");
    const css = read("styles.css").toString("utf8");
    for (const match of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)) {
      expect(match[1], match[0]).toMatch(/^\//);
    }
    for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) expect(match[1], match[0]).toMatch(/^\//);
    expect(css).not.toMatch(/@import/);
  });

  it("has a licence file next to every font", () => {
    const files = readdirSync(path.join(root, "fonts"));
    expect(files.some((f) => /OFL-instrument-sans/.test(f))).toBe(true);
    expect(files.some((f) => /OFL-jetbrains-mono/.test(f))).toBe(true);
  });
});
