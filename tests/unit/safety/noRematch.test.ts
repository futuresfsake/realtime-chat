import { describe, expect, it } from "vitest";
import { FakeClock } from "../../../src/lib/clock.js";
import { NoRematch } from "../../../src/safety/noRematch.js";

const DAY = 24 * 60 * 60 * 1000;
const ana = { ipHash: "ip-ana", id: "sock-1" };
const ben = { ipHash: "ip-ben", id: "sock-2" };
const cy = { ipHash: "ip-cy", id: "sock-3" };

function setup(max?: number) {
  const clock = new FakeClock(1_000_000);
  return { clock, list: new NoRematch(clock, DAY, max) };
}

describe("people on different addresses", () => {
  it("blocks the pair in both directions, and nobody else", () => {
    const { list } = setup();
    list.add(ana, ben);
    expect(list.blocked(ana, ben)).toBe(true);
    expect(list.blocked(ben, ana)).toBe(true);
    expect(list.blocked(ana, cy)).toBe(false);
    expect(list.blocked(ben, cy)).toBe(false);
  });

  it("recognises the same person on a new connection (reconnect, new tab)", () => {
    const { list } = setup();
    list.add(ana, ben);
    expect(list.blocked({ ...ana, id: "sock-99" }, { ...ben, id: "sock-98" })).toBe(true);
  });

  it("lets them meet again exactly when the period is over", () => {
    const { clock, list } = setup();
    list.add(ana, ben);
    clock.advance(DAY - 1);
    expect(list.blocked(ana, ben)).toBe(true);
    clock.advance(1);
    expect(list.blocked(ana, ben)).toBe(false);
    expect(list.size).toBe(0); // and the record is gone, not just ignored
  });

  it("parting again restarts the period", () => {
    const { clock, list } = setup();
    list.add(ana, ben);
    clock.advance(DAY - 10);
    list.add(ana, ben);
    clock.advance(20);
    expect(list.blocked(ana, ben)).toBe(true);
    expect(list.size).toBe(1);
  });
});

describe("people sharing one address", () => {
  const home1 = { ipHash: "same-network", id: "sock-1" };
  const home2 = { ipHash: "same-network", id: "sock-2" };
  const home3 = { ipHash: "same-network", id: "sock-3" };

  it("are blocked per connection, so the rest of the network is not affected", () => {
    const { list } = setup();
    list.add(home1, home2);
    expect(list.blocked(home1, home2)).toBe(true);
    expect(list.blocked(home2, home1)).toBe(true);
    expect(list.blocked(home1, home3)).toBe(false);
    expect(list.blocked(home2, home3)).toBe(false);
    expect(list.blocked(home3, ana)).toBe(false);
  });

  it("a block between two people on different addresses does not block their neighbours", () => {
    const { list } = setup();
    list.add(ana, ben);
    expect(list.blocked({ ipHash: "ip-ana", id: "sock-7" }, { ipHash: "ip-cy", id: "sock-8" })).toBe(false);
  });
});

describe("memory", () => {
  it("never holds more than its bound, forgetting the oldest first", () => {
    const { clock, list } = setup(3);
    for (let i = 0; i < 5; i++) {
      list.add({ ipHash: `a${i}`, id: `x${i}` }, { ipHash: `b${i}`, id: `y${i}` });
      clock.advance(1);
    }
    expect(list.size).toBe(3);
    expect(list.blocked({ ipHash: "a0", id: "" }, { ipHash: "b0", id: "" })).toBe(false); // oldest gone
    expect(list.blocked({ ipHash: "a4", id: "" }, { ipHash: "b4", id: "" })).toBe(true); // newest kept
  });

  it("clears expired records when new ones arrive", () => {
    const { clock, list } = setup();
    list.add(ana, ben);
    clock.advance(DAY + 1);
    list.add(ana, cy);
    expect(list.size).toBe(1);
  });
});
