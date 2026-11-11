// Checks that run before a socket is allowed to connect.

// Exact match only: no prefix, suffix or wildcard matching. A missing or
// "null" Origin (sandboxed iframe, file://, non-browser script) is refused.
export function checkOrigin(origin: string | undefined, allowedOrigins: readonly string[]): boolean {
  if (!origin || origin === "null") return false;
  return allowedOrigins.includes(origin);
}

// Caps how many sockets one IP hash may hold open at the same time.
export class IpSocketCap {
  private readonly socketsPerIp = new Map<string, Set<string>>();

  constructor(private readonly max: number) {}

  add(ipHash: string, socketId: string): boolean {
    const sockets = this.socketsPerIp.get(ipHash) ?? new Set<string>();
    if (sockets.size >= this.max) return false;
    sockets.add(socketId);
    this.socketsPerIp.set(ipHash, sockets);
    return true;
  }

  remove(ipHash: string, socketId: string): void {
    const sockets = this.socketsPerIp.get(ipHash);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) this.socketsPerIp.delete(ipHash);
  }

  count(ipHash: string): number {
    return this.socketsPerIp.get(ipHash)?.size ?? 0;
  }
}
