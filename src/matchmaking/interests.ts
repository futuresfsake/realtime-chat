// The interests a person can pick (US-14). A fixed list, never free text: free
// text would let people type names, handles or abuse, and the server could not
// tell. Excluded on purpose: dating and sexual topics, politics and religion
// (high conflict and harassment risk), anything that invites personal details.
// See docs/03-design/matchmaking.md.
export const ALLOWED_INTERESTS = [
  "anime", "art", "books", "cars", "coding", "cooking", "dance", "design", "fashion", "fitness",
  "food", "gaming", "history", "languages", "memes", "movies", "music", "nature", "pets", "philosophy",
  "photography", "science", "space", "sports", "study", "technology", "travel", "tv-series", "writing",
] as const;

export type Interest = (typeof ALLOWED_INTERESTS)[number];

export const MAX_INTERESTS = 5;

// Where a person is willing to be matched: anyone, or only their own country.
export type Scope = "local" | "world";

// Sent when a person starts or skips: what they are looking for.
export interface SearchPrefs {
  interests: readonly Interest[];
  scope: Scope;
}

// "XX" means the country could not be detected.
export const UNKNOWN_COUNTRY = "XX";
