// ---------- Config ----------
const MAX_LINES = 500;    // cap DOM size so long sessions stay fast
const MAX_HISTORY = 50;   // input history for the up/down arrow keys
const THEMES = ["phosphor", "amber", "ice", "paper"]; // must match styles.css
const DEFAULT_THEME = "phosphor";
const THEME_KEY = "rtc.theme"; // same key as js/themes.js
const PROTOCOL_VERSION = "rc/v1";        // must match src/types/events.ts
const RULES_VERSION = "2026-11-preview-2"; // must match src/types/events.ts
const CONSENT_KEY = "rtc.consent";       // sessionStorage: asked again in every new tab/visit

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

function setChatting(myName, partnerName) {
  me = myName || "guest";
  partner = partnerName;
  els.user.textContent = me;
  els.room.textContent = partnerName || "lobby";
  els.roomName.textContent = partnerName || "lobby";
  setPartnerState(partnerName ? "connected" : "none");
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
    sys(`reconnected. your chat with ${partner} continues`);
    return;
  }
  if (partner) err("the connection was lost for too long, so that chat has ended");
  setChatting("guest", null);
  sys("connected to the server. type /start to meet a stranger");
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

socket.on("session:matched", ({ myName, partnerName }) => {
  wipeHistory(); // a new chat starts empty
  stopTyping();
  setChatting(myName, partnerName);
  sys(`connected to ${partnerName}. you are ${myName}. say hi! (/leave to end the chat)`);
});

const ENDED_TEXT = {
  partner_left: "your partner left. type /start to meet someone new",
  left: "you left the chat. type /start to meet someone new",
  skipped: "chat ended. looking for someone new...",
  partner_timeout: "your partner did not come back. type /start to meet someone new",
  timeout: "you were offline for too long, so that chat has ended. type /start to meet someone new",
};
socket.on("session:ended", ({ reason }) => {
  wipeHistory(); // the chat is over: nothing of it is kept
  stopTyping();
  setChatting("guest", null);
  sys(ENDED_TEXT[reason] || ENDED_TEXT.skipped);
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

socket.on("chat:message", (msg) => {
  const mine = msg.from === me;
  store.addMessage(msg, mine);
  const li = addLine(
    [[`[${timestamp(msg.sentAt)}] `, "ts"], [`<${msg.from}> `, "who"], [msg.text]],
    mine ? "self" : ""
  );
  li.dataset.seq = String(msg.seq);
  // Their message arrived, so they are not "typing" any more.
  if (!mine && partnerState === "typing") setPartnerState("connected");
});

// ---------- Reactions ----------
// Shows "😂 2  👍" at the end of the message that was reacted to.
function renderReactions(ref, reactions) {
  const li = els.log.querySelector(`li[data-seq="${ref}"]`);
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

socket.on("chat:reaction", ({ ref, emoji, from }) => {
  const reactions = store.addReaction(ref, emoji, from);
  if (reactions) renderReactions(ref, reactions); // unknown message or repeat: ignored
});

// ---------- Local slash commands (never sent to the server) ----------
const commands = {
  help() {
    sys("commands:");
    sys("  /help     show this list");
    sys("  /clear    clear the screen");
    sys("  /start    find a stranger to chat with");
    sys("  /react    react to their last message: /react 😂  (👍 ❤️ 😂 😮 😢 🙏)");
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
    socket.emit("chat:react", { ref, emoji: match }, (ack) => {
      if (!ack || ack.ok) return;
      if (ack.error.code === "RATE_LIMITED") err("slow down - reaction not sent");
      else err("reaction not sent - please try again");
    });
  },
  whoami() {
    sys(partner ? `you are ${me}, chatting with ${partner}` : "you are not in a chat yet. type /start");
  },
  start() {
    sendCommand("session:start", () => sys("searching for a stranger..."));
  },
  next() {
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
  if (!socket.connected) return err("not connected - message not sent");
  socket.emit("chat:send", { text }, (ack) => {
    if (!ack || ack.ok) return;
    if (ack.error.code === "RATE_LIMITED") {
      const seconds = Math.max(1, Math.ceil((ack.error.retryAfterMs || 1000) / 1000));
      err(`slow down - message not sent, try again in ${seconds}s`);
    } else if (ack.error.code === "NOT_IN_SESSION") {
      err("you are not chatting with anyone. type /start to meet a stranger");
    } else if (ack.error.code === "VALIDATION") {
      err("message rejected (1 to 500 characters)");
    } else {
      err("message not sent - please try again");
    }
  });
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
sys("REALTIME-CHAT v0.3 // tty1");
sys("type /help for commands");
if (hasConsent()) {
  sys("establishing websocket link...");
  els.input.focus();
  socket.connect();
} else {
  showGate();
}
