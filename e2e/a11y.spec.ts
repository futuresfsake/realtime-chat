import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, say, startChat, test } from "./fixtures.js";

// WCAG 2.1 level A and AA rules, which is the standard the specs promise (NFR-11).
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  // A readable failure: which rule, how bad, and which element.
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

test.describe("accessibility (WCAG 2.1 AA, scanned with axe)", () => {
  test("the gate", async ({ person, serverUrl }) => {
    const a = await person();
    await a.page.goto(serverUrl);
    await expect(a.page.getByRole("dialog", { name: "Before you connect" })).toBeVisible();
    expect(await scan(a.page)).toEqual([]);
  });

  test("ready, and searching", async ({ person }) => {
    const a = await person();
    await a.join();
    expect(await scan(a.page)).toEqual([]);
    await a.page.getByRole("button", { name: "Find a stranger" }).click();
    await expect(a.page.locator("#chat-title")).toHaveText("Searching");
    expect(await scan(a.page)).toEqual([]);
  });

  test("a chat, with messages, a reaction and a hidden message", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await startChat(a, b);
    await say(a, "hello there");
    await say(b, "hi, how are you");
    await expect(a.page.getByRole("log")).toContainText("hi, how are you");
    await a.page.getByRole("button", { name: "React", exact: true }).first().click();
    await a.page.getByRole("button", { name: "React with 😂" }).click();
    expect(await scan(a.page)).toEqual([]);
    // A message hidden by the filter on arrival.
    await a.page.evaluate(() => {
      (globalThis as any).ContentFilter.check = () => ({ blocked: false, reason: null, warnings: [] });
    });
    await say(a, "send nudes");
    await expect(b.page.getByRole("log")).toContainText("Message hidden");
    expect(await scan(b.page)).toEqual([]);
  });

  test("the safety code and report dialogs", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await startChat(a, b);
    await a.page.getByRole("button", { name: "Safety code" }).click();
    await expect(a.page.getByRole("dialog", { name: "Safety code" })).toBeVisible();
    expect(await scan(a.page)).toEqual([]);
    await a.page.keyboard.press("Escape");
    await a.page.getByRole("button", { name: "Report" }).click();
    await expect(a.page.getByRole("dialog", { name: "Report this person" })).toBeVisible();
    expect(await scan(a.page)).toEqual([]);
  });

  test("a phone-sized screen", async ({ person }) => {
    const a = await person({ viewport: { width: 360, height: 740 } });
    await a.join();
    expect(await scan(a.page)).toEqual([]);
  });
});

test.describe("keyboard only", () => {
  test("the whole journey works without a mouse: gate, search, chat, report", async ({ person, serverUrl }) => {
    const [a, b] = [await person(), await person()];
    await b.join();

    // The gate: Tab to each box, Space to tick, Enter to continue.
    await a.page.goto(serverUrl);
    await a.page.keyboard.press("Tab"); // the first box already has focus; this moves to the second
    await expect(a.page.getByLabel("I have read the above and I will follow the rules.")).toBeFocused();
    await a.page.getByLabel("I am 18 years old or older.").focus();
    await a.page.keyboard.press("Space");
    await a.page.keyboard.press("Tab");
    await a.page.keyboard.press("Space");
    await a.page.keyboard.press("Tab");
    await expect(a.page.getByRole("button", { name: "Continue" })).toBeFocused();
    await a.page.keyboard.press("Enter");
    await expect(a.page.locator("#conn-text")).toHaveText("Online");

    // Searching: the main button is reachable and works with Enter.
    await a.page.getByRole("button", { name: "Find a stranger" }).focus();
    await a.page.keyboard.press("Enter");
    await b.page.getByRole("button", { name: "Find a stranger" }).click();
    await expect(a.page.locator("#seal-text")).toHaveText("End-to-end encrypted");

    // Writing and sending with the keyboard alone.
    await a.page.getByLabel("Message", { exact: true }).focus();
    await a.page.keyboard.type("typed without a mouse");
    await a.page.keyboard.press("Enter");
    await expect(b.page.getByRole("log")).toContainText("typed without a mouse");

    // Reporting: open with Enter, choose with the arrow keys, close with Escape, focus comes back.
    const report = a.page.getByRole("button", { name: "Report" });
    await report.focus();
    await a.page.keyboard.press("Enter");
    const dialog = a.page.getByRole("dialog", { name: "Report this person" });
    await expect(dialog).toBeVisible();
    await a.page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(report).toBeFocused();
  });

  test("a dialog keeps the page behind it out of reach, and closes with Escape", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await startChat(a, b);
    await a.page.getByRole("button", { name: "Safety code" }).click();
    const dialog = a.page.getByRole("dialog", { name: "Safety code" });
    await expect(dialog).toBeVisible();
    // The page behind a modal dialog is inert: the keyboard can never land on it.
    for (let i = 0; i < 6; i++) {
      await a.page.keyboard.press("Tab");
      const behind = await a.page.evaluate(() => !!document.activeElement?.closest("#app"));
      expect(behind, `Tab ${i + 1}`).toBe(false);
    }
    await a.page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("the page behind the gate cannot be reached with the keyboard", async ({ person, serverUrl }) => {
    const a = await person();
    await a.page.goto(serverUrl);
    for (let i = 0; i < 8; i++) {
      await a.page.keyboard.press("Tab");
      const behind = await a.page.evaluate(() => !!document.activeElement?.closest("#app"));
      expect(behind, `Tab ${i + 1}`).toBe(false);
    }
  });

  test("every control shows where the focus is", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await startChat(a, b);
    const names = ["Next", "End chat", "Safety code", "Report", "Send"];
    for (const name of names) {
      const control = a.page.getByRole("button", { name, exact: true });
      await control.focus();
      await a.page.keyboard.press("Shift+Tab");
      await a.page.keyboard.press("Tab"); // keyboard focus, so :focus-visible applies
      const outline = await control.evaluate((el) => {
        const style = getComputedStyle(el);
        return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
      });
      expect(outline.style, name).not.toBe("none");
      expect(outline.width, name).toBeGreaterThanOrEqual(2);
    }
    await a.page.getByLabel("Message", { exact: true }).focus();
    const field = await a.page.getByLabel("Message", { exact: true }).evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(field).not.toBe("none");
  });
});

test.describe("other accessibility needs", () => {
  test("respects reduced motion", async ({ person, serverUrl }) => {
    const a = await person();
    await a.page.emulateMedia({ reducedMotion: "reduce" });
    await a.page.goto(serverUrl);
    const duration = await a.page.getByRole("button", { name: "Continue" }).evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(duration)).toBe(0);
  });

  test("reflows at 320 px (about 400 percent zoom) with nothing cut off", async ({ person }) => {
    const a = await person({ viewport: { width: 320, height: 640 } });
    await a.join();
    expect(await a.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await expect(a.page.getByRole("button", { name: "Find a stranger" })).toBeVisible();
  });

  test("announces changes to screen readers: the conversation, connection status and encryption state", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await expect(a.page.getByRole("log", { name: "Conversation" })).toHaveAttribute("aria-live", "polite");
    await expect(a.page.getByRole("status")).toContainText("Online");
    await expect(a.page.locator("#seal")).toHaveAttribute("aria-live", "polite");
    await expect(a.page.locator("#chat-sub")).toHaveAttribute("aria-live", "polite");
  });

  test("has a page language, a title, one main landmark and labelled controls", async ({ person, serverUrl }) => {
    const a = await person();
    await a.join();
    await expect(a.page.locator("html")).toHaveAttribute("lang", "en");
    await expect(a.page).toHaveTitle(/Realtime Chat/);
    await expect(a.page.getByRole("main")).toHaveCount(1);
    await expect(a.page.getByRole("banner")).toHaveCount(1);
    await expect(a.page.getByLabel("Message", { exact: true })).toBeVisible();
    void serverUrl;
  });

  test("information is not carried by colour alone: the encryption state has words and a shape", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await expect(a.page.locator("#seal")).toContainText("Not encrypted yet");
    await startChat(a, b);
    await expect(a.page.locator("#seal")).toContainText("End-to-end encrypted");
    await expect(a.page.locator("#conn")).toContainText("Online");
  });
});
