// Random display names like "quiet-otter-42". Users never choose their name.
// Word rules: lowercase, alphabetic, <= 8 chars, nothing offensive, nothing
// that reads as a real first name.

export const ADJECTIVES: readonly string[] = [
  "quiet", "brave", "calm", "swift", "bright", "gentle", "clever", "happy", "lucky", "mellow",
  "noble", "proud", "witty", "sunny", "cosmic", "dusty", "eager", "fancy", "golden", "humble",
  "jolly", "keen", "lively", "misty", "nimble", "olive", "polite", "rapid", "silent", "tidy",
  "upbeat", "vivid", "warm", "zesty", "amber", "breezy", "cozy", "dapper", "fuzzy", "hidden",
  "icy", "jazzy", "kind", "lunar", "minty", "neat", "plucky", "rustic", "snowy", "wild",
];

export const ANIMALS: readonly string[] = [
  "otter", "fox", "hawk", "wolf", "bear", "panda", "koala", "lynx", "heron", "falcon",
  "badger", "beaver", "bison", "camel", "cobra", "crane", "deer", "eagle", "finch", "gecko",
  "hare", "ibis", "jaguar", "kiwi", "lemur", "llama", "moose", "newt", "ocelot", "owl",
  "parrot", "quail", "raven", "seal", "tiger", "turtle", "viper", "walrus", "wombat", "yak",
  "zebra", "dolphin", "puffin", "sparrow", "stoat", "tapir", "toucan", "marten", "ferret", "gull",
];

export function generateName(rng: () => number = Math.random): string {
  const pick = (list: readonly string[]): string => list[Math.min(list.length - 1, Math.floor(rng() * list.length))]!;
  const num = String(Math.min(99, Math.floor(rng() * 100))).padStart(2, "0");
  return `${pick(ADJECTIVES)}-${pick(ANIMALS)}-${num}`;
}
