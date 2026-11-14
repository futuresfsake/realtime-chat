import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { test as base, expect } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";

export { expect };

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

async function waitForHealth(url: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early with code ${child.exitCode}`);
    try {
      if ((await fetch(`${url}/health`)).ok) return;
    } catch {
      /* not listening yet */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("server did not become healthy in 20 s");
}

// One client of the chat: its own browser context (so its own storage and
// socket), and a record of every WebSocket frame it sent or received.
export interface Person {
  page: Page;
  context: BrowserContext;
  frames: string[];
  // Open the site and accept the 18+ and rules gate.
  join(): Promise<void>;
}

export interface Fixtures {
  // A fresh server on a free port, so the real per-address rate limits of one
  // test never leak into the next.
  serverUrl: string;
  // Makes a new person (a separate browser context) on that server.
  person: (options?: { viewport?: { width: number; height: number } }) => Promise<Person>;
}

async function makePerson(
  browser: Browser,
  serverUrl: string,
  options: { viewport?: { width: number; height: number } } = {},
): Promise<Person> {
  const context = await browser.newContext(options.viewport ? { viewport: options.viewport } : {});
  const page = await context.newPage();
  const frames: string[] = [];
  page.on("websocket", (ws) => {
    ws.on("framesent", (frame) => frames.push(String(frame.payload)));
    ws.on("framereceived", (frame) => frames.push(String(frame.payload)));
  });
  return {
    page,
    context,
    frames,
    async join() {
      await page.goto(serverUrl);
      await page.getByLabel("I am 18 years old or older.").check();
      await page.getByLabel("I have read the above and I will follow the rules.").check();
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.locator("#conn-text")).toHaveText("Online");
    },
  };
}

export const test = base.extend<Fixtures>({
  serverUrl: async ({}, use) => {
    const port = await freePort();
    const url = `http://localhost:${port}`;
    const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
      env: { ...process.env, PORT: String(port), ALLOWED_ORIGINS: url, NODE_ENV: "development", LOG_LEVEL: "error", INTEREST_WAIT_MS: "2000" },
      stdio: ["ignore", "ignore", "inherit"],
    });
    try {
      await waitForHealth(url, child);
      await use(url);
    } finally {
      child.kill();
    }
  },

  person: async ({ browser, serverUrl }, use) => {
    const people: Person[] = [];
    await use(async (options) => {
      const made = await makePerson(browser, serverUrl, options);
      people.push(made);
      return made;
    });
    for (const p of people) await p.context.close();
  },
});

// Both people press "Find a stranger" and end up paired and encrypted.
export async function startChat(a: Person, b: Person): Promise<void> {
  await a.page.getByRole("button", { name: "Find a stranger" }).click();
  await b.page.getByRole("button", { name: "Find a stranger" }).click();
  for (const p of [a, b]) {
    await expect(p.page.locator("#seal-text")).toHaveText("End-to-end encrypted");
    await expect(p.page.getByLabel("Message")).toBeEnabled();
  }
}

export async function say(from: Person, text: string): Promise<void> {
  await from.page.getByLabel("Message").fill(text);
  await from.page.getByRole("button", { name: "Send" }).click();
}
