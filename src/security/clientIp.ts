// The ONLY place in the codebase that touches a raw IP address.
// Callers must pass the result straight to the IP hasher and never store or
// log it (RA 10173 data minimisation; enforced by a CI check).

// Behind a proxy (Render) the TCP peer is the proxy, and the real client is in
// X-Forwarded-For. Clients can prepend fake entries to that header, so we only
// trust the entry added by our own proxy: the Nth from the right.
export function clientIp(
  forwardedFor: string | string[] | undefined,
  remoteAddress: string | undefined,
  trustProxyHops: number,
): string {
  const direct = normalize(remoteAddress);
  if (trustProxyHops <= 0 || forwardedFor === undefined) return direct;

  const header = Array.isArray(forwardedFor) ? forwardedFor.join(",") : forwardedFor;
  const parts = header
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) return direct;

  const index = Math.max(0, parts.length - trustProxyHops);
  return normalize(parts[index]);
}

function normalize(address: string | undefined): string {
  if (!address) return "unknown";
  // IPv4 reported through an IPv6 socket: "::ffff:203.0.113.7"
  return address.startsWith("::ffff:") ? address.slice(7) : address;
}
