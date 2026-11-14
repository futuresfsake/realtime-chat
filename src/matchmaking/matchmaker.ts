import type { Clock } from "../lib/clock.js";
import { compatible } from "./compatibility.js";
import type { Interest, SearchPrefs } from "./interests.js";

export interface Match {
  a: string; // the one who waited longest
  b: string;
  shared: Interest[]; // interests both picked (empty for an open match)
}

interface Waiting {
  id: string;
  country: string;
  interests: readonly Interest[];
  scope: SearchPrefs["scope"];
  since: number;
  open: boolean; // true once it will accept anyone compatible
}

// Pairs strangers (US-14, US-15, US-16):
//   1. Interest phase: only someone who shares at least one interest. The most
//      shared interests win; a tie goes to whoever has waited longest.
//   2. Open phase: after `interestWaitMs` (at once, if no interests were
//      picked) anyone compatible who is also open, longest waiting first.
// Both people's country preferences must always be satisfied.
//
// Like SessionManager it is synchronous and knows nothing about sockets, so
// two people searching at the same moment can never interleave. Time comes
// from the injected Clock; the caller asks for expired waits with sweep().
export class Matchmaker {
  private readonly waiting = new Map<string, Waiting>(); // insertion order = oldest first
  private readonly byInterest = new Map<Interest, Set<string>>();

  constructor(
    private readonly clock: Clock,
    private readonly interestWaitMs: number,
  ) {}

  get size(): number {
    return this.waiting.size;
  }

  isWaiting(id: string): boolean {
    return this.waiting.has(id);
  }

  // Is this waiting person still limiting themselves to shared interests?
  isInInterestPhase(id: string): boolean {
    const entry = this.waiting.get(id);
    return entry !== undefined && !entry.open;
  }

  // Returns the match to start, or null if this person must wait. Searching
  // again while already waiting replaces the earlier search.
  enqueue(id: string, country: string, prefs: SearchPrefs): Match | null {
    this.remove(id);
    const me: Waiting = {
      id,
      country,
      interests: [...new Set(prefs.interests)],
      scope: prefs.scope,
      since: this.clock.now(),
      open: prefs.interests.length === 0,
    };

    const byInterest = this.bestInterestMatch(me);
    if (byInterest) return this.pair(me, byInterest);
    if (me.open) {
      const anyone = this.firstOpen(me);
      if (anyone) return this.pair(me, anyone);
    }
    this.add(me);
    return null;
  }

  // Moves everyone whose interest wait has run out into the open phase and
  // pairs whoever can now be paired. `opened` lists the people who widened to
  // "anyone" and are still waiting, so they can be told. Call about once a second.
  sweep(): { matches: Match[]; opened: string[] } {
    const now = this.clock.now();
    const due = [...this.waiting.values()].filter((w) => !w.open && now - w.since >= this.interestWaitMs);
    const matches: Match[] = [];
    const opened: string[] = [];
    for (const entry of due) {
      const current = this.waiting.get(entry.id);
      if (!current || current.open) continue; // paired or changed meanwhile
      current.open = true;
      const partner = this.firstOpen(current);
      if (partner) matches.push(this.pair(current, partner));
      else opened.push(current.id);
    }
    return { matches, opened: opened.filter((id) => this.waiting.has(id)) };
  }

  remove(id: string): void {
    const entry = this.waiting.get(id);
    if (!entry) return;
    this.waiting.delete(id);
    for (const interest of entry.interests) {
      const set = this.byInterest.get(interest);
      set?.delete(id);
      if (set?.size === 0) this.byInterest.delete(interest);
    }
  }

  private add(entry: Waiting): void {
    this.waiting.set(entry.id, entry);
    for (const interest of entry.interests) {
      const set = this.byInterest.get(interest) ?? new Set<string>();
      set.add(entry.id);
      this.byInterest.set(interest, set);
    }
  }

  private shared(a: Waiting, b: Waiting): Interest[] {
    return a.interests.filter((i) => b.interests.includes(i));
  }

  // The compatible waiting person sharing the most interests with `me`.
  private bestInterestMatch(me: Waiting): Waiting | null {
    let best: { entry: Waiting; score: number } | null = null;
    const seen = new Set<string>();
    for (const interest of me.interests) {
      for (const id of this.byInterest.get(interest) ?? []) {
        if (seen.has(id)) continue;
        seen.add(id);
        const other = this.waiting.get(id);
        if (!other || !compatible(me, other)) continue;
        const score = this.shared(me, other).length;
        if (!best || score > best.score || (score === best.score && other.since < best.entry.since)) {
          best = { entry: other, score };
        }
      }
    }
    return best?.entry ?? null;
  }

  // The longest-waiting open person compatible with `me`.
  private firstOpen(me: Waiting): Waiting | null {
    for (const other of this.waiting.values()) {
      if (other.open && compatible(me, other)) return other;
    }
    return null;
  }

  private pair(me: Waiting, other: Waiting): Match {
    this.remove(other.id);
    this.remove(me.id);
    const [first, second] = other.since <= me.since ? [other, me] : [me, other];
    return { a: first.id, b: second.id, shared: this.shared(first, second) };
  }
}
