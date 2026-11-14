import { UNKNOWN_COUNTRY } from "./interests.js";
import type { Scope } from "./interests.js";

export interface Candidate {
  id: string;
  country: string; // ISO 3166-1 alpha-2, or "XX" when unknown
  scope: Scope;
}

// Does x's own preference accept y? "local" needs a known country that is
// also y's. An unknown country can never match locally.
function scopeAllows(x: Candidate, y: Candidate): boolean {
  return x.scope === "world" || (x.country !== UNKNOWN_COUNTRY && x.country === y.country);
}

// Two people may be paired only if BOTH preferences are satisfied. Pure, so
// the whole table can be tested (docs/03-design/matchmaking.md section 3).
export function compatible(a: Candidate, b: Candidate): boolean {
  return a.id !== b.id && scopeAllows(a, b) && scopeAllows(b, a);
}
