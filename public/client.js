// ---------- Config ----------
const MAX_LINES = 500;    // cap DOM size so long sessions stay fast
const MAX_HISTORY = 50;   // input history for the up/down arrow keys
const THEMES = ["phosphor", "amber", "ice", "paper"]; // must match styles.css
const DEFAULT_THEME = "phosphor";
const THEME_KEY = "rtc.theme"; // same key as the inline script in index.html

// ---------- DOM references ----------
const $ = (id) => document.getElementById(id);
const els = {
  log: $("log"),
  form: $("prompt"),
  input: $("input"),
  conn: $("conn"),
  connText: $("conn-text"),
  user: $("ps1-user"),
  themes: $("themes"),
};

// ---------- State ----------
const socket = io();
let me = "guest";
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

// ---------- Socket events ----------
socket.on("connect", () => {
  me = socket.id.slice(0, 5);
  els.user.textContent = me;
  setConnection("online", "ONLINE");
  sys(`connected as ${me}`);
});

socket.on("disconnect", (reason) => {
  setConnection("offline", "OFFLINE");
  err(`connection lost (${reason}) - retrying...`);
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
    sys("  /whoami   show your id");
    sys("  /theme    list themes, /theme <name> to switch");
    sys("  up/down   browse your input history");
  },
  clear() {
    els.log.replaceChildren();
  },
  whoami() {
    sys(`you are ${me}`);
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
  socket.emit("chat:send", text);
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
  if (event.target.closest("button, a, input")) return;
  if (!window.getSelection()?.toString()) els.input.focus();
});

// ---------- Boot sequence ----------
renderThemePicker();
sys("REALTIME-CHAT v0.2 // tty1");
sys("establishing websocket link...");
sys("type /help for commands");
