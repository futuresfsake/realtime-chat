import { describe, expect, it } from "vitest";
import { SimpleMatchmaker } from "../../../src/matchmaking/simpleMatchmaker.js";

describe("SimpleMatchmaker", () => {
  it("makes the first client wait and pairs the second with it", () => {
    const m = new SimpleMatchmaker();
    expect(m.enqueue("a")).toBeNull();
    expect(m.enqueue("b")).toEqual(["a", "b"]);
  });
  it("leaves a third client waiting", () => {
    const m = new SimpleMatchmaker();
    m.enqueue("a");
    m.enqueue("b");
    expect(m.enqueue("c")).toBeNull();
    expect(m.enqueue("d")).toEqual(["c", "d"]);
  });
  it("never pairs a client with itself", () => {
    const m = new SimpleMatchmaker();
    m.enqueue("a");
    expect(m.enqueue("a")).toBeNull();
    expect(m.isWaiting("a")).toBe(true);
  });
  it("forgets a client that leaves the queue", () => {
    const m = new SimpleMatchmaker();
    m.enqueue("a");
    m.remove("a");
    expect(m.isWaiting("a")).toBe(false);
    expect(m.enqueue("b")).toBeNull();
  });
});
