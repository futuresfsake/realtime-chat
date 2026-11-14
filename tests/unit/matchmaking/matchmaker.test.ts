import { describe, expect, it } from "vitest";
import { FakeClock } from "../../../src/lib/clock.js";
import type { Interest, SearchPrefs } from "../../../src/matchmaking/interests.js";
import { Matchmaker } from "../../../src/matchmaking/matchmaker.js";

const WAIT = 10_000;

function setup() {
  const clock = new FakeClock(1_000_000);
  return { clock, m: new Matchmaker(clock, WAIT) };
}
const prefs = (interests: Interest[] = [], scope: SearchPrefs["scope"] = "world"): SearchPrefs => ({ interests, scope });
const ids = (m: { a: string; b: string } | null) => (m ? [m.a, m.b].sort() : null);

describe("with no interests", () => {
  it("pairs two people at once, the longer-waiting one first", () => {
    const { clock, m } = setup();
    expect(m.enqueue("a", "PH", prefs())).toBeNull();
    clock.advance(500);
    const match = m.enqueue("b", "PH", prefs());
    expect(match).toEqual({ a: "a", b: "b", shared: [] });
    expect(m.size).toBe(0);
  });

  it("leaves a third person waiting, then pairs them with the fourth", () => {
    const { m } = setup();
    m.enqueue("a", "PH", prefs());
    m.enqueue("b", "PH", prefs());
    expect(m.enqueue("c", "PH", prefs())).toBeNull();
    expect(ids(m.enqueue("d", "PH", prefs()))).toEqual(["c", "d"]);
  });

  it("never pairs someone with themselves, and a second search replaces the first", () => {
    const { m } = setup();
    expect(m.enqueue("a", "PH", prefs())).toBeNull();
    expect(m.enqueue("a", "PH", prefs())).toBeNull();
    expect(m.size).toBe(1);
  });

  it("forgets someone who leaves", () => {
    const { m } = setup();
    m.enqueue("a", "PH", prefs());
    m.remove("a");
    expect(m.isWaiting("a")).toBe(false);
    expect(m.enqueue("b", "PH", prefs())).toBeNull();
  });

  it("does not pair with someone who is still holding out for a shared interest", () => {
    const { m } = setup();
    m.enqueue("a", "PH", prefs(["gaming"]));
    expect(m.enqueue("b", "PH", prefs())).toBeNull(); // b is open, a is not
    expect(m.size).toBe(2);
  });
});

describe("interest phase (US-14)", () => {
  it("pairs people who share an interest, and reports which", () => {
    const { m } = setup();
    m.enqueue("a", "PH", prefs(["gaming", "music"]));
    expect(m.enqueue("b", "PH", prefs(["music", "travel"]))).toEqual({ a: "a", b: "b", shared: ["music"] });
  });

  it("an interest beats a random stranger: gaming meets gaming, music keeps waiting", () => {
    const { m } = setup();
    m.enqueue("music", "PH", prefs(["music"]));
    expect(m.enqueue("gamer", "PH", prefs(["gaming"]))).toBeNull();
    expect(ids(m.enqueue("gamer2", "PH", prefs(["gaming"])))).toEqual(["gamer", "gamer2"]);
    expect(m.isWaiting("music")).toBe(true);
  });

  it("the most shared interests win", () => {
    const { clock, m } = setup();
    m.enqueue("one", "PH", prefs(["gaming"]));
    clock.advance(100);
    m.enqueue("two", "PH", prefs(["music", "travel"])); // shares nothing with "one", so both wait
    clock.advance(100);
    const match = m.enqueue("me", "PH", prefs(["gaming", "music", "travel"]));
    expect(ids(match)).toEqual(["me", "two"]); // two shared interests beat one
    expect(match?.shared.sort()).toEqual(["music", "travel"]);
    expect(m.isWaiting("one")).toBe(true);
  });

  it("a tie goes to whoever has waited longest (fairness)", () => {
    const { clock, m } = setup();
    m.enqueue("first", "PH", prefs(["gaming"]));
    clock.advance(1000);
    m.enqueue("second", "PH", prefs(["music"]));
    clock.advance(1000);
    // `third` shares one interest with each of the two (and nothing else): the older one wins.
    expect(ids(m.enqueue("third", "PH", prefs(["gaming", "music"])))).toEqual(["first", "third"]);
  });

  it("ignores duplicate interests", () => {
    const { m } = setup();
    m.enqueue("a", "PH", prefs(["gaming", "gaming"]));
    expect(m.enqueue("b", "PH", prefs(["gaming"]))?.shared).toEqual(["gaming"]);
  });

  it("someone who leaves is no longer a candidate for their interests", () => {
    const { m } = setup();
    m.enqueue("a", "PH", prefs(["gaming"]));
    m.remove("a");
    expect(m.enqueue("b", "PH", prefs(["gaming"]))).toBeNull();
  });
});

describe("fallback after 10 seconds (US-16)", () => {
  it("does nothing before the wait is over, and fires at exactly the wait", () => {
    const { clock, m } = setup();
    m.enqueue("a", "PH", prefs(["gaming"]));
    m.enqueue("b", "PH", prefs(["music"]));
    clock.advance(WAIT - 1);
    expect(m.sweep()).toEqual({ matches: [], opened: [] });
    clock.advance(1);
    const { matches } = m.sweep();
    expect(matches).toHaveLength(1);
    expect(ids(matches[0]!)).toEqual(["a", "b"]);
    expect(matches[0]!.shared).toEqual([]); // matched at random: nothing is claimed to be shared
    expect(m.size).toBe(0);
  });

  it("a person left alone is told they are open now, and then matched by whoever arrives", () => {
    const { clock, m } = setup();
    m.enqueue("a", "PH", prefs(["gaming"]));
    clock.advance(WAIT);
    expect(m.sweep()).toEqual({ matches: [], opened: ["a"] });
    expect(m.isInInterestPhase("a")).toBe(false);
    // Reported only once.
    expect(m.sweep()).toEqual({ matches: [], opened: [] });
    expect(ids(m.enqueue("b", "PH", prefs(["music"])) ?? m.sweep().matches[0] ?? null)).toBeNull(); // b still in its own interest phase
    clock.advance(WAIT);
    expect(m.sweep().matches).toHaveLength(1);
  });

  it("a newcomer with no interests is paired with someone already open", () => {
    const { clock, m } = setup();
    m.enqueue("a", "PH", prefs(["gaming"]));
    clock.advance(WAIT);
    m.sweep();
    expect(ids(m.enqueue("b", "PH", prefs()))).toEqual(["a", "b"]);
  });

  it("longest waiting open person is chosen first", () => {
    const { clock, m } = setup();
    m.enqueue("old", "PH", prefs(["gaming"]));
    clock.advance(1000);
    m.enqueue("new", "PH", prefs(["music"]));
    clock.advance(WAIT); // both open now, but compatible only with scope world: they pair with each other in sweep
    const { matches } = m.sweep();
    expect(matches).toHaveLength(1);
    expect(matches[0]!.a).toBe("old");
  });

  it("someone who left before the wait ended is never matched or reported", () => {
    const { clock, m } = setup();
    m.enqueue("a", "PH", prefs(["gaming"]));
    m.enqueue("b", "PH", prefs(["music"]));
    m.remove("a");
    clock.advance(WAIT);
    expect(m.sweep()).toEqual({ matches: [], opened: ["b"] });
  });

  it("a restarted search restarts the wait", () => {
    const { clock, m } = setup();
    m.enqueue("a", "PH", prefs(["gaming"]));
    clock.advance(WAIT - 100);
    m.enqueue("a", "PH", prefs(["gaming"])); // /next while searching
    clock.advance(200);
    expect(m.sweep()).toEqual({ matches: [], opened: [] });
  });
});

describe("country scope (US-15)", () => {
  it("'my country' pairs only people in the same known country, in both phases", () => {
    const { clock, m } = setup();
    m.enqueue("ph", "PH", prefs([], "local"));
    expect(m.enqueue("jp", "JP", prefs([], "local"))).toBeNull();
    expect(m.enqueue("de-world", "DE", prefs([], "world"))).toBeNull(); // ph wants PH only, jp wants JP only
    expect(ids(m.enqueue("ph2", "PH", prefs([], "local")))).toEqual(["ph", "ph2"]);
    expect(m.isWaiting("jp")).toBe(true);
    // A shared interest does not override the country wish.
    m.enqueue("g-ph", "PH", prefs(["gaming"], "local"));
    expect(m.enqueue("g-jp", "JP", prefs(["gaming"], "world"))).toBeNull();
    clock.advance(WAIT);
    expect(m.sweep().matches.map(ids)).not.toContainEqual(["g-jp", "g-ph"]);
  });

  it("a worldwide person is matched with a 'my country' person only inside that country", () => {
    const { m } = setup();
    m.enqueue("jp-local", "JP", prefs([], "local"));
    expect(m.enqueue("ph-world", "PH", prefs([], "world"))).toBeNull();
    expect(ids(m.enqueue("jp-world", "JP", prefs([], "world")))).toEqual(["jp-local", "jp-world"]);
  });

  it("an unknown country can never be matched locally", () => {
    const { m } = setup();
    m.enqueue("a", "XX", prefs([], "local"));
    expect(m.enqueue("b", "XX", prefs([], "world"))).toBeNull();
  });
});

describe("it keeps nothing about people once they are paired", () => {
  it("empties completely", () => {
    const { m } = setup();
    m.enqueue("a", "PH", prefs(["gaming", "music"]));
    m.enqueue("b", "PH", prefs(["music"]));
    expect(m.size).toBe(0);
    expect(m.isWaiting("a")).toBe(false);
    // The interest index is clean too: a new gamer is not matched with a ghost.
    expect(m.enqueue("c", "PH", prefs(["gaming"]))).toBeNull();
  });
});
