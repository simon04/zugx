// One full load after a deploy left the page with chunks the server no longer has. Two places
// notice: Vite's vite:preloadError (any dynamic import) and the router (a route's chunk, with the
// page the user wanted) — the first to call wins, so the router's target isn't overridden by a
// plain reload of the old page.
let reloading = false;

/** load `url` (default: this page) fresh, once */
export function reloadOnce(url?: string) {
  if (reloading) return;
  reloading = true;
  if (url) location.assign(url);
  else location.reload();
}
