// Loaded in <head> BEFORE first paint so the saved theme shows immediately
// (no flash). It is a file, not an inline script, so the Content Security
// Policy can forbid every inline script.
try {
  document.documentElement.dataset.theme = localStorage.getItem("rtc.theme") || "phosphor";
} catch (e) {
  /* storage blocked: CSS falls back to the default theme */
}
