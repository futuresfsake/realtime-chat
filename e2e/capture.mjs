// Records the README screenshots and the demo GIF from the real app: it starts
// a server, drives two real browsers through a chat, and saves what person A
// sees. Run with `npm run e2e:capture`. Nothing here is staged.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { chromium } from "@playwright/test";
import gifenc from "gifenc";
import pngjs from "pngjs";

const { GIFEncoder, applyPalette, quantize } = gifenc;
const { PNG } = pngjs;

const OUT = path.resolve("docs/assets");
mkdirSync(OUT, { recursive: true });
const VIEW = { width: 900, height: 640 };

const port = await new Promise((resolve) => {
  const probe = createServer();
  probe.listen(0, "127.0.0.1", () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});
const url = `http://localhost:${port}`;
const server = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
  env: { ...process.env, PORT: String(port), ALLOWED_ORIGINS: url, NODE_ENV: "development", LOG_LEVEL: "error" },
  stdio: ["ignore", "ignore", "inherit"],
});
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch(`${url}/health`)).ok) break;
  } catch {
    /* not up yet */
  }
  await new Promise((r) => setTimeout(r, 150));
}

const channel = process.env.E2E_BROWSER === "chromium" ? undefined : "msedge";
const browser = await chromium.launch({ channel });
const frames = []; // PNG buffers of what person A sees, in order, for the GIF

async function open(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(url);
  return { context, page };
}
async function consent(page) {
  await page.getByLabel("I am 18 years old or older.").check();
  await page.getByLabel("I have read the above and I will follow the rules.").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator("#conn-text").getByText("Online").waitFor();
}
async function still(page, name, { frame = false } = {}) {
  const png = await page.screenshot();
  if (name) writeFileSync(path.join(OUT, `${name}.png`), png);
  if (frame) frames.push(png);
}
const say = async (page, text) => {
  await page.getByLabel("Message").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
};
const secured = (page) => page.locator("#seal-text").getByText("End-to-end encrypted").waitFor();

try {
  const a = await open(VIEW);
  const b = await open(VIEW);

  await still(a.page, "gate", { frame: true });
  await consent(a.page);
  await consent(b.page);
  await a.page.locator("#btn-start").waitFor();
  await still(a.page, "idle", { frame: true });

  await a.page.getByRole("button", { name: "Find a stranger" }).click();
  await a.page.locator("#chat-title").getByText("Searching").waitFor();
  await still(a.page, "searching", { frame: true });

  await b.page.getByRole("button", { name: "Find a stranger" }).click();
  await Promise.all([secured(a.page), secured(b.page)]);
  await a.page.getByLabel("Message").isEnabled();
  await still(a.page, null, { frame: true });

  await say(b.page, "hey, where are you from?");
  await a.page.getByRole("log").getByText("where are you from").waitFor();
  await still(a.page, null, { frame: true });

  await say(a.page, "Manila! you?");
  await b.page.getByRole("log").getByText("Manila!").waitFor();
  await say(b.page, "Cebu. Long chat about nothing?");
  await a.page.getByRole("log").getByText("Cebu.").waitFor();
  await still(a.page, null, { frame: true });

  await a.page.getByRole("button", { name: "React", exact: true }).last().click();
  await a.page.getByRole("button", { name: "React with 😂" }).click();
  await b.page.locator(".msg--mine .reactions").last().waitFor();
  await still(a.page, "chat", { frame: true });

  await a.page.getByRole("button", { name: "Safety code" }).click();
  await a.page.getByRole("dialog", { name: "Safety code" }).waitFor();
  await still(a.page, "safety-code", { frame: true });
  await a.page.getByRole("button", { name: "Close" }).click();

  await a.page.getByRole("button", { name: "End chat" }).click();
  await a.page.getByRole("log").getByText("You ended the chat.").waitFor();
  await still(a.page, null, { frame: true });

  // The same chat on a phone-sized screen.
  const phone = { width: 390, height: 780 };
  const c = await open(phone);
  const d = await open(phone);
  await consent(c.page);
  await consent(d.page);
  await c.page.getByRole("button", { name: "Find a stranger" }).click();
  await d.page.getByRole("button", { name: "Find a stranger" }).click();
  await Promise.all([secured(c.page), secured(d.page)]);
  await say(d.page, "hey, where are you from?");
  await c.page.getByRole("log").getByText("where are you from").waitFor();
  await say(c.page, "Manila! you?");
  await d.page.getByRole("log").getByText("Manila!").waitFor();
  await still(c.page, "chat-mobile");

  // Build the GIF: one palette per frame, a pause on each, a longer one on the last.
  const gif = GIFEncoder();
  frames.forEach((buf, i) => {
    const { width, height, data } = PNG.sync.read(buf);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), width, height, {
      palette,
      delay: i === frames.length - 1 ? 2600 : i < 3 ? 1400 : 1900,
    });
  });
  gif.finish();
  writeFileSync(path.join(OUT, "demo.gif"), gif.bytes());
  console.log(`wrote ${frames.length} frames and 6 screenshots to ${OUT}`);
} finally {
  await browser.close();
  server.kill();
}
