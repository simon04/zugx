// App updates without "reload twice": the service worker checks for a new version on start,
// every 30 minutes and whenever the tab becomes visible again. A new version is applied at the
// next navigation inside the app (or right away while the tab is in the background), so nobody
// keeps running an outdated build. And a route chunk that no longer exists on the server (an old
// page after a deploy) triggers one full load of the new version instead of a blank page.
import { registerSW } from "virtual:pwa-register";
import type { Router } from "vue-router";
import { reloadOnce } from "./reload.ts";

const CHUNK_ERROR =
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch/i;

export function setupUpdates(router: Router) {
  let pending = false;
  const apply = () => void updateSW(true); // activate the waiting worker and reload
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      pending = true;
      if (document.visibilityState === "hidden") apply();
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      setInterval(() => void reg.update(), 30 * 60_000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void reg.update();
        else if (pending) apply();
      });
    },
  });
  // a pending update: load the new version with the page the user navigates to
  router.afterEach((to, from) => {
    if (pending && from.matched.length && to.path !== from.path) apply();
  });
  // an outdated page asking for a chunk the server no longer has: load the target fresh (once)
  router.onError((err: unknown, to) => {
    if (!CHUNK_ERROR.test(String((err as Error)?.message ?? err))) return;
    const key = "zugx:chunk-reload";
    if (sessionStorage.getItem(key) === to.fullPath) return;
    sessionStorage.setItem(key, to.fullPath);
    reloadOnce(to.fullPath);
  });
}
