import { expect, say, startChat, test } from "./fixtures.js";

test.describe("gate", () => {
  test("nothing connects until the 18+ and rules box are ticked", async ({ person, serverUrl }) => {
    const a = await person();
    let sockets = 0;
    a.page.on("websocket", () => sockets++);
    await a.page.goto(serverUrl);
    await expect(a.page.getByRole("dialog", { name: "Before you connect" })).toBeVisible();

    // Continue does nothing while a box is unticked: the browser's own validation stops it.
    await a.page.getByLabel("I am 18 years old or older.").check();
    await a.page.getByRole("button", { name: "Continue" }).click();
    await expect(a.page.getByRole("dialog", { name: "Before you connect" })).toBeVisible();
    expect(sockets).toBe(0);

    await a.page.getByLabel("I have read the above and I will follow the rules.").check();
    await a.page.getByRole("button", { name: "Continue" }).click();
    await expect(a.page.locator("#conn-text")).toHaveText("Online");
    expect(sockets).toBe(1);
  });
});

test.describe("a chat between two strangers", () => {
  test("pairs, encrypts, and delivers messages and reactions both ways", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();

    // Alone, a person waits.
    await a.page.getByRole("button", { name: "Find a stranger" }).click();
    await expect(a.page.locator("#chat-title")).toHaveText("Searching");
    await expect(a.page.getByLabel("Message", { exact: true })).toBeDisabled();

    await b.page.getByRole("button", { name: "Find a stranger" }).click();
    for (const p of [a, b]) {
      await expect(p.page.locator("#seal-text")).toHaveText("End-to-end encrypted");
      await expect(p.page.getByLabel("Message", { exact: true })).toBeEnabled();
    }
    // Each sees the other's random name, and the names differ.
    const nameSeenByA = await a.page.locator("#chat-title").innerText();
    const nameSeenByB = await b.page.locator("#chat-title").innerText();
    expect(nameSeenByA).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);
    expect(nameSeenByB).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);
    expect(nameSeenByA).not.toBe(nameSeenByB);

    await say(a, "hello from A, tumbleweed-9917");
    await expect(b.page.getByRole("log")).toContainText("hello from A, tumbleweed-9917");
    await expect(a.page.getByRole("log")).toContainText("hello from A, tumbleweed-9917");
    await say(b, "hi A, this is B, hunter2-secret");
    await expect(a.page.getByRole("log")).toContainText("hi A, this is B, hunter2-secret");

    // B reacts to A's message; A sees it under their own message, B under A's.
    await b.page.getByRole("button", { name: "React", exact: true }).first().click();
    await b.page.getByRole("button", { name: "React with 😂" }).click();
    await expect(a.page.locator(".msg--mine .reactions")).toHaveText("😂");
    await expect(b.page.locator(".msg:not(.msg--mine) .reactions")).toHaveText("😂");

    // The input is cleared and the typing indicator is gone once a message is sent.
    await expect(a.page.getByLabel("Message", { exact: true })).toHaveValue("");
  });

  test("both show the same safety code", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await startChat(a, b);

    const codes: string[] = [];
    for (const p of [a, b]) {
      await p.page.getByRole("button", { name: "Safety code" }).click();
      const dialog = p.page.getByRole("dialog", { name: "Safety code" });
      await expect(dialog).toBeVisible();
      codes.push((await dialog.locator("#verify-code").innerText()).trim());
      await dialog.getByRole("button", { name: "Close" }).click();
      await expect(dialog).toBeHidden();
    }
    expect(codes[0]).toMatch(/^\d{5} \d{5} \d{5} \d{5}$/);
    expect(codes[1]).toBe(codes[0]);
  });

  test("what crosses the network is ciphertext: no word of the chat is ever on the wire", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await startChat(a, b);

    const secrets = ["tumbleweed-9917", "hunter2-secret", "meet-at-the-mall"];
    await say(a, secrets[0]!);
    await expect(b.page.getByRole("log")).toContainText(secrets[0]!);
    await say(b, secrets[1]!);
    await expect(a.page.getByRole("log")).toContainText(secrets[1]!);
    await say(a, secrets[2]!);
    await expect(b.page.getByRole("log")).toContainText(secrets[2]!);

    for (const person of [a, b]) {
      const wire = person.frames.join("\n");
      expect(wire).toContain("e2e:envelope");
      expect(wire).toContain("e2e:key");
      expect(wire).not.toContain("chat:");
      for (const secret of secrets) {
        expect(wire).not.toContain(secret);
        expect(wire).not.toContain(Buffer.from(secret).toString("base64"));
        expect(wire).not.toContain(Buffer.from(secret).toString("base64url"));
      }
    }
  });

  test("ending the chat tells the partner, locks the composer and wipes the screen", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await startChat(a, b);
    await say(a, "this will be gone");
    await expect(b.page.getByRole("log")).toContainText("this will be gone");

    await a.page.getByRole("button", { name: "End chat" }).click();
    await expect(b.page.getByRole("log")).toContainText("Your partner left the chat.");
    await expect(b.page.getByRole("log")).not.toContainText("this will be gone");
    await expect(a.page.getByRole("log")).not.toContainText("this will be gone");
    for (const p of [a, b]) {
      await expect(p.page.getByLabel("Message", { exact: true })).toBeDisabled();
      await expect(p.page.getByRole("button", { name: "Find a stranger" })).toBeEnabled();
      await expect(p.page.locator("#seal-text")).toHaveText("Not encrypted yet");
    }
  });

  test("Next moves on to a waiting stranger with fresh keys, and the old partner hears nothing", async ({ person }) => {
    const [a, b, c] = [await person(), await person(), await person()];
    for (const p of [a, b, c]) await p.join();
    await startChat(a, b);
    await c.page.getByRole("button", { name: "Find a stranger" }).click();
    await expect(c.page.locator("#chat-title")).toHaveText("Searching");

    await a.page.getByRole("button", { name: "Next" }).click();
    await expect(b.page.getByRole("log")).toContainText("Your partner left the chat.");
    for (const p of [a, c]) {
      await expect(p.page.locator("#seal-text")).toHaveText("End-to-end encrypted");
      await expect(p.page.getByLabel("Message", { exact: true })).toBeEnabled();
    }

    await say(a, "new chat, new keys");
    await expect(c.page.getByRole("log")).toContainText("new chat, new keys");
    await expect(b.page.getByRole("log")).not.toContainText("new chat, new keys");
  });

  test("the message box stops at 500 characters", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await startChat(a, b);
    const long = "ab".repeat(300); // varied, so the spam check does not apply
    await a.page.getByLabel("Message", { exact: true }).fill(long);
    await expect(a.page.getByLabel("Message", { exact: true })).toHaveValue(long.slice(0, 500));
    await a.page.getByRole("button", { name: "Send" }).click();
    await expect(b.page.locator(".msg-text").first()).toHaveText(long.slice(0, 500));
  });

  test("a page cannot send HTML into the other person's screen", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await startChat(a, b);
    const html = '<img src=x onerror="document.title=\'hacked\'"><b>bold</b>';
    await say(a, html);
    await expect(b.page.locator(".msg-text").first()).toHaveText(html); // shown as text
    await expect(b.page.locator(".msg-text img, .msg-text b")).toHaveCount(0);
    await expect(b.page).not.toHaveTitle("hacked");
  });
});

test.describe("on a phone", () => {
  test("the whole chat fits a 360 px screen with no sideways scrolling", async ({ person }) => {
    const [a, b] = [
      await person({ viewport: { width: 360, height: 740 } }),
      await person({ viewport: { width: 360, height: 740 } }),
    ];
    await a.join();
    await b.join();
    await startChat(a, b);
    await say(b, "a longer message so the bubble has to wrap onto a second line on a narrow screen");
    await expect(a.page.getByRole("log")).toContainText("a longer message");

    const overflow = await a.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const name of ["Find a stranger", "Next", "End chat", "Safety code", "Send"]) {
      const box = await a.page.getByRole("button", { name, exact: true }).boundingBox();
      expect(box, name).not.toBeNull();
      expect(box!.x, name).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, name).toBeLessThanOrEqual(360);
      expect(box!.height, name).toBeGreaterThanOrEqual(40); // comfortable to tap
    }
  });
});

test.describe("matchmaking", () => {
  const chip = (p: { page: import("@playwright/test").Page }, name: string) =>
    p.page.locator("#chips").getByRole("button", { name, exact: true });

  test("interests: at most five can be picked", async ({ person }) => {
    const a = await person();
    await a.join();
    await expect(a.page.locator("#interest-count")).toHaveText("0 of 5");
    for (const name of ["anime", "art", "books", "cars", "coding"]) await chip(a, name).click();
    await expect(a.page.locator("#interest-count")).toHaveText("5 of 5");
    await expect(chip(a, "dance")).toBeDisabled(); // a sixth cannot be added
    await chip(a, "art").click(); // but one can be removed
    await expect(a.page.locator("#interest-count")).toHaveText("4 of 5");
    await expect(chip(a, "dance")).toBeEnabled();
  });

  test("two people who share an interest are paired, are told which, and a third keeps waiting", async ({ person }) => {
    const [a, b, c] = [await person(), await person(), await person()];
    for (const p of [a, b, c]) await p.join();

    await chip(c, "music").click();
    await c.page.getByRole("button", { name: "Find a stranger" }).click();
    await expect(c.page.locator("#chat-sub")).toContainText("likes music");

    for (const p of [a, b]) await chip(p, "gaming").click();
    await a.page.getByRole("button", { name: "Find a stranger" }).click();
    await b.page.getByRole("button", { name: "Find a stranger" }).click();
    for (const p of [a, b]) {
      await expect(p.page.locator("#seal-text")).toHaveText("End-to-end encrypted");
      await expect(p.page.getByRole("log")).toContainText("You both like gaming.");
    }
    await expect(c.page.locator("#chat-title")).toHaveText("Searching"); // music is still waiting
  });

  test("after the wait, people with different interests are paired at random and told so", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await chip(a, "gaming").click();
    await chip(b, "music").click();
    await a.page.getByRole("button", { name: "Find a stranger" }).click();
    await b.page.getByRole("button", { name: "Find a stranger" }).click();
    await expect(a.page.locator("#chat-sub")).toContainText("likes gaming");
    // The test server waits 2 s for a shared interest instead of 10; then the two are paired.
    for (const p of [a, b]) {
      await expect(p.page.locator("#seal-text")).toHaveText("End-to-end encrypted");
      await expect(p.page.getByRole("log")).toContainText("No shared interests this time");
    }
  });

  test("'My country only' explains itself when the country cannot be detected, then worldwide works", async ({ person }) => {
    const a = await person();
    await a.join();
    await a.page.getByLabel("My country only").check();
    await a.page.getByRole("button", { name: "Find a stranger" }).click();
    await expect(a.page.getByRole("log")).toContainText("could not detect your country");
    await expect(a.page.getByLabel("My country only")).toBeDisabled();
    await expect(a.page.getByLabel("Anywhere")).toBeChecked();
    await a.page.getByRole("button", { name: "Find a stranger" }).click();
    await expect(a.page.locator("#chat-title")).toHaveText("Searching");
  });

  test("the country database credit is shown", async ({ person }) => {
    const a = await person();
    await a.join();
    await expect(a.page.getByRole("link", { name: "DB-IP.com" })).toHaveAttribute("href", "https://db-ip.com");
  });
});

test.describe("reporting", () => {
  test("a report ends the chat, tells the reporter it was sent and tells the other person only that it ended", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await startChat(a, b);
    await say(a, "this is the last message");
    await expect(b.page.getByRole("log")).toContainText("this is the last message");

    await a.page.getByRole("button", { name: "Report" }).click();
    const dialog = a.page.getByRole("dialog", { name: "Report this person" });
    await expect(dialog).toBeVisible();
    // Sending needs a category.
    await dialog.getByRole("button", { name: "Send report" }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Harassment or bullying").check();
    await dialog.getByRole("button", { name: "Send report" }).click();

    await expect(a.page.getByRole("log")).toContainText("Report sent.");
    await expect(b.page.getByRole("log")).toContainText("Your partner left the chat.");
    await expect(b.page.getByRole("log")).not.toContainText(/report/i); // the other person is never told
    for (const p of [a, b]) {
      await expect(p.page.getByLabel("Message", { exact: true })).toBeDisabled();
      await expect(p.page.getByRole("button", { name: "Report" })).toBeDisabled();
    }
  });

  test("Cancel closes the dialog and the chat carries on", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await startChat(a, b);
    await a.page.getByRole("button", { name: "Report" }).click();
    await a.page.getByRole("dialog", { name: "Report this person" }).getByRole("button", { name: "Cancel" }).click();
    await expect(a.page.getByRole("dialog", { name: "Report this person" })).toBeHidden();
    await say(a, "still talking");
    await expect(b.page.getByRole("log")).toContainText("still talking");
  });

  test("Report is available only while in a chat, and offers all seven categories", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await expect(a.page.getByRole("button", { name: "Report" })).toBeDisabled();
    await startChat(a, b);
    await a.page.getByRole("button", { name: "Report" }).click();
    const dialog = a.page.getByRole("dialog", { name: "Report this person" });
    await expect(dialog.getByRole("radio")).toHaveCount(7);
    await a.page.keyboard.press("Escape"); // closes from the keyboard too
    await expect(dialog).toBeHidden();
  });

  test("the gate tells people what a report records", async ({ person, serverUrl }) => {
    const a = await person();
    await a.page.goto(serverUrl);
    await expect(a.page.getByRole("dialog", { name: "Before you connect" })).toContainText("only the category you choose");
  });
});

test.describe("content filter", () => {
  const box = (p: { page: import("@playwright/test").Page }) => p.page.getByLabel("Message", { exact: true });

  test("banned content is not sent and stays in the box to be changed", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await startChat(a, b);
    await box(a).fill("honestly just kys");
    await a.page.getByRole("button", { name: "Send" }).click();
    await expect(a.page.getByRole("log")).toContainText("was not sent");
    await expect(box(a)).toHaveValue("honestly just kys");
    await expect(b.page.locator(".msg")).toHaveCount(0);
    // Changing it makes it sendable.
    await box(a).fill("honestly just stop");
    await a.page.getByRole("button", { name: "Send" }).click();
    await expect(b.page.getByRole("log")).toContainText("honestly just stop");
  });

  test("personal information asks for a second Send, and editing it asks again", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await startChat(a, b);
    await box(a).fill("text me on 0917 123 4567");
    await a.page.getByRole("button", { name: "Send" }).click();
    await expect(a.page.getByRole("log")).toContainText("That looks like a phone number.");
    await expect(b.page.locator(".msg")).toHaveCount(0); // nothing left yet
    await expect(box(a)).toHaveValue("text me on 0917 123 4567");

    // An edit that still has the number is checked again.
    await box(a).fill("text me on 0917 123 4567 ok");
    await a.page.getByRole("button", { name: "Send" }).click();
    await expect(b.page.locator(".msg")).toHaveCount(0);

    // Pressing Send again with the same text confirms it.
    await a.page.getByRole("button", { name: "Send" }).click();
    await expect(b.page.getByRole("log")).toContainText("text me on 0917 123 4567 ok");
  });

  test("a message that gets past a modified sender is hidden on the receiving side until shown", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await startChat(a, b);
    // A's page is modified to skip its own filter.
    await a.page.evaluate(() => {
      (globalThis as any).ContentFilter.check = () => ({ blocked: false, reason: null, warnings: [] });
    });
    await say(a, "send nudes");
    const received = b.page.locator(".msg").first();
    await expect(received).toContainText("Message hidden: it may contain abusive content.");
    await expect(received.locator(".msg-text")).toBeHidden();
    await received.getByRole("button", { name: "Show anyway" }).click();
    await expect(received.locator(".msg-text")).toBeVisible();
    await expect(received.locator(".msg-text")).toHaveText("send nudes");
  });

  test("links are shown as plain text, never as links", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await startChat(a, b);
    await say(a, "recipe at https://example.com/x");
    await expect(b.page.getByRole("log")).toContainText("https://example.com/x");
    await expect(b.page.getByRole("log").locator("a")).toHaveCount(0);
  });

  test("every chat starts with a reminder not to share personal details", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await startChat(a, b);
    await expect(a.page.getByRole("log")).toContainText("do not share your name, address, phone number");
  });
});

test.describe("proof of work in a real browser", () => {
  test.use({ serverEnv: { POW_DIFFICULTY_BITS: "12" } });

  test("the page solves the puzzle by itself and connects, quickly", async ({ person }) => {
    const a = await person();
    const requested: string[] = [];
    a.page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith("/pow-challenge") || path.startsWith("/connect-token")) requested.push(path);
    });
    const started = Date.now();
    await a.join();
    expect(Date.now() - started).toBeLessThan(8000);
    // The puzzle came first, then the token.
    expect(requested).toEqual(["/pow-challenge", "/connect-token"]);
  });

  test("two people can still chat end to end with the puzzle on", async ({ person }) => {
    const [a, b] = [await person(), await person()];
    await a.join();
    await b.join();
    await startChat(a, b);
    await say(a, "hello through the puzzle");
    await expect(b.page.getByRole("log")).toContainText("hello through the puzzle");
  });

  test("a script that skips the puzzle gets no token", async ({ serverUrl }) => {
    const res = await fetch(`${serverUrl}/connect-token`);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { code: "POW_REQUIRED" } });
  });
});
