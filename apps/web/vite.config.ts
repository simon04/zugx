import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { execFileSync } from "node:child_process";
import { defineConfig } from "vite-plus";
import { toml } from "@zugx/toml/vite";
import { precompress } from "./precompress.ts";

/**
 * last commit as `<hash>|<YYYY-MM-DD HH:MM>` (committer time in Vienna), empty without a git
 * checkout (e.g. container build)
 */
function gitVersion(): string {
  try {
    return execFileSync(
      "git",
      ["log", "-1", "--date=format-local:%Y-%m-%d %H:%M", "--format=%h|%cd"],
      { encoding: "utf8", env: { ...process.env, TZ: "Europe/Vienna" } },
    ).trim();
  } catch {
    return "";
  }
}
const [commitHash = "", commitDate = ""] = gitVersion().split("|");
// exposed as import.meta.env.VITE_*, unless already set in the environment (CI build args)
process.env.VITE_COMMIT_HASH ??= commitHash;
process.env.VITE_COMMIT_DATE ??= commitDate;

export default defineConfig({
  plugins: [
    // prebuilt data (packages/*/data/*.toml) imported like JSON
    toml(),
    vue(),
    UnoCSS(),
    // .gz/.zst siblings of the text assets for Caddy's precompressed file_server
    precompress(),
    VitePWA({
      // "prompt": the new worker waits until lib/update.ts applies it (next navigation, or a tab
      // in the background) — never in the middle of what the user is doing
      registerType: "prompt",
      manifest: {
        name: "zugx",
        short_name: "zugx",
        description: "Austrian trains, fast: departures, connections, train runs, live",
        theme_color: "#0b0d10",
        background_color: "#0b0d10",
        display: "standalone",
        // opening a zugx link while the installed app is open: navigate it to the link
        // (default may just focus the existing window, staying on e.g. /radar)
        launch_handler: { client_mode: ["navigate-existing", "auto"] },
        id: "/",
        start_url: "/",
        scope: "/",
        lang: "de",
        categories: ["travel", "navigation", "utilities"],
        icons: [
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Radar",
            url: "/radar",
            icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
          },
          {
            name: "Züge / Trains",
            url: "/trains",
            icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
          },
          {
            name: "Bildfahrplan",
            url: "/bf",
            icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
          },
          {
            name: "Störungen / Disruptions",
            url: "/him",
            icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,mjs,css,html,svg,png,json,woff2}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//, /\.txt$/],
        // big, rarely used data (67 Bildfahrplan corridors, 156 VzG lines, full train index): not precached on
        // install, cached on first use instead (hashed file names → cache-first is safe)
        globIgnores: [
          "**/corridor-*.js",
          "**/vzg-*.js",
          "**/dep-*.js",
          "**/runs-*.js",
          "**/trains-*.full-*.js",
        ],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/(corridor-|vzg-|dep-|runs-|trains-\d{4}\.full-)[^/]+\.js$/,
            handler: "CacheFirst",
            options: { cacheName: "zugx-data", expiration: { maxEntries: 40 } },
          },
        ],
      },
    }),
  ],
  // maplibre-gl loads its worker via new URL(..., import.meta.url); pre-bundling breaks that
  optimizeDeps: { exclude: ["maplibre-gl"] },
  server: {
    proxy: {
      "/api/mgate": {
        target: "https://fahrplan.oebb.at",
        changeOrigin: true,
        rewrite: () => "/bin/mgate.exe",
        headers: { "User-Agent": "zugx-dev (https://zugx.legner.me)" },
      },
    },
  },
  build: {
    // third-party licenses of the bundled dependencies (production build only); not under /assets/,
    // which is served as immutable
    license: { fileName: "licenses.txt" },
    target: "es2023",
    // the only chunk above this is data: the full train index (trains-<year>.full, ~3 MB, ~160 KB
    // gzip), loaded on demand and not precached; code chunks stay well below (MapLibre ~1.1 MB)
    chunkSizeWarningLimit: 3200,
    rollupOptions: {
      output: {
        // recognisable names for corridor / VzG data chunks (excluded from the service worker
        // precache)
        chunkFileNames: (chunk) => {
          const id = chunk.facadeModuleId ?? "";
          if (id.endsWith("/index.toml")) return "assets/[name]-[hash].js";
          // Austria's data in data/, the other countries' in data/<country>/
          if (/\/netz\/data\/(?:[a-z]{2}\/)?corridors\//.test(id))
            return "assets/corridor-[name]-[hash].js";
          if (id.includes("/vzg/data/")) return "assets/vzg-[name]-[hash].js";
          if (/\/trains\/data\/(?:[a-z]{2}\/)?departures\//.test(id))
            return "assets/dep-[name]-[hash].js";
          // stops and times of trains HAFAS doesn't know (runs-<year>/<nn>.toml)
          if (/\/trains\/data\/(?:[a-z]{2}\/)?runs-\d{4}\//.test(id))
            return "assets/runs-[name]-[hash].js";
          return "assets/[name]-[hash].js";
        },
      },
    },
  },
  run: {
    tasks: {
      // the footer version comes from env (CI/container) or from git: never replay a cached
      // build (git HEAD is not a tracked input), and pass the variables through
      build: {
        command: "vp build",
        cache: false,
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
