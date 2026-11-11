import { describe, expect, it } from "vitest";
import { ADJECTIVES, ANIMALS, generateName } from "../../../src/sessions/nameGenerator.js";

// Seeded generator (mulberry32) so tests are reproducible.
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Words that must never appear in a generated name. Extend as needed.
const BLOCKLIST = [
  "sex", "porn", "nude", "naked", "kill", "rape", "nazi", "slut", "whore", "fuck", "shit", "dick",
  "cock", "pussy", "bitch", "cum", "anal", "gay", "fag", "negro", "nigg", "retard", "suicide",
  "murder", "die", "dead", "hate", "terror", "bomb", "gun", "drug", "weed", "piss", "ass", "tit",
];

describe("generateName", () => {
  it('returns format "adjective-animal-NN"', () => {
    for (let i = 0; i < 200; i++) expect(generateName(seeded(i))).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);
  });

  it("uses lowercase alphabetic adjectives of at most 8 chars", () => {
    for (const w of ADJECTIVES) expect(w).toMatch(/^[a-z]{1,8}$/);
  });

  it("uses lowercase alphabetic animals of at most 8 chars", () => {
    for (const w of ANIMALS) expect(w).toMatch(/^[a-z]{1,8}$/);
  });

  it("has no duplicate words and enough variety", () => {
    expect(new Set(ADJECTIVES).size).toBe(ADJECTIVES.length);
    expect(new Set(ANIMALS).size).toBe(ANIMALS.length);
    expect(ADJECTIVES.length).toBeGreaterThanOrEqual(50);
    expect(ANIMALS.length).toBeGreaterThanOrEqual(50);
  });

  it("zero-pads the number and stays within 00-99", () => {
    expect(generateName(() => 0)).toBe(`${ADJECTIVES[0]}-${ANIMALS[0]}-00`);
    expect(generateName(() => 0.999999)).toBe(
      `${ADJECTIVES[ADJECTIVES.length - 1]}-${ANIMALS[ANIMALS.length - 1]}-99`,
    );
  });

  it("is deterministic for a seeded rng", () => {
    expect(generateName(seeded(7))).toBe(generateName(seeded(7)));
  });

  it("differs across seeds (high probability)", () => {
    const names = new Set(Array.from({ length: 50 }, (_, i) => generateName(seeded(i + 1))));
    expect(names.size).toBeGreaterThan(40);
  });

  it("contains no blocklisted substring in any word", () => {
    for (const word of [...ADJECTIVES, ...ANIMALS]) {
      for (const bad of BLOCKLIST) expect(word.includes(bad), `${word} contains ${bad}`).toBe(false);
    }
  });
});
