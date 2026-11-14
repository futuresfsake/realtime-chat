// Builds the browser-only demo (npm run build:demo, output: demo-dist/).
//
// The demo is NOT a copy of the page. It is generated from the real public/
// files, so it cannot drift from the real interface: the same index.html, the
// same client.js, the same crypto, filter and session code. Only three things
// change, and each is a marked substitution that FAILS THE BUILD if the real
// page changes in a way this script does not expect:
//   1. the gate text, which says this is a simulation;
//   2. the banner and footer, which say so again;
//   3. the Socket.IO client script, replaced by demo/demo-server.js, which
//      plays the server and a scripted partner inside the page.
// The result is a static folder that needs no server and makes no network
// requests, so it can be published on any static host (GitHub Pages).
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ALLOWED_INTERESTS } from "../src/matchmaking/interests.js";
import { REPORT_CATEGORIES } from "../src/safety/categories.js";

const root = process.cwd();

// Replaces one marked piece of text, and refuses to continue if it is not there.
function replaceOnce(text: string, marker: string, replacement: string, what: string): string {
  const at = text.indexOf(marker);
  if (at < 0) throw new Error(`build-demo: could not find ${what} in the real page. The real page changed: update scripts/build-demo.ts.`);
  return text.slice(0, at) + replacement + text.slice(at + marker.length);
}

// Replaces everything from `start` up to and including `end`.
function replaceRange(text: string, start: string, end: string, replacement: string, what: string): string {
  const from = text.indexOf(start);
  if (from < 0) throw new Error(`build-demo: could not find the start of ${what}. The real page changed: update scripts/build-demo.ts.`);
  const to = text.indexOf(end, from);
  if (to < 0) throw new Error(`build-demo: could not find the end of ${what}. The real page changed: update scripts/build-demo.ts.`);
  return text.slice(0, from) + replacement + text.slice(to + end.length);
}

const DEMO_GATE = `<form id="gate-form" class="gate-box">
      <h1 id="gate-title">This is a demo</h1>

      <h2>What you are about to see</h2>
      <ul>
        <li>This page is the <strong>real interface</strong> of a chat app, running with a <strong>simulated partner</strong>. The partner is a short script in this page. It is <strong>not a person</strong> and it does not read or understand what you write.</li>
        <li>There is <strong>no server and no network</strong> here. Nothing you type leaves this page, and nothing is stored.</li>
        <li>The encryption is real: a key exchange and AES-GCM through your browser's WebCrypto, with the safety code both sides derive. But both ends are in your browser, so this shows <em>how it works</em>, not what a server can or cannot read. That claim belongs to the real app and its tests.</li>
        <li>What the demo does not show: finding strangers, the server, rate limits across people, or reports reaching anyone.</li>
      </ul>

      <label class="check"><input type="checkbox" id="gate-adult" required /> <span>I understand this is a simulation: the partner is a script, not a person.</span></label>
      <label class="check"><input type="checkbox" id="gate-rules" required /> <span>I have read the above.</span></label>

      <button type="submit" id="gate-enter" class="btn btn-primary">Continue</button>
      <p class="fine">Demo build. Notice version <span id="gate-version"></span></p>
    </form>`;

// `sourceRoot` is the folder holding public/ and demo/ (the repository, except in tests).
export function buildDemo(outDir: string = path.join(root, "demo-dist"), sourceRoot: string = root): void {
  const read = (rel: string) => readFileSync(path.join(sourceRoot, rel), "utf8");
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(path.join(outDir, "demo"), { recursive: true });

  // ---- the page ----
  let html = read("public/index.html");
  html = replaceOnce(html, "<title>Realtime Chat — anonymous one-to-one chat</title>", "<title>Realtime Chat: demo with a simulated partner</title>", "the title");
  html = replaceOnce(
    html,
    '<meta charset="utf-8" />',
    `<meta charset="utf-8" />\n  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'" />`,
    "the charset meta",
  );
  html = replaceRange(html, '<form id="gate-form" class="gate-box">', "</form>", DEMO_GATE, "the gate form");
  html = replaceOnce(
    html,
    "Preview: not launched yet. Things may break or reset at any time.",
    "DEMO: your partner is a simulation, a script running in this page. There is no server, and nothing leaves your browser.",
    "the preview banner text",
  );
  html = replaceRange(
    html,
    '<footer class="credit">',
    "</footer>",
    `<footer class="credit">A demo with a simulated partner. The real app, its server and its tests are in <a href="https://github.com/futuresfsake/realtime-chat" rel="noopener noreferrer">the repository</a>.</footer>`,
    "the footer",
  );
  html = replaceOnce(
    html,
    '<script src="/socket.io/socket.io.js"></script>',
    '<script src="demo/data.js"></script>\n  <script src="demo/demo-server.js"></script>',
    "the Socket.IO client script",
  );
  // Absolute paths (/styles.css) become relative so the demo works from any folder, such as /repo-name/ on GitHub Pages.
  html = html.replace(/(src|href)="\/(?!\/)/g, '$1="').replace(/href=""/g, 'href="./"');

  // ---- the files ----
  writeFileSync(path.join(outDir, "index.html"), html);
  writeFileSync(path.join(outDir, "styles.css"), read("public/styles.css").replace(/url\("\/fonts\//g, 'url("fonts/'));
  cpSync(path.join(sourceRoot, "public/client.js"), path.join(outDir, "client.js"));
  cpSync(path.join(sourceRoot, "public/favicon.svg"), path.join(outDir, "favicon.svg"));
  cpSync(path.join(sourceRoot, "public/js"), path.join(outDir, "js"), { recursive: true });
  cpSync(path.join(sourceRoot, "public/fonts"), path.join(outDir, "fonts"), { recursive: true });
  cpSync(path.join(sourceRoot, "demo/demo-server.js"), path.join(outDir, "demo/demo-server.js"));

  // The two lists the simulated server needs, taken from the real source so they cannot drift.
  writeFileSync(
    path.join(outDir, "demo/data.js"),
    `// Generated by scripts/build-demo.ts from src/. Do not edit.\nglobalThis.DEMO_DATA = ${JSON.stringify({ interests: ALLOWED_INTERESTS, reportCategories: REPORT_CATEGORIES })};\n`,
  );
  // GitHub Pages: serve the files as they are.
  writeFileSync(path.join(outDir, ".nojekyll"), "");

  if (!existsSync(path.join(outDir, "index.html"))) throw new Error("build-demo: nothing was written");
}

// Run directly: npm run build:demo [outDir]
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "demo-dist");
  buildDemo(out);
  process.stdout.write(`demo built in ${path.relative(root, out) || out}\n`);
}
