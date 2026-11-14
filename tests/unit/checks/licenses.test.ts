import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A licence that would force us to publish our own code (GPL family) or that
// is not a licence at all must never reach production. The list is read from
// package-lock.json, so the check needs no installed packages.
const ALLOWED = new Set([
  "MIT",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "0BSD",
  "BlueOak-1.0.0",
  "CC0-1.0",
  "Unlicense",
]);

// "MIT OR Apache-2.0" needs one allowed licence; "A AND B" needs both.
function acceptable(expression: string): boolean {
  const cleaned = expression.replace(/[()]/g, " ").trim();
  if (/\bAND\b/.test(cleaned)) return cleaned.split(/\bAND\b/).every((part) => acceptable(part));
  return cleaned.split(/\bOR\b/).some((part) => ALLOWED.has(part.trim()));
}

interface LockEntry {
  version?: string;
  license?: string;
  dev?: boolean;
  devOptional?: boolean;
}
const lock = JSON.parse(readFileSync("package-lock.json", "utf8")) as { packages: Record<string, LockEntry> };
const production = Object.entries(lock.packages).filter(([name, entry]) => name !== "" && !entry.dev && !entry.devOptional);

describe("licences of production dependencies", () => {
  it("covers a real dependency tree", () => {
    expect(production.length).toBeGreaterThan(20);
  });

  it("are all permissive: no GPL, AGPL, LGPL, SSPL, unknown or missing licence", () => {
    const bad = production
      .filter(([, entry]) => !entry.license || !acceptable(entry.license))
      .map(([name, entry]) => `${name.replace(/^node_modules\//, "")}: ${entry.license ?? "no licence"}`);
    expect(bad).toEqual([]);
  });

  it("the checker itself understands licence expressions", () => {
    expect(acceptable("MIT")).toBe(true);
    expect(acceptable("(MIT OR GPL-3.0)")).toBe(true); // we may choose the permissive one
    expect(acceptable("MIT AND BSD-3-Clause")).toBe(true);
    expect(acceptable("MIT AND GPL-3.0")).toBe(false);
    for (const bad of ["GPL-3.0", "AGPL-3.0-or-later", "LGPL-2.1", "SSPL-1.0", "UNLICENSED", "SEE LICENSE IN LICENSE", ""]) {
      expect(acceptable(bad), bad).toBe(false);
    }
  });
});
