// M3 matchmaking: first two searchers are paired. No interests, no country.
// Replaced by the real matchmaker in M5.
export class SimpleMatchmaker {
  private waiting: string | null = null;

  // Returns the pair to start a session for, or null if the client must wait.
  enqueue(socketId: string): [string, string] | null {
    if (this.waiting !== null && this.waiting !== socketId) {
      const pair: [string, string] = [this.waiting, socketId];
      this.waiting = null;
      return pair;
    }
    this.waiting = socketId;
    return null;
  }

  remove(socketId: string): void {
    if (this.waiting === socketId) this.waiting = null;
  }

  isWaiting(socketId: string): boolean {
    return this.waiting === socketId;
  }
}
