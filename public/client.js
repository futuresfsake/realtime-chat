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

function setChatting(myName, partnerName) {
  me = myName || "guest";
  partner = partnerName;
  els.user.textContent = me;
  els.room.textContent = partnerName || "lobby";
  els.roomName.textContent = partnerName || "lobby";
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
socket.on("connect", () => {
  setChatting("guest", null);
  setConnection("online", "ONLINE");
  sys("connected to the server. type /start to meet a stranger");
});

socket.on("disconnect", (reason) => {
  setChatting("guest", null);
  setConnection("offline", "OFFLINE");
  err(`connection lost (${reason}) - retrying...`);
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
  els.log.replaceChildren(); // a new chat starts empty
  setChatting(myName, partnerName);
  sys(`connected to ${partnerName}. you are ${myName}. say hi! (/leave to end the chat)`);
});

const ENDED_TEXT = {
  partner_left: "your partner left. type /start to meet someone new",
  left: "you left the chat. type /start to meet someone new",
  skipped: "chat ended. type /start to meet someone new",
};
socket.on("session:ended", ({ reason }) => {
  setChatting("guest", null);
  sys(ENDED_TEXT[reason] || ENDED_TEXT.skipped);
});

socket.on("chat:message", (msg) => {
  addLine(
    [[`[${timestamp(msg.sentAt)}] `, "ts"], [`<${msg.from}> `, "who"], [msg.text]],
    msg.from === me ? "self" : ""
  );
});

// ---------- Local slash commands (never sent to the server) ----------
const commands = {
  help() {
    sys("commands:");
    sys("  /help     show this list");
    sys("  /clear    clear the screen");
    sys("  /start    find a stranger to chat with");
    sys("  /leave    leave the chat (or stop searching)");
    sys("  /whoami   show your random name");
    sys("  /theme    list themes, /theme <name> to switch");
    sys("  up/down   browse your input history");
  },
  clear() {
    els.log.replaceChildren();
  },
  whoami() {
    sys(partner ? `you are ${me}, chatting with ${partner}` : "you are not in a chat yet. type /start");
  },
  start() {
    sendCommand("session:start", () => sys("searching for a stranger..."));
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
      err(event === "session:start" ? "you are already searching or chatting (/leave first)" : "nothing to leave");
    } else if (ack.error.code === "RATE_LIMITED") {
      err("slow down, try again in a moment");
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
els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = els.input.value.trim();
  if (!text) return;

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
