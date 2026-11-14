import { describe, expect, it } from "vitest";
import { compatible } from "../../../src/matchmaking/compatibility.js";
import type { Candidate } from "../../../src/matchmaking/compatibility.js";

const who = (id: string, country: string, scope: Candidate["scope"]): Candidate => ({ id, country, scope });

// The table from docs/03-design/matchmaking.md section 3, in both directions.
describe("compatible", () => {
  const phLocal = who("a", "PH", "local");
  const phWorld = who("a", "PH", "world");
  const cases: [string, Candidate, Candidate, boolean][] = [
    ["local PH + local PH", phLocal, who("b", "PH", "local"), true],
    ["local PH + local JP", phLocal, who("b", "JP", "local"), false],
    ["local PH + world JP (A wants PH only)", phLocal, who("b", "JP", "world"), false],
    ["local PH + world PH", phLocal, who("b", "PH", "world"), true],
    ["world PH + local PH", phWorld, who("b", "PH", "local"), true],
    ["world PH + local JP (B wants JP only)", phWorld, who("b", "JP", "local"), false],
    ["world PH + world JP", phWorld, who("b", "JP", "world"), true],
    ["world XX + world XX", who("a", "XX", "world"), who("b", "XX", "world"), true],
    ["local XX + world XX (unknown is never 'the same country')", who("a", "XX", "local"), who("b", "XX", "world"), false],
    ["local XX + local XX", who("a", "XX", "local"), who("b", "XX", "local"), false],
    ["world PH + local XX", phWorld, who("b", "XX", "local"), false],
  ];

  it.each(cases)("%s -> %s", (_name, a, b, expected) => {
    expect(compatible(a, b)).toBe(expected);
    expect(compatible(b, a)).toBe(expected); // symmetric: the order never matters
  });

  it("never matches a person with themselves", () => {
    expect(compatible(phWorld, phWorld)).toBe(false);
    expect(compatible(phLocal, { ...phLocal })).toBe(false);
  });
});
