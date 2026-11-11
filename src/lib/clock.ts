// Time is injected so rate limits, token expiry and salt rotation can be
// tested with a fake clock instead of real waiting.
export interface Clock {
  now(): number; // epoch ms
}

export const realClock: Clock = { now: () => Date.now() };

export class FakeClock implements Clock {
  constructor(private time = 0) {}
  now(): number {
    return this.time;
  }
  advance(ms: number): void {
    this.time += ms;
  }
  set(ms: number): void {
    this.time = ms;
  }
}
