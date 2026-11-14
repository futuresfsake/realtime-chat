// A moderator's view of the server logs (US-31).
//
//   npm run moderation -- <logfile> [--since 24h|7d|90m|2026-11-01] [--json]
//   some-command-that-prints-logs | npm run moderation -- - --since 24h
//
// It only reads log lines (JSON, one per line, as the server writes them) and
// shows categories, counts, times and 8 character hash prefixes. It does not
// connect to the server and cannot show messages or addresses: the logs do not
// have them. See docs/09-compliance/moderator-guide.md.
import { readFileSync } from "node:fs";
import { parseSince, renderModerationSummary, summariseModerationLogs } from "../src/observability/moderationSummary.js";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1] === "--since"));
const source = positional[0];

if (!source || flag("--help")) {
  process.stderr.write("usage: npm run moderation -- <logfile | -> [--since 24h|7d|90m|YYYY-MM-DD] [--json]\n");
  process.exit(source ? 0 : 2);
}

let since: number | undefined;
if (value("--since")) {
  const parsed = parseSince(value("--since")!, Date.now());
  if (parsed === null) {
    process.stderr.write(`could not understand --since ${value("--since")} (try 24h, 7d, 90m or a date)\n`);
    process.exit(2);
  }
  since = parsed;
}

let text: string;
try {
  text = readFileSync(source === "-" ? 0 : source, "utf8");
} catch {
  process.stderr.write(`could not read ${source}\n`);
  process.exit(2);
}

const summary = summariseModerationLogs(text.split(/\r?\n/), since === undefined ? {} : { since });
process.stdout.write(`${flag("--json") ? JSON.stringify(summary, null, 2) : renderModerationSummary(summary)}\n`);
