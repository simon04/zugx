// Entry: make sure Temporal exists before any app module evaluates. Browsers with native Temporal
// skip the polyfill chunk entirely; the others load it first. The app is imported dynamically
// *after* that, so no module of its graph runs without Temporal (a sibling static import would be
// evaluated before this top-level await settles). (modern-web-guidance: conditional-async-dependencies)
import { reloadOnce } from "./lib/reload.ts";

// a chunk of an older deploy is gone (404): reload once to get the current index.html and its
// chunks; not again within a minute, so a real outage doesn't loop. A second later: a route's
// chunk is handled by the router first (lib/update.ts), with the page navigated to
addEventListener("vite:preloadError", () => {
  const last = Number(sessionStorage.getItem("zugx:reloaded") ?? 0);
  if (Date.now() - last < 60_000) return;
  setTimeout(() => {
    sessionStorage.setItem("zugx:reloaded", String(Date.now()));
    reloadOnce();
  }, 1000);
});
if (!("Temporal" in globalThis)) await import("temporal-polyfill/global");
await import("./app.ts");
