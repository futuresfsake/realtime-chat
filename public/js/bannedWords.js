// Words and phrases the content filter refuses to send and hides on arrival.
// Deliberately narrow: slurs, threats and wishes of self-harm aimed at a
// person, solicitation for sexual images, and terms for child sexual abuse
// material. Ordinary swearing is NOT here: people use it casually in English
// and Filipino, and blocking it would make the chat unusable.
//
// OWNER REVIEW REQUIRED (gap G-16): this is a starting list. Whoever runs the
// service decides what belongs here, and a Filipino-language review is still
// to do. Matching is on whole words after the text is normalised (see
// contentFilter.js), so "class" or "grape" never match.
//
// A plain script (no modules): it exposes one global, BannedWords.
(function () {
  "use strict";

  globalThis.BannedWords = Object.freeze([
    // Slurs
    "nigger",
    "nigga",
    "faggot",
    "fag",
    "tranny",
    "retard",
    "retarded",
    "cunt",
    // Threats and self-harm aimed at a person
    "kill yourself",
    "kys",
    "i will kill you",
    "ill kill you",
    "i will rape you",
    "rape you",
    "magpakamatay ka",
    "patayin kita",
    // Solicitation of sexual images
    "send nudes",
    "send nude",
    "nudes",
    "send pics of you naked",
    // Child sexual abuse material
    "child porn",
    "kiddie porn",
    "loli",
    "shota",
  ]);
})();
