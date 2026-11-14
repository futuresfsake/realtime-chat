import AxeBuilder from "@axe-core/playwright";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { buildDemo } from "../scripts/build-demo.js";
import { serveDirectory } from "../scripts/serve-demo.js";

// The browser-only demo: the real page with a simulated server and partner
// (demo/demo-server.js). It is built once for these tests and served from a
// temporary folder.
const test = base.extend<object, { demoUrl: string }>({
  demoUrl: [
    async ({}, use) => {
      const dir = mkdtempSync(path.join(tmpdir(), "demo-"));
      buildDemo(dir);
      const server = await serveDirectory(dir, 0);
      const { port } = server.address() as { port: number };
      try {
        await use(`http://127.0.0.1:${port}/`);
      } finally {
        server.close();
        rmSync(dir, { recursive: true, force: true });
      }
    },
    { scope: "worker" },
  ],
});

const box = (page: Page) => page.getByLabel("Message", { exact: true });

async function enter(page: Page, url: string) {
  await page.goto(url);
  await page.getByLabel("I understand this is a simulation: the partner is a script, not a person.").check();
  await page.getByLabel("I have read the above.").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#conn-text")).toHaveText("Online");
}

async function meetPartner(page: Page) {
  await page.getByRole("button", { name: "Find a stranger" }).click();
  await expect(page.locator("#chat-title")).toHaveText("demo-partner");
  await expect(page.locator("#seal-text")).toHaveText("End-to-end encrypted");
}

test.describe("the demo says what it is", () => {
  test("the gate, banner, title and footer all say it is a simulation, and the partner is named as one", async ({ page, demoUrl }) => {
    await page.goto(demoUrl);
    const gate = page.getByRole("dialog", { name: "This is a demo" });
    await expect(gate).toBeVisible();
    await expect(gate).toContainText("simulated partner");
    await expect(gate).toContainText("not a person");
    await expect(gate).toContainText("no server and no network");
    await expect(page).toHaveTitle(/demo with a simulated partner/i);
    await enter(page, demoUrl);
    await expect(page.locator("#preview-banner")).toContainText("your partner is a simulation");
    await expect(page.locator(".credit")).toContainText("A demo with a simulated partner");
    await meetPartner(page);
    // The partner introduces itself as a script before anything else.
    await expect(page.getByRole("log")).toContainText("I am a simulated partner: a script running in this page, not a person");
  });
});

test.describe("the demo works end to end, with real encryption", () => {
  test("pairs, encrypts, the partner types and answers, reacts, and the safety codes match", async ({ page, demoUrl }) => {
    await enter(page, demoUrl);
    await meetPartner(page);
    await expect(page.getByRole("log")).toContainText("simulated partner");

    await box(page).fill("hello, is anyone there?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("log")).toContainText("hello, is anyone there?");
    // The partner "types", then answers with the next line of its script, and reacts to the message.
    await expect(page.locator("#typing")).toContainText("demo-partner is typing");
    await expect(page.getByRole("log")).toContainText("really encrypted in your browser");
    await expect(page.locator(".msg--mine .reactions").first()).toHaveText("👍");

    // Both ends derived the same safety code from the real key exchange.
    await page.getByRole("button", { name: "Safety code" }).click();
    const dialog = page.getByRole("dialog", { name: "Safety code" });
    const shown = (await dialog.locator("#verify-code").innerText()).trim();
    expect(shown).toMatch(/^\d{5} \d{5} \d{5} \d{5}$/);
    expect(await page.evaluate(() => (globalThis as any).DemoServer.partnerSafetyCode())).toBe(shown);
  });

  test("the user can react, report, end the chat and skip to a new one with new keys", async ({ page, demoUrl }) => {
    await enter(page, demoUrl);
    await meetPartner(page);
    await expect(page.getByRole("log")).toContainText("simulated partner");

    await page.getByRole("button", { name: "React", exact: true }).first().click();
    await page.getByRole("button", { name: "React with 😂" }).click();
    await expect(page.locator(".msg:not(.msg--mine) .reactions").first()).toHaveText("😂");

    await page.getByRole("button", { name: "Safety code" }).click();
    const first = (await page.locator("#verify-code").innerText()).trim();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.locator("#chat-title")).toHaveText("demo-partner");
    await expect(page.locator("#seal-text")).toHaveText("End-to-end encrypted");
    await page.getByRole("button", { name: "Safety code" }).click();
    const second = (await page.locator("#verify-code").innerText()).trim();
    expect(second).not.toBe(first); // fresh keys for every chat
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Report" }).click();
    await page.getByRole("dialog", { name: "Report this person" }).getByLabel("Spam or scams").check();
    await page.getByRole("button", { name: "Send report" }).click();
    await expect(page.getByRole("log")).toContainText("Report sent.");
    await expect(box(page)).toBeDisabled();

    await meetPartner(page); // and a new chat can start again
    await page.getByRole("button", { name: "End chat" }).click();
    await expect(page.getByRole("log")).toContainText("You ended the chat.");
  });

  test("interests are shown as shared, and 'my country only' is refused as it is without a country database", async ({ page, demoUrl }) => {
    await enter(page, demoUrl);
    await page.locator("#chips").getByRole("button", { name: "gaming", exact: true }).click();
    await page.getByRole("button", { name: "Find a stranger" }).click();
    await expect(page.getByRole("log")).toContainText("You both like gaming.");
    await page.getByRole("button", { name: "End chat" }).click();

    await page.getByLabel("My country only").check();
    await page.getByRole("button", { name: "Find a stranger" }).click();
    await expect(page.getByRole("log")).toContainText("could not detect your country");
  });

  test("it rate limits messages like the real server: a burst of 5, then 'slow down'", async ({ page, demoUrl }) => {
    await enter(page, demoUrl);
    await meetPartner(page);
    for (let i = 0; i < 7; i++) {
      await box(page).fill(`message number ${i}`);
      await page.getByRole("button", { name: "Send" }).click();
    }
    await expect(page.getByRole("log")).toContainText("Slow down");
  });

  test("the content filter still works in the demo", async ({ page, demoUrl }) => {
    await enter(page, demoUrl);
    await meetPartner(page);
    await box(page).fill("text me on 0917 123 4567");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("log")).toContainText("That looks like a phone number.");
  });
});

test.describe("the demo makes no network requests", () => {
  test("nothing is sent to a server, a WebSocket is never opened, and nothing leaves the page", async ({ page, demoUrl }) => {
    const origin = new URL(demoUrl).origin;
    const requests: string[] = [];
    let sockets = 0;
    page.on("request", (request) => requests.push(request.url()));
    page.on("websocket", () => sockets++);

    await enter(page, demoUrl);
    await meetPartner(page);
    await box(page).fill("this stays in the page");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("log")).toContainText("this stays in the page");
    await expect(page.getByRole("log")).toContainText("really encrypted in your browser");

    expect(sockets).toBe(0);
    for (const url of requests) expect(url.startsWith(origin), url).toBe(true); // only the page's own files
    for (const url of requests) expect(url, url).not.toMatch(/socket\.io|connect-token|pow-challenge|\/health/);
    // Nothing was written to browser storage except the gate acknowledgement.
    const storage = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }));
    expect(storage.local).toEqual([]);
    expect(storage.session).toEqual(["rtc.consent"]);
  });
});

test.describe("the demo is accessible", () => {
  test("axe finds nothing on the gate, the chat and the dialogs", async ({ page, demoUrl }) => {
    const scan = async () =>
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
      );
    await page.goto(demoUrl);
    expect(await scan()).toEqual([]);
    await enter(page, demoUrl);
    await meetPartner(page);
    await expect(page.getByRole("log")).toContainText("simulated partner");
    expect(await scan()).toEqual([]);
    await page.getByRole("button", { name: "Safety code" }).click();
    expect(await scan()).toEqual([]);
  });
});
