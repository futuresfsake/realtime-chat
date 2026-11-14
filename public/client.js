// ---------- Config ----------
const MAX_LINES = 500;    // cap DOM size so long sessions stay fast
const MAX_HISTORY = 50;   // input history for the up/down arrow keys
const PROTOCOL_VERSION = "rc/v1";          // must match src/types/events.ts
const RULES_VERSION = "2026-11-preview-5"; // must match src/types/events.ts
const MAX_INTERESTS = 5;                   // must match src/matchmaking/interests.ts
const CONSENT_KEY = "rtc.consent";         // sessionStorage: asked again in every new tab/visit
const ACK_TIMEOUT_MS = 8000;               // how long to wait for the server to confirm a message
// Without WebCrypto (very old browser, or a page not served over HTTPS) there
// is no encryption, and without encryption there is no chat. No fallback.
const CAN_ENCRYPT = typeof E2EE !== "undefined" && E2EE.isSupported();
const NO_ENCRYPTION_TEXT =
  "This browser cannot encrypt messages here (it needs a current browser and an https:// address), so chatting is switched off.";

// ---------- DOM references ----------
const $ = (id) => document.getElementById(id);
const els = {
  app: $("app"),
  log: $("log"),
  form: $("prompt"),
  input: $("input"),
  send: $("btn-send"),
  conn: $("conn"),
  connText: $("conn-text"),
  onlineTop: $("conn-online"),
  title: $("chat-title"),
  sub: $("chat-sub"),
  seal: $("seal"),
  sealText: $("seal-text"),
  typing: $("typing"),
  start: $("btn-start"),
  next: $("btn-next"),
  leave: $("btn-leave"),
  verify: $("btn-verify"),
  report: $("btn-report"),
  reportDialog: $("report"),
  reportForm: $("report-form"),
  reportCancel: $("report-cancel"),
  verifyDialog: $("verify"),
  verifyCode: $("verify-code"),
  chips: $("chips"),
  interestCount: $("interest-count"),
  scopeLocal: $("scope-local"),
  scopeNote: $("scope-note"),
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
let partner = null;      // set while chatting with someone
let searching = false;   // waiting in the queue for a partner
let searchOpen = false;  // the wait for a shared interest ran out: anyone will do now
let searchPrefs = { interests: [], scope: "world" }; // what the current search asked for
const chosen = new Set(); // interests ticked in the picker
let partnerState = "none"; // none | connected | typing | reconnecting

// Everything said in the current chat lives here, in memory only (US-09).
const store = SessionStore.create();

// The encryption of the current chat: this chat's keys and message counters
// (js/crypto.js). In memory only, and forgotten when the chat ends.
let channel = null;
// Set when this page itself ends a chat because its encryption failed, so
// the reason can be shown once the server confirms the chat is over.
let endNote = null;

// ---------- One place that decides what the screen shows ----------
// phase: connecting | offline | idle | searching | securing | chatting
function phase() {
  if (!socket.connected) return els.conn.dataset.state === "connecting" ? "connecting" : "offline";
  if (partner) return channel && channel.ready ? "chatting" : "securing";
  return searching ? "searching" : "idle";
}

const SUBTITLE = {
  connecting: "Connecting to the server",
  offline: "Connection lost, reconnecting",
  idle: "Ready when you are",
  searching: "Looking for someone to talk to",
  securing: "Setting up encryption",
  chatting: "Connected",
};

function render() {
  const p = phase();
  els.app.dataset.phase = p;
  const inChat = p === "securing" || p === "chatting";

  els.title.textContent = partner || (p === "searching" ? "Searching" : "No active chat");
  els.sub.textContent =
    p === "chatting" && partnerState === "reconnecting"
      ? `${partner} lost their connection. Waiting up to 30 seconds`
      : p === "chatting" && me !== "guest"
        ? `You are ${me}`
        : p === "searching"
          ? searchSubtitle()
          : SUBTITLE[p];

  els.start.disabled = !(p === "idle" && CAN_ENCRYPT);
  els.next.disabled = !(inChat || p === "searching");
  els.leave.disabled = !(inChat || p === "searching");
  els.verify.disabled = p !== "chatting";
  els.report.disabled = !inChat; // a chat can be reported as soon as it starts
  els.input.disabled = p !== "chatting";
  els.send.disabled = p !== "chatting";
  els.input.placeholder = p === "chatting" ? "Write a message" : p === "securing" ? "Setting up encryption…" : "Start a chat to write";

  const sealState = p === "chatting" ? "secured" : p === "securing" ? "securing" : "none";
  els.seal.dataset.state = sealState;
  els.sealText.textContent = { secured: "End-to-end encrypted", securing: "Securing…", none: "Not encrypted yet" }[sealState];

  els.typing.textContent = p === "chatting" && partnerState === "typing" ? `${partner} is typing…` : "";
}

function searchSubtitle() {
  const list = searchPrefs.interests;
  if (list.length === 0) return SUBTITLE.searching;
  return searchOpen
    ? "No one with a shared interest yet. Matching you with anyone"
    : `Looking for someone who likes ${list.join(", ")}`;
}

function setChatting(myName, partnerName) {
  me = myName || "guest";
  partner = partnerName;
  partnerState = partnerName ? "connected" : "none";
  clearTimeout(partnerTypingTimer);
  render();
}

function setPartnerState(state) {
  partnerState = state;
  clearTimeout(partnerTypingTimer);
  // A partner who goes quiet without saying so (switched tabs) is not typing after 3 s.
  if (state === "typing") partnerTypingTimer = setTimeout(() => setPartnerState("connected"), 3000);
  render();
}
let partnerTypingTimer = null;

function closeChannel() {
  if (channel) channel.close();
  channel = null;
}

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
  return scrollHeight - scrollTop - clientHeight < 60;
}

// Appends to the conversation without yanking a reader who scrolled up.
// Always textContent, never innerHTML (XSS).
function append(li) {
  const shouldStick = isNearBottom();
  els.log.appendChild(li);
  while (els.log.children.length > MAX_LINES) els.log.firstElementChild.remove();
  if (shouldStick) els.log.scrollTop = els.log.scrollHeight;
  return li;
}

function note(text, isError = false) {
  const li = document.createElement("li");
  li.className = isError ? "note note--err" : "note";
  li.textContent = text;
  return append(li);
}
const sys = (text) => note(text);
const err = (text) => note(text, true);

const timestamp = (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function setConnection(state, label) {
  els.conn.dataset.state = state;
  els.connText.textContent = label;
  render();
}

// ---------- Search preferences ----------
// The list comes from the server, so there is one source of truth.
function buildChips(interests) {
  if (els.chips.childElementCount > 0 || !Array.isArray(interests)) return;
  for (const name of interests) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = name;
    chip.setAttribute("aria-pressed", "false");
    chip.addEventListener("click", () => {
      if (chosen.has(name)) chosen.delete(name);
      else if (chosen.size < MAX_INTERESTS) chosen.add(name);
      refreshChips();
    });
    els.chips.append(chip);
  }
  refreshChips();
}

function refreshChips() {
  for (const chip of els.chips.children) {
    const on = chosen.has(chip.textContent);
    chip.setAttribute("aria-pressed", String(on));
    chip.disabled = !on && chosen.size >= MAX_INTERESTS; // five at most
  }
  els.interestCount.textContent = `${chosen.size} of ${MAX_INTERESTS}`;
}

function currentPrefs() {
  const scope = document.querySelector('input[name="scope"]:checked')?.value === "local" ? "local" : "world";
  return { interests: [...chosen], scope };
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
  els.start.focus();
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
      setConnection("connecting", "Waking up");
      sys("Waking up the server. This can take up to a minute after a quiet period.");
    }, 2500);
    try {
      // First a small puzzle (US-39): finding the answer takes a browser a
      // fraction of a second, and earns the token. When the server has it
      // switched off, the answer is skipped.
      let url = "/connect-token";
      const puzzle = await fetch("/pow-challenge", { cache: "no-store" });
      let res = puzzle;
      if (puzzle.ok) {
        const challenge = await puzzle.json();
        if (challenge.bits > 0) {
          const nonce = await ProofOfWork.solve(challenge.challenge, challenge.bits);
          url = `/connect-token?c=${encodeURIComponent(challenge.challenge)}&n=${nonce}`;
        }
        res = await fetch(url, { cache: "no-store" });
      }
      if (res.ok) {
        const body = await res.json();
        els.banner.hidden = !body.preview;
        buildChips(body.interests);
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
  setConnection("online", "Online");
  if (socket.recovered && partner) {
    // The keys never left this page's memory, so the chat is still encrypted.
    sys(`Reconnected. Your chat with ${partner} continues.`);
    return;
  }
  if (partner) err("The connection was lost for too long, so that chat has ended.");
  closeChannel();
  searching = false;
  wipeHistory();
  setChatting("guest", null);
  if (!CAN_ENCRYPT) err(NO_ENCRYPTION_TEXT);
});

socket.on("disconnect", (reason) => {
  setConnection("offline", "Offline");
  // Keep the chat on screen: it survives a drop of up to 30 seconds.
  if (partner) err("Connection lost. Reconnecting; your chat is kept for 30 seconds.");
  else err(`Connection lost (${reason}). Retrying…`);
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
  setConnection("offline", "Offline");
  switch (error.message) {
    case "PROTOCOL_MISMATCH":
      return err("A new version is available. Please refresh this page.");
    case "CONSENT_REQUIRED":
      try {
        sessionStorage.removeItem(CONSENT_KEY);
      } catch {
        /* ignore */
      }
      return showGate();
    case "TOO_MANY_CONNECTIONS":
      return err("Too many connections from your network. Close other tabs, then refresh.");
    case "MAINTENANCE":
      err("The service is under maintenance. Retrying in 30 seconds.");
      return retryConnect(30000);
    case "RETRY":
      // The server still had our old connection open (typical after switching
      // between Wi-Fi and mobile data). It has closed it: connect once more.
      if (++authRetries > 5) return err("Could not connect. Please refresh this page.");
      return retryConnect(250);
    case "AUTH_REQUIRED":
    case "VALIDATION":
      // The token expired or was already used: get a new one, a few times.
      if (++authRetries > 5) return err("Could not connect. Please refresh this page.");
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

socket.on("session:matched", ({ sessionId, myName, partnerName, role, sharedInterests }) => {
  wipeHistory(); // a new chat starts empty
  stopTyping();
  closeChannel();
  endNote = null;
  searching = false;
  searchOpen = false;
  setChatting(myName, partnerName);
  sys(`You are chatting with ${partnerName}. You are ${myName}.`);
  sys("Stay safe: do not share your name, address, phone number or social media accounts.");
  if (Array.isArray(sharedInterests) && sharedInterests.length > 0) {
    sys(`You both like ${sharedInterests.join(", ")}.`);
  } else if (searchPrefs.interests.length > 0) {
    sys("No shared interests this time: you were matched with a random person.");
  }
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
  render();
  sys("End-to-end encrypted. Only the two of you can read this chat.");
  els.input.focus();
});

// The encryption could not be set up, or too many messages failed their
// check. The chat ends here: there is no unencrypted way to carry on.
function secureChannelFailed() {
  closeChannel();
  endNote = "Secure channel error: this chat could not be kept private, so it was ended. Nothing was sent unencrypted.";
  err(endNote);
  render();
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
    return err("A message failed its security check and was dropped.");
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
  if (!socket.connected) return err(`Not connected. Your ${what} was not sent.`);
  if (!partner || !mine) return err("You are not chatting with anyone.");
  if (!mine.ready) return err(`The chat is still being secured. Your ${what} was not sent; try again in a moment.`);
  mine.seal(plain).then(
    (envelope) => {
      if (channel !== mine) return; // the chat ended while encrypting
      socket.timeout(ACK_TIMEOUT_MS).emit("e2e:envelope", envelope, (timedOut, ack) => {
        if (channel !== mine) return;
        if (timedOut) return err(`No answer from the server. Your ${what} may not have arrived.`);
        if (ack.ok) return onSent(envelope.seq);
        if (ack.error.code === "RATE_LIMITED") {
          const seconds = Math.max(1, Math.ceil((ack.error.retryAfterMs || 1000) / 1000));
          err(`Slow down. Your ${what} was not sent; try again in ${seconds}s.`);
        } else if (ack.error.code === "NOT_IN_SESSION") {
          err("You are not chatting with anyone.");
        } else if (ack.error.code === "INVALID_STATE") {
          err(`The chat is still being secured. Your ${what} was not sent; try again in a moment.`);
        } else {
          err(`Your ${what} was not sent. Please try again.`);
        }
      });
    },
    (error) => {
      if (channel !== mine) return;
      if (error.code === "TOO_LONG") err(`That ${what} is too long (500 characters at most), so it was not sent.`);
      else if (error.code === "BAD_MESSAGE") err(`That ${what} was rejected (1 to 500 characters).`);
      else secureChannelFailed();
    }
  );
}

const ENDED_TEXT = {
  partner_left: "Your partner left the chat.",
  left: "You ended the chat.",
  skipped: "Chat ended. Looking for someone new…",
  partner_timeout: "Your partner did not come back, so the chat ended.",
  timeout: "You were offline for too long, so that chat ended.",
  crypto_timeout: "The chat could not be secured within 10 seconds, so it was ended before anything was said.",
  reported: "Report sent. The chat is over and you will not be paired with this person again.",
  blocked: "This connection is blocked from matching for now, after reports. Try again later.",
};
socket.on("session:ended", ({ reason }) => {
  wipeHistory(); // the chat is over: nothing of it is kept
  stopTyping();
  closeChannel(); // and neither are its keys
  searching = reason === "skipped"; // /next goes straight back into the queue
  setChatting("guest", null);
  if (endNote && reason === "left") err(endNote);
  else sys(ENDED_TEXT[reason] || ENDED_TEXT.skipped);
  endNote = null;
  render();
});

// The wait for a shared interest ran out: from now on anyone compatible will do.
socket.on("search:status", ({ state }) => {
  if (!searching || state !== "open") return;
  searchOpen = true;
  render();
});

socket.on("partner:status", ({ state }) => {
  if (!partner) return;
  if (state === "reconnecting") sys("Your partner lost their connection. Waiting up to 30 seconds.");
  if (state === "connected" && partnerState === "reconnecting") sys("Your partner is back.");
  setPartnerState(state === "typing" ? "typing" : state === "reconnecting" ? "reconnecting" : "connected");
});

// A count only: the server never sends names or locations.
socket.on("stats:online", ({ count }) => {
  const n = Number.isInteger(count) && count >= 0 ? count : 0;
  els.onlineTop.textContent = `· ${n} online`;
});

// ---------- Messages ----------
// msg: { seq, from, text, sentAt }. Times are this browser's clock: when my
// message was accepted, or when theirs arrived. The server adds nothing.
function showMessage(msg, mine) {
  const id = store.addMessage(msg, mine);
  const li = document.createElement("li");
  li.className = mine ? "msg msg--mine" : "msg";
  li.dataset.msg = id;

  const meta = document.createElement("div");
  meta.className = "msg-meta";
  const who = document.createElement("span");
  who.className = "msg-who";
  who.textContent = mine ? "You" : msg.from;
  const time = document.createElement("span");
  time.className = "msg-time";
  time.textContent = timestamp(msg.sentAt);
  meta.append(who, time);

  const body = document.createElement("p");
  body.className = "msg-text";
  body.textContent = msg.text;

  const tools = document.createElement("div");
  tools.className = "msg-tools";

  // A message from the other person that the filter flags is hidden until
  // the reader chooses to see it. This runs on the receiving side because the
  // sender's page could have been changed to skip its own check.
  const hide = !mine && ContentFilter.hasBannedContent(msg.text);
  if (hide) {
    body.hidden = true;
    const warning = document.createElement("p");
    warning.className = "msg-hidden";
    warning.textContent = "Message hidden: it may contain abusive content.";
    const show = document.createElement("button");
    show.type = "button";
    show.className = "react-toggle";
    show.textContent = "Show anyway";
    show.addEventListener("click", () => {
      body.hidden = false;
      warning.hidden = true;
      show.hidden = true;
    });
    tools.append(show);
    li.append(meta, warning, body, tools);
  } else {
    li.append(meta, body, tools);
  }
  if (!mine) tools.append(reactControl(msg.seq));
  append(li);
  // Their message arrived, so they are not "typing" any more.
  if (!mine && partnerState === "typing") setPartnerState("connected");
}

// "React" opens a row of the six allowed reactions under a partner's message.
function reactControl(seq) {
  const wrap = document.createElement("span");
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "react-toggle";
  toggle.textContent = "React";
  toggle.setAttribute("aria-expanded", "false");
  const row = document.createElement("span");
  row.className = "react-row";
  row.hidden = true;
  for (const emoji of store.ALLOWED_REACTIONS) {
    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "react-pick";
    pick.textContent = emoji;
    pick.setAttribute("aria-label", `React with ${emoji}`);
    pick.addEventListener("click", () => {
      row.hidden = true;
      toggle.hidden = false;
      toggle.setAttribute("aria-expanded", "false");
      // Encrypted like a message: the server cannot tell the two apart.
      sendSecure({ t: "react", ref: seq, emoji }, "reaction", () =>
        showReaction(store.messageId(seq, false), emoji, me)
      );
    });
    row.append(pick);
  }
  toggle.addEventListener("click", () => {
    row.hidden = !row.hidden;
    toggle.setAttribute("aria-expanded", String(!row.hidden));
  });
  wrap.append(toggle, row);
  return wrap;
}

function showReaction(id, emoji, from) {
  const reactions = store.addReaction(id, emoji, from);
  if (reactions) renderReactions(id, reactions); // unknown message or repeat: ignored
}

// Shows "😂 2  👍" under the message that was reacted to.
function renderReactions(id, reactions) {
  const li = [...els.log.children].find((line) => line.dataset.msg === id);
  if (!li) return; // scrolled off the screen
  const tools = li.querySelector(".msg-tools");
  let span = li.querySelector(".reactions");
  if (!span) {
    span = document.createElement("span");
    span.className = "reactions";
    tools.prepend(span);
  }
  const counts = new Map();
  for (const { emoji } of reactions) counts.set(emoji, (counts.get(emoji) || 0) + 1);
  span.textContent = [...counts].map(([emoji, n]) => (n > 1 ? `${emoji}×${n}` : emoji)).join(" ");
}

// ---------- Actions ----------
// /start, /next and /leave go to the server; the answer arrives as an event.
function sendCommand(event, onOk, payload = {}) {
  if (!socket.connected) return err("Not connected.");
  socket.emit(event, payload, (ack) => {
    if (!ack) return;
    if (ack.ok) return onOk?.();
    if (ack.error.code === "INVALID_STATE") {
      err(
        event === "session:start"
          ? "You are already searching or chatting."
          : event === "session:next"
            ? "You are not in a chat. Choose Find a stranger first."
            : "There is nothing to end."
      );
    } else if (ack.error.code === "BANNED") {
      err("This connection is blocked from matching for now, after reports from other people. It lasts up to 24 hours.");
    } else if (ack.error.code === "COUNTRY_UNKNOWN") {
      // Only worldwide matching is possible for this connection.
      err("We could not detect your country, so only worldwide matching is available.");
      els.scopeLocal.disabled = true;
      document.querySelector('input[name="scope"][value="world"]').checked = true;
      els.scopeNote.textContent = "Country could not be detected for this connection.";
      els.scopeNote.hidden = false;
    } else if (ack.error.code === "RATE_LIMITED") {
      err("Slow down: too many searches. Try again in a minute.");
    } else {
      err("That did not work. Please try again.");
    }
  });
}

function beginSearch(event) {
  if (!CAN_ENCRYPT) return err(NO_ENCRYPTION_TEXT);
  const prefs = currentPrefs();
  sendCommand(
    event,
    () => {
      searchPrefs = prefs;
      searching = true;
      searchOpen = prefs.interests.length === 0;
      render();
    },
    prefs
  );
}
const startSearch = () => beginSearch("session:start");
const nextStranger = () => beginSearch("session:next");
function endChat() {
  sendCommand("session:leave", () => {
    // Leaving while searching produces its own "ended" event from the server.
    searching = false;
    searchOpen = false;
    render();
  });
}

// The safety code is made from both public keys. If the server (or anyone on
// the way) swapped a key, the two sides see different codes.
function showSafetyCode() {
  const code = channel && channel.ready ? channel.safetyCode : null;
  if (!code) return err("The chat is still being secured. Try the safety code again in a moment.");
  els.verifyCode.textContent = code;
  els.verifyDialog.showModal();
}

// ---------- Reporting ----------
// Only a category is sent, never text. The server ends the chat and answers
// with a "reported" end, which is what tells the person it worked.
function openReport() {
  if (!partner) return err("You are not chatting with anyone.");
  els.reportForm.reset();
  els.reportDialog.showModal();
}

els.reportForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const reason = new FormData(els.reportForm).get("reason");
  if (typeof reason !== "string") return;
  els.reportDialog.close();
  if (!socket.connected) return err("Not connected. Your report was not sent.");
  socket.emit("session:report", { reason }, (ack) => {
    if (!ack || ack.ok) return;
    if (ack.error.code === "RATE_LIMITED") err("You have sent several reports recently. Try again later.");
    else if (ack.error.code === "NOT_IN_SESSION") err("That chat has already ended, so there is nothing to report.");
    else err("Your report was not sent. Please try again.");
  });
});
els.reportCancel.addEventListener("click", () => els.reportDialog.close());
els.report.addEventListener("click", openReport);

els.start.addEventListener("click", startSearch);
els.next.addEventListener("click", nextStranger);
els.leave.addEventListener("click", endChat);
els.verify.addEventListener("click", showSafetyCode);

// ---------- Typing indicator ----------
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
  if (!partner || els.input.value.trim() === "") return stopTyping();
  const now = Date.now();
  if (!iAmTyping || now - lastTypingSentAt > 2000) {
    sendTyping(true);
    lastTypingSentAt = now;
    iAmTyping = true;
  }
  clearTimeout(stopTypingTimer);
  stopTypingTimer = setTimeout(stopTyping, 3000);
});

// ---------- Composer ----------
// The text the filter warned about. Sending the very same text again confirms it.
let warnedText = null;
els.input.addEventListener("input", () => {
  if (els.input.value.trim() !== warnedText) warnedText = null; // edited: check again
});

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = els.input.value.trim();
  if (!text) return;
  stopTyping();

  // Content filter, before anything is encrypted or sent (US-28). Banned
  // content is not sent and stays in the box to be changed. Personal
  // information or spam asks for a second press of Send to confirm.
  const verdict = ContentFilter.check(text);
  if (verdict.blocked) {
    return err("That message was not sent: it looks like it contains abusive or unsafe content. Please change it.");
  }
  if (verdict.warnings.length > 0 && warnedText !== text) {
    warnedText = text;
    const what = verdict.warnings.map((w) => ContentFilter.WARNING_TEXT[w]).join(" ");
    return note(`${what} Strangers can see everything you send, so only press Send again if you are sure.`, true);
  }
  warnedText = null;

  history.push(text);
  if (history.length > MAX_HISTORY) history.shift();
  historyIndex = history.length;
  els.input.value = "";

  // Encrypted here, in the browser. My own line appears once the server has
  // passed the envelope on, so what I see is what was really sent.
  const name = me;
  sendSecure({ t: "msg", text }, "message", (seq) =>
    showMessage({ seq, from: name, text, sentAt: Date.now() }, true)
  );
});

// Up/down walks back through what was sent this session (in memory only).
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

// ---------- Boot ----------
render();
if (hasConsent()) {
  els.start.focus();
  socket.connect();
} else {
  showGate();
}
