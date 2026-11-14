// A SIMULATION of the server and of the other person, running inside this page.
//
// The demo page is the real page (same HTML, same client.js, same crypto
// code). This file stands in for two things the real app has and this page
// does not: the Socket.IO server, and a stranger. It replaces `io()` with an
// object that speaks the same events, and plays both the server and a partner
// that answers from a short script.
//
// What is REAL here: the interface, the key exchange (ECDH P-256 + HKDF), the
// AES-GCM encryption of every message, the replay and tamper checks, and the
// safety code, all through WebCrypto. Your messages are encrypted in your
// browser, decrypted by the simulated partner's own keys, and the replies are
// encrypted back.
// What is NOT: there is no server, no network, no other person, no matching,
// no real rate limiting across people, no reports reaching anyone, and the
// partner does not read or understand what you write. Nothing leaves this page.
//
// A plain script (no modules). It must be loaded before client.js.
(function () {
  "use strict";

  const E2EE = globalThis.E2EE;
  const REACTIONS = globalThis.SessionStore.ALLOWED_REACTIONS;
  const REPORT_REASONS = globalThis.DEMO_DATA.reportCategories;
  const INTERESTS = globalThis.DEMO_DATA.interests;

  const PARTNER_NAME = "demo-partner";
  const SEARCH_MS = 1200; // how long "looking for someone" takes
  const MESSAGE_BURST = 5; // the real server allows 5 messages in a burst, then one every 2 s
  const MESSAGE_REFILL_PER_SEC = 0.5;

  // What the partner says, in order. Honest about what it is, and it never
  // pretends to be a person. It does not read what you write.
  const SCRIPT = [
    "Hi! I am a simulated partner: a script running in this page, not a person.",
    "Everything you type is really encrypted in your browser before I see it. Open Safety code: the code I derived is the one you see.",
    "In the real app the other side is a stranger, and the server in between cannot read a word. Here there is no server at all.",
    "Try a reaction on one of my messages, Report, or Next. Nothing here leaves your browser.",
    "That is everything I have to say. Choose Next to start over, or End chat.",
  ];

  const ADJECTIVES = ["quiet", "brisk", "gentle", "bright", "calm", "swift", "kind", "wild", "sunny", "clever"];
  const ANIMALS = ["otter", "heron", "lynx", "finch", "beaver", "fox", "owl", "dolphin", "camel", "toucan"];
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const randomName = () => `${pick(ADJECTIVES)}-${pick(ANIMALS)}-${String(10 + Math.floor(Math.random() * 90))}`;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const later = (fn, ms = 0) => setTimeout(fn, ms);

  // The one running chat, if any. Replaced for every new chat, so work that was
  // still in flight for an old chat can tell it is stale and do nothing.
  let chat = null;
  // The most recent chat's partner side, kept only so a test can check that both
  // sides derived the same safety code. It holds no message content.
  let lastBot = null;

  // Same shape as the real server's token bucket for messages.
  const bucket = { tokens: MESSAGE_BURST, at: Date.now() };
  function takeMessageToken() {
    const now = Date.now();
    bucket.tokens = Math.min(MESSAGE_BURST, bucket.tokens + ((now - bucket.at) / 1000) * MESSAGE_REFILL_PER_SEC);
    bucket.at = now;
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { ok: true };
    }
    return { ok: false, retryAfterMs: Math.ceil(((1 - bucket.tokens) / MESSAGE_REFILL_PER_SEC) * 1000) };
  }

  // ---------- the fake socket ----------
  function createSocket(options) {
    const handlers = new Map();
    const socket = {
      connected: false,
      recovered: false,
      active: false,

      on(event, handler) {
        const list = handlers.get(event) || [];
        list.push(handler);
        handlers.set(event, list);
        return socket;
      },

      // Calls the page's handlers. Handlers may be async; errors in them are the page's own.
      emitLocal(event, payload) {
        for (const handler of handlers.get(event) || []) handler(payload);
      },

      connect() {
        if (socket.connected) return socket;
        // The real page hands over a function that fetches a token; the demo's fetch answers it.
        const authenticate = typeof options.auth === "function" ? options.auth : (cb) => cb({});
        authenticate(() => {
          later(() => {
            socket.connected = true;
            socket.emitLocal("connect");
            socket.emitLocal("stats:online", { count: 1 }); // just you: the partner is not a person
          }, 150);
        });
        return socket;
      },

      disconnect() {
        if (!socket.connected) return socket;
        socket.connected = false;
        chat = null;
        socket.emitLocal("disconnect", "io client disconnect");
        return socket;
      },

      // socket.emit(event, payload, ack)
      emit(event, payload, ack) {
        later(() => handleClientEvent(socket, event, payload, typeof ack === "function" ? ack : () => {}), 20);
        return socket;
      },

      // socket.timeout(ms).emit(event, payload, (timedOut, ack) => ...)
      timeout() {
        return {
          emit(event, payload, callback) {
            socket.emit(event, payload, (ack) => callback(null, ack));
          },
        };
      },

      // "typing" is sent volatile; the partner ignores it.
      volatile: { emit() {} },
    };
    return socket;
  }

  // ---------- the simulated server ----------
  function validPrefs(payload) {
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return false;
    const keys = Object.keys(payload);
    if (keys.some((k) => k !== "interests" && k !== "scope")) return false;
    if (payload.scope !== undefined && payload.scope !== "world") return false; // no country database in a demo
    const interests = payload.interests;
    if (interests !== undefined) {
      if (!Array.isArray(interests) || interests.length > 5 || new Set(interests).size !== interests.length) return false;
      if (interests.some((i) => !INTERESTS.includes(i))) return false;
    }
    return true;
  }

  function handleClientEvent(socket, event, payload, ack) {
    switch (event) {
      case "session:start":
      case "session:next": {
        if (!validPrefs(payload)) {
          // The demo has no country database, so "my country only" is refused exactly as it is when the
          // real server cannot detect a country.
          const wantsLocal = payload && typeof payload === "object" && payload.scope === "local";
          return ack({ ok: false, error: { code: wantsLocal ? "COUNTRY_UNKNOWN" : "VALIDATION" } });
        }
        if (event === "session:start" && chat) return ack({ ok: false, error: { code: "INVALID_STATE" } });
        if (event === "session:next" && !chat) return ack({ ok: false, error: { code: "INVALID_STATE" } });
        const hadChat = chat !== null;
        if (hadChat) {
          chat = null;
          socket.emitLocal("session:ended", { reason: "skipped" });
        }
        ack({ ok: true });
        beginSearch(socket, payload && payload.interests ? payload.interests : []);
        return;
      }

      case "session:leave": {
        if (!chat) return ack({ ok: false, error: { code: "INVALID_STATE" } });
        chat = null;
        ack({ ok: true });
        socket.emitLocal("session:ended", { reason: "left" });
        return;
      }

      case "session:report": {
        if (typeof payload !== "object" || payload === null || Object.keys(payload).join() !== "reason" || !REPORT_REASONS.includes(payload.reason)) {
          return ack({ ok: false, error: { code: "VALIDATION" } });
        }
        if (!chat) return ack({ ok: false, error: { code: "NOT_IN_SESSION" } });
        chat = null;
        ack({ ok: true });
        // Nobody receives this report: there is nobody to send it to.
        socket.emitLocal("session:ended", { reason: "reported" });
        return;
      }

      case "e2e:key":
        return receiveUserKey(socket, payload, ack);

      case "e2e:envelope":
        return receiveUserEnvelope(socket, payload, ack);

      default:
        return ack({ ok: false, error: { code: "VALIDATION" } });
    }
  }

  // "Looking for someone": after a moment the simulated partner appears.
  function beginSearch(socket, interests) {
    const mine = { searching: true };
    chat = mine;
    later(async () => {
      if (chat !== mine) return; // cancelled meanwhile (End chat)
      const sessionId = crypto.randomUUID();
      const userRole = Math.random() < 0.5 ? "initiator" : "responder";
      const botRole = userRole === "initiator" ? "responder" : "initiator";
      const bot = {
        sessionId,
        channel: E2EE.createChannel({ sessionId, role: botRole, allowedReactions: REACTIONS }),
        userKeyArrived: false,
        scriptAt: 0,
        userMessages: 0,
        busy: Promise.resolve(),
      };
      mine.searching = false;
      mine.bot = bot;
      lastBot = bot;
      socket.emitLocal("session:matched", {
        sessionId,
        myName: randomName(),
        partnerName: PARTNER_NAME,
        role: userRole,
        // The simulated partner "shares" your first interest, so the page can show what that looks like.
        sharedInterests: interests.slice(0, 1),
      });
      // The partner's public key crosses, like the real server relaying it.
      const publicKey = await bot.channel.publicKey();
      later(() => {
        if (chat === mine) socket.emitLocal("e2e:key", { publicKey });
      }, 250);
    }, SEARCH_MS);
  }

  async function receiveUserKey(socket, payload, ack) {
    const mine = chat;
    if (!mine || !mine.bot) return ack({ ok: false, error: { code: "NOT_IN_SESSION" } });
    if (typeof payload !== "object" || payload === null || typeof payload.publicKey !== "string" || !/^[A-Za-z0-9_-]{87}$/.test(payload.publicKey)) {
      return ack({ ok: false, error: { code: "VALIDATION" } });
    }
    if (mine.bot.userKeyArrived) return ack({ ok: false, error: { code: "INVALID_STATE" } });
    mine.bot.userKeyArrived = true;
    ack({ ok: true });
    try {
      await mine.bot.channel.receiveKey(payload.publicKey); // real key checks and key derivation
    } catch {
      if (chat === mine) {
        chat = null;
        socket.emitLocal("session:ended", { reason: "crypto_timeout" });
      }
      return;
    }
    // The first line of the script arrives a moment after the chat is secured.
    if (chat === mine) say(socket, mine, 1100);
  }

  async function receiveUserEnvelope(socket, payload, ack) {
    const mine = chat;
    if (!mine || !mine.bot) return ack({ ok: false, error: { code: "NOT_IN_SESSION" } });
    if (!mine.bot.channel.ready) return ack({ ok: false, error: { code: "INVALID_STATE" } });
    if (typeof payload !== "object" || payload === null || Object.keys(payload).sort().join() !== "ct,seq") {
      return ack({ ok: false, error: { code: "VALIDATION" } });
    }
    const limit = takeMessageToken();
    if (!limit.ok) return ack({ ok: false, error: { code: "RATE_LIMITED", retryAfterMs: limit.retryAfterMs } });
    ack({ ok: true });

    // Decrypt with the partner's own keys. This is real: a tampered, replayed or wrong envelope fails here.
    // The partner does not use what it decrypts: it answers from its script.
    mine.bot.busy = mine.bot.busy.then(async () => {
      let plain;
      try {
        plain = await mine.bot.channel.open(payload);
      } catch {
        return; // not a valid envelope: dropped, as the real client drops it
      }
      if (chat !== mine || plain.t !== "msg") return;
      mine.bot.userMessages++;
      // A thumbs up on the first message, then the next line of the script.
      if (mine.bot.userMessages === 1) {
        later(async () => {
          if (chat !== mine) return;
          const reaction = await mine.bot.channel.seal({ t: "react", ref: payload.seq, emoji: "👍" });
          if (chat === mine) socket.emitLocal("e2e:envelope", reaction);
        }, 700);
      }
      await say(socket, mine, 1300);
    });
  }

  // The partner "types", then sends the next line of its script, really encrypted.
  async function say(socket, mine, typingMs) {
    const bot = mine.bot;
    if (!bot || bot.scriptAt >= SCRIPT.length) return;
    socket.emitLocal("partner:status", { state: "typing" });
    await sleep(typingMs);
    if (chat !== mine) return;
    const text = SCRIPT[bot.scriptAt++];
    const envelope = await bot.channel.seal({ t: "msg", text });
    if (chat !== mine) return;
    socket.emitLocal("partner:status", { state: "connected" });
    socket.emitLocal("e2e:envelope", envelope);
  }

  // ---------- take the place of io() and of the two token endpoints ----------
  globalThis.io = function io(options) {
    return createSocket(options || {});
  };

  const realFetch = globalThis.fetch ? globalThis.fetch.bind(globalThis) : null;
  globalThis.fetch = function demoFetch(input) {
    const url = typeof input === "string" ? input : input.url;
    const json = (body) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
    if (url.includes("pow-challenge")) return json({ bits: 0 }); // no puzzle: there is no server to protect
    if (url.includes("connect-token")) {
      return json({ token: "demo", expiresInMs: 30000, protocolVersion: "rc/v1", rulesVersion: "demo", interests: INTERESTS, preview: true });
    }
    // Nothing else is requested by the page. If something ever is, it is refused rather than sent anywhere.
    void realFetch;
    return Promise.reject(new Error("the demo makes no network requests"));
  };

  // For tests only: the safety code the simulated partner derived, so a test can check both sides agree.
  globalThis.DemoServer = {
    partnerSafetyCode() {
      return lastBot && lastBot.channel ? lastBot.channel.safetyCode : null;
    },
  };
})();
