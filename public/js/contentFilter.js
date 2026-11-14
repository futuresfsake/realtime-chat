// Content filter (US-28). Runs in the browser, because the server only ever
// sees ciphertext. It runs on BOTH ends:
//   - when you send: a message with banned content is not sent; a message that
//     looks like personal information or spam asks you to confirm first;
//   - when one arrives: a message with banned content is hidden behind "Show".
//     The receiving side is the one that matters, because the other person's
//     page could be modified to skip its own check.
//
// Honest limit (accepted risk, docs/04-security/threat-model.md): a filter in a
// browser can be got around by someone determined. It stops accidents and
// casual abuse, and it protects the reader; it is not moderation.
//
// A plain script (no modules): it exposes one global, ContentFilter.
(function () {
  "use strict";

  const words = globalThis.BannedWords || [];

  // Makes common disguises comparable: accents, capitals, look-alike digits
  // and symbols ("n1gg3r"), punctuation between words, and letters spaced out
  // one by one ("k.y.s"). Used for banned words only; personal information is
  // read from the original text.
  function normalize(text) {
    return String(text)
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[@4]/g, "a")
      .replace(/3/g, "e")
      .replace(/1/g, "i")
      .replace(/0/g, "o")
      .replace(/[$5]/g, "s")
      .replace(/7/g, "t")
      .replace(/9/g, "g")
      .replace(/[^a-z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      // "k y s" (from "k.y.s.") -> "kys": a run of single letters is one word.
      .replace(/\b(?:[a-z] )+[a-z]\b/g, (run) => run.replace(/ /g, ""));
  }

  // One pattern per entry: whole words only, each letter may be stretched
  // ("niiigger", "killll") but a doubled letter must stay doubled, so "niger"
  // (the country) never matches "nigger". An optional plural "s".
  const patterns = words.map((entry) => {
    const body = normalize(entry)
      .split("")
      .map((ch) => (ch === " " ? " +" : `${ch}+`))
      .join("");
    return new RegExp(`(?:^| )${body}s?(?= |$)`);
  });

  function hasBannedContent(text) {
    const flat = normalize(text);
    return patterns.some((pattern) => pattern.test(flat));
  }

  // Personal information the sender probably did not mean to share.
  const PHONE = /(?:\+?\d[\s().-]?){9,}\d/; // ten digits or more, however they are spaced
  const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/;
  // "@name"; or a platform name, then a separator and a name ("ig: juan"); or a
  // platform name and a name that looks like an account (has a digit, "_" or
  // "."), which catches "my insta is juan123" without flagging "the ig of it".
  const PLATFORM = "ig|insta|instagram|fb|facebook|tiktok|snap|snapchat|telegram|viber|whatsapp|discord|messenger|twitter";
  const HANDLE = new RegExp(
    "(?:^|[^\\w@])@[a-z0-9_.]{3,}" +
      "|\\b(?:" + PLATFORM + ")\\b\\s*[:=@-]\\s*@?[a-z0-9_.]{3,}" +
      "|\\b(?:" + PLATFORM + ")\\b\\s+(?:is\\s+)?@?(?=[a-z0-9_.]*[\\d_.])[a-z0-9_.]{3,}",
    "i",
  );

  function check(text) {
    const result = { blocked: false, reason: null, warnings: [] };
    if (typeof text !== "string") return result;

    if (hasBannedContent(text)) {
      result.blocked = true;
      result.reason = "banned";
      return result;
    }

    if (PHONE.test(text)) result.warnings.push("phone_number");
    if (EMAIL.test(text)) result.warnings.push("email");
    if (HANDLE.test(text)) result.warnings.push("social_handle");

    // Spam: one character stretched, or a long shout.
    if (/(.)\1{11,}/.test(text)) result.warnings.push("spam_repetition");
    const letters = text.replace(/[^A-Za-z]/g, "");
    if (letters.length >= 15 && letters === letters.toUpperCase()) result.warnings.push("excessive_caps");

    return result;
  }

  // What to tell the sender about each warning.
  const WARNING_TEXT = {
    phone_number: "That looks like a phone number.",
    email: "That looks like an email address.",
    social_handle: "That looks like a social media account.",
    spam_repetition: "That looks like spam (a repeated character).",
    excessive_caps: "That looks like shouting (all capitals).",
  };

  globalThis.ContentFilter = { check, hasBannedContent, normalize, WARNING_TEXT };
})();
