import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildDemo } from "../../../scripts/build-demo.js";

const root = process.cwd();
const made: string[] = [];
const temp = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "demo-build-"));
  made.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

const out = temp();
buildDemo(out);
const html = readFileSync(path.join(out, "index.html"), "utf8");
const read = (...parts: string[]) => readFileSync(path.join(...parts), "utf8");

describe("the demo is built from the real page", () => {
  it("uses the REAL client, crypto, filter and session code, byte for byte", () => {
    for (const file of ["client.js", "js/crypto.js", "js/contentFilter.js", "js/bannedWords.js", "js/sessionStore.js", "js/pow.js", "favicon.svg"]) {
      expect(read(out, file), file).toBe(read(root, "public", file));
    }
  });

  it("changes the stylesheet only to make font paths relative", () => {
    expect(read(out, "styles.css")).toBe(read(root, "public/styles.css").replace(/url\("\/fonts\//g, 'url("fonts/'));
  });

  it("contains the real page's interface: the same buttons, dialogs and regions", () => {
    const real = read(root, "public/index.html");
    for (const id of ["btn-start", "btn-next", "btn-leave", "btn-verify", "btn-report", "log", "prompt", "chips", "verify", "report", "seal", "conn"]) {
      expect(real, `real page: ${id}`).toContain(`id="${id}"`);
      expect(html, `demo page: ${id}`).toContain(`id="${id}"`);
    }
  });

  it("has the simulated server and no Socket.IO client", () => {
    expect(html).toContain('<script src="demo/demo-server.js"></script>');
    expect(html).not.toContain("socket.io");
    expect(existsSync(path.join(out, "demo/demo-server.js"))).toBe(true);
  });

  it("loads the lists the simulated server needs before it, generated from the real source", () => {
    expect(html.indexOf("demo/data.js")).toBeGreaterThan(-1);
    expect(html.indexOf("demo/data.js")).toBeLessThan(html.indexOf("demo/demo-server.js"));
    expect(html.indexOf("demo/demo-server.js")).toBeLessThan(html.indexOf('src="client.js"'));
    const data = read(out, "demo/data.js");
    expect(data).toContain('"gaming"');
    expect(data).toContain('"harassment"');
  });
});

describe("the demo says what it is", () => {
  it("replaces the gate, the banner and the footer with plain statements that it is a simulation", () => {
    expect(html).toContain("This is a demo");
    expect(html).toContain("not a person");
    expect(html).toContain("no server and no network");
    expect(html).toContain("DEMO: your partner is a simulation");
    expect(html).toContain("A demo with a simulated partner");
    expect(html).not.toContain("Before you connect"); // the real gate is gone
    expect(html).not.toContain("Country detection uses IP geolocation"); // and so is the real footer
  });

  it("does not claim the real app's privacy promises about a server", () => {
    expect(html).not.toMatch(/Render in Singapore|hashed form of it|server's memory/);
  });
});

describe("the demo can be published anywhere", () => {
  it("uses only relative paths, so it works from a sub-folder such as /repo-name/", () => {
    expect(html).not.toMatch(/(?:src|href)="\/(?!\/)/);
    expect(read(out, "styles.css")).not.toMatch(/url\("\//);
  });

  it("carries its own Content-Security-Policy: our files only, no network, no inline script", () => {
    const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1] ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|https?:/);
    for (const tag of html.match(/<script\b[^>]*>/g) ?? []) expect(tag).toContain("src=");
  });

  it("tells GitHub Pages to serve the files as they are", () => {
    expect(existsSync(path.join(out, ".nojekyll"))).toBe(true);
  });

  it("is small", () => {
    let bytes = 0;
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(path.join(dir, entry.name));
        else bytes += readFileSync(path.join(dir, entry.name)).length;
      }
    };
    walk(out);
    expect(bytes).toBeLessThan(300 * 1024);
  });
});

describe("the simulated server", () => {
  const code = read(root, "demo/demo-server.js");

  it("says at the top that it is a simulation and what is real and what is not", () => {
    expect(code.split("\n").slice(0, 25).join("\n")).toMatch(/SIMULATION/);
    expect(code).toMatch(/What is REAL here/);
    expect(code).toMatch(/What is NOT/);
  });

  it("opens no connection and stores nothing: no WebSocket, no XHR, no beacon, no storage, no cookies", () => {
    expect(code).not.toMatch(/new WebSocket|XMLHttpRequest|sendBeacon|EventSource|localStorage|sessionStorage|indexedDB|document\.cookie/);
  });

  it("refuses any request it does not know, instead of sending it anywhere", () => {
    expect(code).toMatch(/the demo makes no network requests/);
  });

  it("introduces itself as a script, never as a person", () => {
    expect(code).toMatch(/I am a simulated partner: a script running in this page, not a person/);
    expect(code).toMatch(/const PARTNER_NAME = "demo-partner"/);
  });
});

describe("the build refuses to guess", () => {
  // A copy of just the files the build reads, so one can be broken.
  function sourceCopy(): string {
    const dir = temp();
    mkdirSync(path.join(dir, "public"), { recursive: true });
    for (const name of ["index.html", "styles.css", "client.js", "favicon.svg"]) cpSync(path.join(root, "public", name), path.join(dir, "public", name));
    cpSync(path.join(root, "public/js"), path.join(dir, "public/js"), { recursive: true });
    cpSync(path.join(root, "public/fonts"), path.join(dir, "public/fonts"), { recursive: true });
    mkdirSync(path.join(dir, "demo"));
    cpSync(path.join(root, "demo/demo-server.js"), path.join(dir, "demo/demo-server.js"));
    return dir;
  }

  it("builds from an untouched copy", () => {
    expect(() => buildDemo(temp(), sourceCopy())).not.toThrow();
  });

  it.each([
    ['<form id="gate-form" class="gate-box">', "the gate form"],
    ["Preview: not launched yet. Things may break or reset at any time.", "the preview banner text"],
    ['<script src="/socket.io/socket.io.js"></script>', "the Socket.IO client script"],
    ['<footer class="credit">', "the footer"],
    ["<title>Realtime Chat — anonymous one-to-one chat</title>", "the title"],
  ])("fails loudly if the real page loses %s", (marker, what) => {
    const source = sourceCopy();
    const file = path.join(source, "public/index.html");
    writeFileSync(file, readFileSync(file, "utf8").replace(marker, "<!-- changed -->"));
    expect(() => buildDemo(temp(), source)).toThrow(new RegExp(`${what.split(" ").slice(-2).join(" ")}.*real page changed`, "s"));
  });
});
