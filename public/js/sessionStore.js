// What the page remembers about the current chat. It lives only in this
// array, in browser memory: never localStorage, sessionStorage, cookies or
// IndexedDB. A refresh, a closed tab, /next, /leave or the end of the chat
// all empty it, and nothing can bring it back.
//
// A plain script (no modules), so the page can load it before client.js and
// the tests can run it in isolation. It exposes one global: SessionStore.
(function () {
  "use strict";

  const MAX_MESSAGES = 500; // same cap as the lines on screen
  const MAX_REACTIONS_PER_MESSAGE = 12;
  // Keep in sync with ALLOWED_REACTIONS in src/types/events.ts.
  const ALLOWED_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  // Each side numbers its own messages 1, 2, 3... (the envelope numbers of
  // js/crypto.js), so a number alone is not unique in a chat: "my message 2"
  // and "their message 2" both exist. The id says whose it is.
  function messageId(seq, mine) {
    return `${mine ? "me" : "them"}:${seq}`;
  }

  function createSessionStore() {
    let messages = [];

    return {
      ALLOWED_REACTIONS,
      MAX_MESSAGES,
      messageId,

      // msg: { seq, from, text, sentAt }. `mine` marks the user's own messages.
      // Returns the message's id, for addReaction and for the screen.
      addMessage(msg, mine) {
        const id = messageId(msg.seq, !!mine);
        messages.push({ id, seq: msg.seq, from: msg.from, text: msg.text, sentAt: msg.sentAt, mine: !!mine, reactions: [] });
        if (messages.length > MAX_MESSAGES) messages.shift();
        return id;
      },

      // Returns the message's reactions after adding, or null if the message is
      // unknown (already scrolled out, cleared, or never existed) or the
      // reaction is not allowed or is a repeat.
      addReaction(id, emoji, from) {
        if (!ALLOWED_REACTIONS.includes(emoji)) return null;
        const msg = messages.find((m) => m.id === id);
        if (!msg) return null;
        if (msg.reactions.some((r) => r.from === from && r.emoji === emoji)) return null;
        if (msg.reactions.length >= MAX_REACTIONS_PER_MESSAGE) return null;
        msg.reactions.push({ from, emoji });
        return msg.reactions.slice();
      },

      // The number of the partner's latest message: what /react points at.
      lastPartnerSeq() {
        for (let i = messages.length - 1; i >= 0; i--) {
          if (!messages[i].mine) return messages[i].seq;
        }
        return null;
      },

      size() {
        return messages.length;
      },

      clear() {
        messages = [];
      },
    };
  }

  globalThis.SessionStore = { create: createSessionStore, ALLOWED_REACTIONS, messageId };
})();
