// ---------- Config ----------
const MAX_LINES = 500;    // cap DOM size so long sessions stay fast
const MAX_HISTORY = 50;   // input history for the up/down arrow keys
const THEMES = ["phosphor", "amber", "ice", "paper"]; // must match styles.css
const DEFAULT_THEME = "phosphor";
const THEME_KEY = "rtc.theme"; // same key as js/themes.js
const PROTOCOL_VERSION = "rc/v1";        // must match src/types/events.ts
const RULES_VERSION = "2026-11-preview-3"; // must match src/types/events.ts
const CONSENT_KEY = "rtc.consent";       // sessionStorage: asked again in every new tab/visit
const ACK_TIMEOUT_MS = 8000;             // how long to wait for the server to confirm a message
// Without WebCrypto (very old browser, or a page not served over HTTPS) there
// is no encryption, and without encryption there is no chat. No fallback.
const CAN_ENCRYPT = typeof E2EE !== "undefined" && E2EE.isSupported();
const NO_ENCRYPTION_TEXT =
  "this browser cannot encrypt messages here (it needs a current browser and an https:// address), so chatting is switched off";

// ---------- DOM references ----------
const $ = (id) => document.getElementById(id);
const els = {
  log: $("log"),
  form: $("prompt"),
  input: $("input"),
  conn: $("conn"),
  connText: $("conn-text"),
  user: $("ps1-user"),
  room: $("ps1-room"),
  roomName: $("room-name"),
  typing: $("typing"),
  partnerStatus: $("partner-status"),
  e2eStatus: $("e2e-status"),
  e2eTop: $("conn-e2e"),
  onlineTop: $("conn-online"),
  onlineSide: $("online-count"),
  themes: $("themes"),
  app: $("app"),
  gate: $("gate"),
  gateForm: $("gate-form"),
  gateAdult: $("gate-adult"),
  gateRules: $("gate-rules"),
  gateVersion: $("gate-version"),
  banner: $("preview-banner"),
};

// ---------- State ----------
// Step 1: fetch a short-lived token over HTTPS. Step 2: open the WebSocket
// with it. Socket.IO calls this function again for every (re)connection, so
// each attempt gets a fresh token.
const socket = io({
  autoConnect: false,
  transports: ["websocket"],
  auth: (cb) => {
    fetchConnectToken().then((token) =>
      cb({ protocolVersion: PROTOCOL_VERSION, token, consent: { adult: true, rulesVersion: RULES_VERSION } })
    );
  },
});
let me = "guest";
let partner = null; // set while chatting with someone

// Everything said in the current chat lives here, in memory only (US-09).
const store = SessionStore.create();
let partnerState = "none"; // none | connected | typing | reconnecting

// The encryption of the current chat: this chat's keys and message counters
// (js/crypto.js). In memory only, and forgotten when the chat ends.
let channel = null;
// Set when this page itself ends a chat because its encryption failed, so
// the reason can be shown once the server confirms the chat is over.
let endNote = null;

function setChatting(myName, partnerName) {
  me = myName || "guest";
  partner = partnerName;
  els.user.textContent = me;
  els.room.textContent = partnerName || "lobby";
  els.roomName.textContent = partnerName || "lobby";
  setPartnerState(partnerName ? "connected" : "none");
  if (!partnerName) setSecurity("none");
}

// none: not chatting. securing: keys are being exchanged, nothing can be sent
// yet. secured: messages are end-to-end encrypted.
function setSecurity(state) {
  els.e2eStatus.dataset.state = state;
  els.e2eStatus.textContent = { none: "", securing: "… securing the chat", secured: "🔒 end-to-end encrypted" }[state];
  els.e2eTop.hidden = state !== "secured"; // the sidebar is hidden on phones; the top bar is not
}

function closeChannel() {
  if (channel) channel.close();
  channel = null;
}

// Sidebar: one line about the partner. ● connected, ✎ typing, ⟳ reconnecting.
function setPartnerState(state) {
  partnerState = state;
  clearTimeout(partnerTypingTimer);
  const text = {
    none: "no one yet. type /start",
    connected: `● ${partner} connected`,
    typing: `✎ ${partner} is typing…`,
    reconnecting: `⟳ ${partner} reconnecting…`,
  }[state];
  els.partnerStatus.textContent = text;
  els.partnerStatus.dataset.state = state;
  // The line under the chat only ever says "typing", and only while it is true.
  els.typing.textContent = state === "typing" ? `${partner} is typing…` : "";
  // A partner who goes quiet without saying so (switched tabs) is not typing after 3 s.
  if (state === "typing") partnerTypingTimer = setTimeout(() => setPartnerState("connected"), 3000);
}
let partnerTypingTimer = null;

// The chat is over: forget every message (screen and memory).
function wipeHistory() {
  store.clear();
  els.log.replaceChildren();
}
const history = [];
let historyIndex = 0;

// ---------- Rendering helpers ----------
function isNearBottom() {
  const { scrollHeight, scrollTop, clientHeight } = els.log;
  return scrollHeight - scrollTop - clientHeight < 40;
}

// parts: [text, cssClass] pairs. Always textContent, never innerHTML (XSS).
function addLine(parts, className = "") {
  const shouldStick = isNearBottom(); // don't yank the user down if they scrolled up
  const li = document.createElement("li");
  li.className = `line ${className}`.trim();
  for (const [text, cls] of parts) {
    const span = document.createElement("span");
    if (cls) span.className = cls;
    span.textContent = text;
    li.appendChild(span);
  }
  els.log.appendChild(li);
  while (els.log.children.length > MAX_LINES) els.log.firstElementChild.remove();
  if (shouldStick) els.log.scrollTop = els.log.scrollHeight;
  return li;
}
const sys = (text) => addLine([[`*** ${text}`]], "sys");
const err = (text) => addLine([[`!!! ${text}`]], "err");
const timestamp = (ms) => new Date(ms).toLocaleTimeString([], { hour12: false });

function setConnection(state, label) {
  els.conn.dataset.state = state;
  els.connText.textContent = label;
}

// ---------- Themes ----------
function currentTheme() {
  const t = document.documentElement.dataset.theme;
  return THEMES.includes(t) ? t : DEFAULT_THEME;
}

function setTheme(name) {
  if (!THEMES.includes(name)) {
    err(`unknown theme: ${name} (available: ${THEMES.join(", ")})`);
    return;
  }
  document.documentElement.dataset.theme = name;
  try {
    localStorage.setItem(THEME_KEY, name);
  } catch {
    /* private mode / storage blocked: theme still applies for this visit */
  }
  renderThemePicker();
}

function renderThemePicker() {
  const active = currentTheme();
  els.themes.replaceChildren(
    ...THEMES.map((name) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = name;
      btn.setAttribute("aria-pressed", String(name === active));
      btn.addEventListener("click", () => {
        setTheme(name);
        sys(`theme set to ${name}`);
      });
      li.appendChild(btn);
      return li;
    })
  );
}

// ---------- Age + rules gate ----------
function hasConsent() {
  try {
    return sessionStorage.getItem(CONSENT_KEY) === RULES_VERSION;
  } catch {
    return false; // storage blocked: ask on every load
  }
}

function showGate() {
  els.gateVersion.textContent = RULES_VERSION;
  els.gateAdult.checked = false;
  els.gateRules.checked = false;
  els.gate.hidden = false;
  els.app.inert = true; // keyboard and screen readers stay inside the gate
  els.gateAdult.focus();
}

els.gateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!els.gateAdult.checked || !els.gateRules.checked) return;
  try {
    sessionStorage.setItem(CONSENT_KEY, RULES_VERSION);
  } catch {
    /* storage blocked: consent lasts for this page load only */
  }
  els.gate.hidden = true;
  els.app.inert = false;
  els.input.focus();
  socket.connect();
});

// ---------- Connecting ----------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Keeps trying until the server answers. On free hosting the server sleeps
// when idle and needs up to a minute to wake, so say so instead of looking
// broken.
async function fetchConnectToken() {
  let delay = 1000;
  let toldUser = false;
  for (;;) {
    const slow = setTimeout(() => {
      if (toldUser) return;
      toldUser = true;
      setConnection("connecting", "WAKING UP");
      sys("waking up the server... this can take up to a minute after a quiet period");
    }, 2500);
    try {
      const res = await fetch("/connect-token", { cache: "no-store" });
      if (res.ok) {
        const body = await res.json();
        els.banner.hidden = !body.preview;
        return body.token;
      }
      const retryAfter = Number(res.headers.get("Retry-After"));
      if (retryAfter > 0) delay = Math.min(retryAfter * 1000, 30000);
    } catch {
      /* network error or server still starting: fall through and retry */
    } finally {
      clearTimeout(slow);
    }
    await sleep(delay);
    delay = Math.min(delay * 2, 8000);
  }
}

function retryConnect(delayMs) {
  setTimeout(() => socket.connect(), delayMs);
}

// ---------- Socket events ----------
// After a short network drop the server restores this same socket and replays
// what was missed (those events arrive just before "connect" fires). So if a
// chat is still set here and the socket was restored, the chat simply goes on.
socket.on("connect", () => {
  setConnection("online", "ONLINE");
  if (socket.recovered && partner) {
    // The keys never left this page's memory, so the chat is still encrypted.
    sys(`reconnected. your chat with ${partner} continues`);
    return;
  }
  if (partner) err("the connection was lost for too long, so that chat has ended");
  closeChannel();
  setChatting("guest", null);
  if (CAN_ENCRYPT) sys("connected to the server. type /start to meet a stranger");
  else err(NO_ENCRYPTION_TEXT);
});

socket.on("disconnect", (reason) => {
  setConnection("offline", "OFFLINE");
  // Keep the chat on screen: it survives a drop of up to 30 seconds.
  if (partner) err("connection lost - reconnecting... your chat is kept for 30 seconds");
  else err(`connection lost (${reason}) - retrying...`);
});

// Closing or leaving the page is a real goodbye: tell the server, so the
// partner sees "left" at once instead of 30 seconds of "reconnecting".
window.addEventListener("pagehide", () => socket.disconnect());
// Some browsers keep a hidden page alive and show it again on "back".
window.addEventListener("pageshow", (event) => {
  if (event.persisted && hasConsent() && !socket.connected) socket.connect();
});

// The server refuses a handshake with one of these codes (never details).
let authRetries = 0;
socket.on("connect_error", (error) => {
  setConnection("offline", "OFFLINE");
  switch (error.message) {
    case "PROTOCOL_MISMATCH":
      return err("a new version is available - please refresh this page");
    case "CONSENT_REQUIRED":
      try {
        sessionStorage.removeItem(CONSENT_KEY);
      } catch {
        /* ignore */
      }
      return showGate();
    case "TOO_MANY_CONNECTIONS":
      return err("too many connections from your network - close other tabs, then refresh");
    case "MAINTENANCE":
      err("the service is under maintenance - retrying in 30s");
      return retryConnect(30000);
    case "RETRY":
      // The server still had our old connection open (typical after switching
      // between Wi-Fi and mobile data). It has closed it: connect once more.
      if (++authRetries > 5) return err("could not connect - please refresh this page");
      return retryConnect(250);
    case "AUTH_REQUIRED":
    case "VALIDATION":
      // The token expired or was already used: get a new one, a few times.
      if (++authRetries > 5) return err("could not connect - please refresh this page");
      return retryConnect(1000 * authRetries);
    default:
      // Network trouble or the server refused before the handshake.
      // Socket.IO retries by itself with backoff.
      if (!socket.active) retryConnect(5000);
  }
});
socket.on("connect", () => {
  authRetries = 0;
});

socket.on("session:matched", ({ sessionId, myName, partnerName, role }) => {
  wipeHistory(); // a new chat starts empty
  stopTyping();
  closeChannel();
  endNote = null;
  setChatting(myName, partnerName);
  setSecurity("securing");
  sys(`connected to ${partnerName}. you are ${myName}. securing the chat...`);
  startKeyExchange(sessionId, role);
});

// ---------- End-to-end encryption ----------
// Every chat gets fresh keys: make a key pair, send the public half, and wait
// for the partner's. Nothing can be said until both halves have crossed.
// `mine` guards every step: if the chat ends (or a new one starts) while a
// step was waiting, the step notices and does nothing.
async function startKeyExchange(sessionId, role) {
  let mine = null;
  try {
    mine = channel = E2EE.createChannel({ sessionId, role, allowedReactions: store.ALLOWED_REACTIONS });
    const publicKey = await mine.publicKey();
    if (channel !== mine) return;
    socket.emit("e2e:key", { publicKey }, (ack) => {
      if (channel === mine && ack && !ack.ok) secureChannelFailed();
    });
  } catch {
    if (mine === null || channel === mine) secureChannelFailed();
  }
}

socket.on("e2e:key", async ({ publicKey }) => {
  const mine = channel;
  if (!mine) return;
  try {
    // Checks the key and derives this chat's message keys. A bad key, our own
    // key sent back, or a second key for the same chat all throw.
    await mine.receiveKey(publicKey);
  } catch {
    if (channel === mine) secureChannelFailed();
    return;
  }
  if (channel !== mine) return;
  setSecurity("secured");
  sys("🔒 end-to-end encrypted: only the two of you can read this chat. say hi!");
  sys("/verify shows a code to check that nobody is in the middle. /leave ends the chat");
});

// The encryption could not be set up, or too many messages failed their
// check. The chat ends here: there is no unencrypted way to carry on.
function secureChannelFailed() {
  closeChannel();
  setSecurity("none");
  endNote = "secure channel error: this chat could not be kept private, so it was ended. nothing was sent unencrypted";
  err(endNote);
  socket.emit("session:leave", {});
}

socket.on("e2e:envelope", async (envelope) => {
  const mine = channel;
  if (!mine) return;
  let plain;
  try {
    plain = await mine.open(envelope); // throws on tampering, replay, or anything that is not a message
  } catch (error) {
    if (channel !== mine || error.code === "CLOSED") return;
    if (error.fatal) return secureChannelFailed();
    return err("a message failed its security check and was dropped");
  }
  if (channel !== mine) return;
  if (plain.t === "msg") {
    showMessage({ seq: envelope.seq, from: partner, text: plain.text, sentAt: Date.now() }, false);
  } else {
    // A reaction always points at a message of the one who receives it.
    showReaction(store.messageId(plain.ref, true), plain.emoji, partner);
  }
});

// Encrypts one message or reaction and hands the envelope to the server.
// onSent runs once the server has passed it on. `what` names it in errors.
function sendSecure(plain, what, onSent) {
  const mine = channel;
  if (!socket.connected) return err(`not connected - ${what} not sent`);
  if (!partner || !mine) return err("you are not chatting with anyone. type /start to meet a stranger");
  if (!mine.ready) return err(`the chat is still being secured - ${what} not sent. try again in a moment`);
  mine.seal(plain).then(
    (envelope) => {
      if (channel !== mine) return; // the chat ended while encrypting
      socket.timeout(ACK_TIMEOUT_MS).emit("e2e:envelope", envelope, (timedOut, ack) => {
        if (channel !== mine) return;
        if (timedOut) return err(`no answer from the server - your ${what} may not have arrived`);
        if (ack.ok) return onSent(envelope.seq);
        if (ack.error.code === "RATE_LIMITED") {
          const seconds = Math.max(1, Math.ceil((ack.error.retryAfterMs || 1000) / 1000));
          err(`slow down - ${what} not sent, try again in ${seconds}s`);
        } else if (ack.error.code === "NOT_IN_SESSION") {
          err("you are not chatting with anyone. type /start to meet a stranger");
        } else if (ack.error.code === "INVALID_STATE") {
          err(`the chat is still being secured - ${what} not sent. try again in a moment`);
        } else {
          err(`${what} not sent - please try again`);
        }
      });
    },
    (error) => {
      if (channel !== mine) return;
      if (error.code === "TOO_LONG") err(`${what} too long (500 characters at most) - not sent`);
      else if (error.code === "BAD_MESSAGE") err(`${what} rejected (1 to 500 characters)`);
      else secureChannelFailed();
    }
  );
}

const ENDED_TEXT = {
  partner_left: "your partner left. type /start to meet someone new",
  left: "you left the chat. type /start to meet someone new",
  skipped: "chat ended. looking for someone new...",
  partner_timeout: "your partner did not come back. type /start to meet someone new",
  timeout: "you were offline for too long, so that chat has ended. type /start to meet someone new",
  crypto_timeout:
    "the chat could not be secured within 10 seconds, so it was ended before anything was said. type /start to try again",
};
socket.on("session:ended", ({ reason }) => {
  wipeHistory(); // the chat is over: nothing of it is kept
  stopTyping();
  closeChannel(); // and neither are its keys
  setChatting("guest", null);
  if (endNote && reason === "left") {
    err(endNote);
    sys("type /start to meet someone new");
  } else {
    sys(ENDED_TEXT[reason] || ENDED_TEXT.skipped);
  }
  endNote = null;
});

const STATUS_TEXT = {
  reconnecting: "your partner lost their connection. waiting up to 30 seconds for them...",
  connected: "your partner is back",
};
socket.on("partner:status", ({ state }) => {
  if (!partner) return;
  if (STATUS_TEXT[state]) sys(STATUS_TEXT[state]);
  if (state === "typing") setPartnerState("typing");
  else if (state === "reconnecting") setPartnerState("reconnecting");
  else setPartnerState("connected"); // connected | idle
});

// A count only: the server never sends names or locations.
socket.on("stats:online", ({ count }) => {
  const n = Number.isInteger(count) && count >= 0 ? count : 0;
  els.onlineTop.textContent = ` · ${n} online`;
  els.onlineSide.textContent = `(${n})`;
});

// msg: { seq, from, text, sentAt }. Times are this browser's clock: when my
// message was accepted, or when theirs arrived. The server adds nothing.
function showMessage(msg, mine) {
  const id = store.addMessage(msg, mine);
  const li = addLine(
    [[`[${timestamp(msg.sentAt)}] `, "ts"], [`<${msg.from}> `, "who"], [msg.text]],
    mine ? "self" : ""
  );
  li.dataset.msg = id;
  // Their message arrived, so they are not "typing" any more.
  if (!mine && partnerState === "typing") setPartnerState("connected");
}

// ---------- Reactions ----------
function showReaction(id, emoji, from) {
  const reactions = store.addReaction(id, emoji, from);
  if (reactions) renderReactions(id, reactions); // unknown message or repeat: ignored
}

// Shows "😂 2  👍" at the end of the message that was reacted to.
function renderReactions(id, reactions) {
  const li = [...els.log.children].find((line) => line.dataset.msg === id);
  if (!li) return; // scrolled off the screen
  let span = li.querySelector(".reactions");
  if (!span) {
    span = document.createElement("span");
    span.className = "reactions";
    li.appendChild(span);
  }
  const counts = new Map();
  for (const { emoji } of reactions) counts.set(emoji, (counts.get(emoji) || 0) + 1);
  span.textContent = ` ${[...counts].map(([emoji, n]) => (n > 1 ? `${emoji}×${n}` : emoji)).join(" ")}`;
}

// ---------- Local slash commands (never sent to the server) ----------
const commands = {
  help() {
    sys("commands:");
    sys("  /help     show this list");
    sys("  /clear    clear the screen");
    sys("  /start    find a stranger to chat with");
    sys("  /react    react to their last message: /react 😂  (👍 ❤️ 😂 😮 😢 🙏)");
    sys("  /verify   show this chat's safety code, to check nobody is in the middle");
    sys("  /next     skip to a new stranger");
    sys("  /leave    leave the chat (or stop searching)");
    sys("  /whoami   show your random name");
    sys("  /theme    list themes, /theme <name> to switch");
    sys("  up/down   browse your input history");
  },
  clear() {
    wipeHistory();
  },
  react(args) {
    const emoji = args.join("").replace(/\uFE0F/g, ""); // "❤" and "❤️" are the same reaction
    const allowed = store.ALLOWED_REACTIONS;
    const match = allowed.find((e) => e.replace(/\uFE0F/g, "") === emoji);
    if (!match) return sys(`usage: /react <emoji>  (${allowed.join(" ")})`);
    if (!partner) return err("you are not chatting with anyone. type /start to meet a stranger");
    const ref = store.lastPartnerSeq();
    if (ref === null) return err("nothing to react to yet: your partner has not said anything");
    // Encrypted like a message: the server cannot tell the two apart.
    sendSecure({ t: "react", ref, emoji: match }, "reaction", () =>
      showReaction(store.messageId(ref, false), match, me)
    );
  },
  // The safety code is made from both public keys. If the server (or anyone
  // on the way) swapped a key, the two sides see different codes.
  verify() {
    const code = channel && channel.ready ? channel.safetyCode : null;
    if (!code) {
      return err(
        partner
          ? "the chat is still being secured. try /verify again in a moment"
          : "you are not in a chat. /verify works while you are chatting"
      );
    }
    sys(`safety code: ${code}`);
    sys("your partner's /verify shows the same code, unless someone swapped the encryption keys on the way.");
    sys("compare the codes OUTSIDE this chat (a call, another app). a code sent in this chat proves nothing:");
    sys("someone in the middle could rewrite it. with no other way to reach them, you cannot fully rule that out.");
    sys("if the codes differ, someone may be reading along: /leave and share nothing private.");
  },
  whoami() {
    sys(partner ? `you are ${me}, chatting with ${partner}` : "you are not in a chat yet. type /start");
  },
  start() {
    if (!CAN_ENCRYPT) return err(NO_ENCRYPTION_TEXT);
    sendCommand("session:start", () => sys("searching for a stranger..."));
  },
  next() {
    if (!CAN_ENCRYPT) return err(NO_ENCRYPTION_TEXT);
    sendCommand("session:next");
  },
  leave() {
    sendCommand("session:leave");
  },
  theme(args) {
    const [name] = args;
    if (!name) {
      sys(`current theme: ${currentTheme()}`);
      sys(`available: ${THEMES.join(", ")}`);
      return;
    }
    const lower = name.toLowerCase();
    setTheme(lower);
    if (THEMES.includes(lower)) sys(`theme set to ${lower}`);
  },
};

// /start and /leave go to the server; the answer arrives as an event.
function sendCommand(event, onOk) {
  if (!socket.connected) return err("not connected");
  socket.emit(event, {}, (ack) => {
    if (!ack) return;
    if (ack.ok) return onOk?.();
    if (ack.error.code === "INVALID_STATE") {
      err(
        event === "session:start"
          ? "you are already searching or chatting (/next to skip, /leave to stop)"
          : event === "session:next"
            ? "you are not in a chat. type /start first"
            : "nothing to leave"
      );
    } else if (ack.error.code === "RATE_LIMITED") {
      err("slow down - too many searches, try again in a minute");
    } else {
      err("that did not work - please try again");
    }
  });
}

function runCommand(line) {
  const [rawName = "", ...args] = line.slice(1).split(/\s+/);
  const name = rawName.toLowerCase();
  // Object.hasOwn: blocks inherited keys like "/constructor" or "/toString"
  if (Object.hasOwn(commands, name)) commands[name](args);
  else err(`unknown command: /${name} (try /help)`);
}

// ---------- Input handling ----------
// Tells the partner when I start and stop typing. Never any text, only
// "typing" or "not typing". Sent at most every 2 seconds, and "stopped" goes
// out 3 seconds after the last key press, or at once when I send.
let iAmTyping = false;
let lastTypingSentAt = 0;
let stopTypingTimer = null;

function sendTyping(isTyping) {
  if (partner && socket.connected) socket.volatile.emit("typing", { isTyping });
}

function stopTyping() {
  clearTimeout(stopTypingTimer);
  if (iAmTyping) sendTyping(false);
  iAmTyping = false;
}

els.input.addEventListener("input", () => {
  // Commands (/next, /react...) are not "typing to the partner".
  if (!partner || els.input.value.trim() === "" || els.input.value.startsWith("/")) return stopTyping();
  const now = Date.now();
  if (!iAmTyping || now - lastTypingSentAt > 2000) {
    sendTyping(true);
    lastTypingSentAt = now;
    iAmTyping = true;
  }
  clearTimeout(stopTypingTimer);
  stopTypingTimer = setTimeout(stopTyping, 3000);
});

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = els.input.value.trim();
  if (!text) return;
  stopTyping();

  history.push(text);
  if (history.length > MAX_HISTORY) history.shift();
  historyIndex = history.length;
  els.input.value = "";

  if (text.startsWith("/")) return runCommand(text);
  // Encrypted here, in the browser. My own line appears once the server has
  // passed the envelope on, so what I see is what was really sent.
  const name = me;
  sendSecure({ t: "msg", text }, "message", (seq) =>
    showMessage({ seq, from: name, text, sentAt: Date.now() }, true)
  );
});

els.input.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp" && historyIndex > 0) {
    historyIndex--;
  } else if (event.key === "ArrowDown" && historyIndex < history.length) {
    historyIndex++;
  } else {
    return;
  }
  event.preventDefault();
  els.input.value = history[historyIndex] ?? "";
});

// Terminal feel: clicking empty space focuses the prompt
// (skip when selecting text or clicking a control like a theme button)
document.addEventListener("click", (event) => {
  if (!els.gate.hidden) return;
  if (event.target.closest("button, a, input, label")) return;
  if (!window.getSelection()?.toString()) els.input.focus();
});

// ---------- Boot sequence ----------
renderThemePicker();
sys("REALTIME-CHAT v0.4 // tty1");
sys("type /help for commands");
if (hasConsent()) {
  sys("establishing websocket link...");
  els.input.focus();
  socket.connect();
} else {
  showGate();
}
