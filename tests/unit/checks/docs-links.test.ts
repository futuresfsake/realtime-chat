import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The docs are large, so a moved or renamed file quietly breaks links. This
// checks that every relative link in every Markdown file points at a file or
// folder that exists, and that a link to a heading inside a file finds it.
// External links (https://...) are not fetched: a test that needs the network
// would fail for reasons that are not ours.

function markdownFiles(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist" || name === "test-results") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) markdownFiles(full, found);
    else if (name.endsWith(".md")) found.push(full);
  }
  return found;
}

// GitHub's rule for turning a heading into an anchor.
function slug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-");
}

function anchorsOf(file: string): Set<string> {
  const anchors = new Set<string>();
  let inFence = false;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const heading = !inFence && /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) anchors.add(slug(heading[1]!));
  }
  return anchors;
}

function linksOf(file: string): { text: string; target: string }[] {
  const links: { text: string; target: string }[] = [];
  let inFence = false;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const bare = line.replace(/`[^`]*`/g, ""); // inline code is not a link
    for (const m of bare.matchAll(/!?\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) links.push({ text: m[1]!, target: m[2]! });
  }
  return links;
}

const root = process.cwd();
const files = markdownFiles(root).filter((f) => !f.includes(`${path.sep}docs${path.sep}10-reviews${path.sep}`));

describe("documentation links", () => {
  it("checks a real set of documents", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("every relative link points at something that exists", () => {
    const broken: string[] = [];
    for (const file of files) {
      for (const { text, target } of linksOf(file)) {
        if (/^(https?:|mailto:|tel:|#)/.test(target)) continue;
        const [filePart] = target.split("#");
        const resolved = path.resolve(path.dirname(file), decodeURIComponent(filePart!));
        if (!existsSync(resolved)) broken.push(`${path.relative(root, file)}: [${text}](${target})`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("every link to a heading finds that heading", () => {
    const broken: string[] = [];
    for (const file of files) {
      for (const { text, target } of linksOf(file)) {
        if (/^(https?:|mailto:|tel:)/.test(target) || !target.includes("#")) continue;
        const [filePart, anchor] = target.split("#");
        const resolved = filePart ? path.resolve(path.dirname(file), decodeURIComponent(filePart)) : file;
        if (!existsSync(resolved) || !resolved.endsWith(".md") || !anchor) continue; // missing files are reported above
        if (!anchorsOf(resolved).has(anchor.toLowerCase())) broken.push(`${path.relative(root, file)}: [${text}](${target})`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("the checker itself understands the cases it is meant to catch", () => {
    expect(slug("What this does not protect against")).toBe("what-this-does-not-protect-against");
    expect(slug("4. Staged plan")).toBe("4-staged-plan");
    expect(slug("Why `localhost`?")).toBe("why-localhost");
  });
});
