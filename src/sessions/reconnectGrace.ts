// One countdown per dropped socket. If the socket comes back in time the
// countdown is cancelled; otherwise onExpire runs once and the chat ends.
export class GraceTimers {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  // Starts (or restarts) the countdown for this socket id.
  hold(socketId: string, ms: number, onExpire: () => void): void {
    this.cancel(socketId);
    const timer = setTimeout(() => {
      this.timers.delete(socketId);
      onExpire();
    }, ms);
    timer.unref(); // never keeps the process alive during shutdown
    this.timers.set(socketId, timer);
  }

  // True if there was a countdown to cancel: the socket came back in time.
  cancel(socketId: string): boolean {
    const timer = this.timers.get(socketId);
    if (!timer) return false;
    clearTimeout(timer);
    this.timers.delete(socketId);
    return true;
  }

  has(socketId: string): boolean {
    return this.timers.has(socketId);
  }

  get size(): number {
    return this.timers.size;
  }

  // Shutdown: drop every countdown without running it.
  clear(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
