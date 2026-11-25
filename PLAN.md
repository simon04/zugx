# zugx — a geeky ÖBB timetable web app

**https://zugx.legner.me**

> A fast, mobile-friendly, information-dense timetable browser for Austrian (and neighbouring) public transport.
> Scotty's data, npmx.dev's feel. Later: Netzgrafik views of the Austrian integrated interval timetable (ITF / Taktfahrplan).

Status: **M0–M7 implemented (2026-11-13), live at zugx.legner.me** (Quadlet container behind a Cloudflare Tunnel, CI on GitHub). Implementation notes and deviations in §13; what is still open in §16.

Name: **zugx** (decided).

Considered names (German railway terms):

| Name         | Meaning                                                                        |
| ------------ | ------------------------------------------------------------------------------ |
| Kursbuch     | printed book of all timetables; ÖBB still publishes one per timetable period   |
| Bildfahrplan | time–distance diagram (graphic timetable)                                      |
| Perron       | old Austrian/Swiss word for platform (Bahnsteig)                               |
| Buchfahrplan | the train driver's timetable for one train                                     |
| Taktknoten   | node station where trains meet on the hour in an integrated interval timetable |
| Kondukteur   | old Austrian word for conductor                                                |
| Stellwerk    | signal box; already used by many products and games                            |
| Drehscheibe  | turntable; clashes with the "Drehscheibe Online" railway fan forum             |

---

## 1. Goals / non-goals

**Goals**

- Journey search A → B (via, date/time, dep/arr, products filter, min. transfer time)
- Station boards (departures / arrivals) with realtime delays, platforms, cancellations
- Train detail ("Zuglauf"): all stops, times, delays, platform, composition if available
- Disruption info (HIM messages)
- **Train index**: every train running in Austria this timetable year, vagonweb-style (see §8); links to vagonweb compositions later (§8.5)
- **Instant station search** from a local, pre-built station index (no network round trip per keystroke)
- **Excellent visualization** of found connections (see §5)
- Shareable, permalink-style URLs for everything
- Fast and mobile-friendly first; keyboard shortcuts on desktop as a bonus (`/` to focus search, arrow keys, `j/k`, shortcuts for earlier/later)
- Dark/light mode, dense "geek" layout, monospace accents, no fluff
- UI in **English, German, Italian** (i18n from day 1, `vue-i18n`; default from browser language)
- Responsive: dense tables/timelines on desktop, collapsing to cards on mobile; station board + journey search must work well on a phone

**Non-goals (for now)**

- Ticket sales / prices (decided: ignored; at most a deep link to the ÖBB ticket shop per journey)
- Delay history / punctuality statistics (decided: out of scope for now, idea kept — see §7, option C, and §11)
- Native apps (PWA is enough)
- User accounts

---

## 2. UI reference: npmx.dev

What to borrow from npmx.dev:

- Search-first landing page; `/` focuses search, arrow keys navigate results
- Dense, calm, typographic layout; dark mode by default with light mode toggle
- URL-compatible permalinks (npmx mirrors npmjs.com URLs → we could mirror sensible Scotty-ish URL patterns, but mainly our own clean ones)
- Fast: aggressive caching, small client bundles, instant local search
- npmx is built on Nuxt; we take the look & feel, but as a plain Vue SPA (see §6)

Proposed URL structure:

| Page                        | URL                                                               |
| --------------------------- | ----------------------------------------------------------------- |
| Home / search               | `/`                                                               |
| Station search              | `/s?q=wien`                                                       |
| Station board               | `/station/8103000` (`?arr`, `?t=2026-11-13T12:00`, `?products=…`) |
| Journey search              | `/j/8103000/8100002?t=…&via=…&dep`                                |
| Journey detail (one result) | `/j/…/#3` or `/trip/<recon-token>`                                |
| Train run                   | `/train/<journeyId>` and friendly `/train/RJX-260?d=2026-11-13`   |
| Disruptions                 | `/him`                                                            |
| Train index                 | `/trains` (see §8)                                                |
| Netzgrafik (later)          | `/netz/<region>`                                                  |

Station IDs = HAFAS/UIC "EVA"/IBNR numbers (Austrian stations are `81xxxxx`, e.g. Wien Hbf `8103000`).

---

## 3. Data source: ÖBB HAFAS `mgate.exe` API

### 3.1 How Öffi & friends talk to ÖBB

- **Öffi** (Andreas Schildbach) uses the library **public-transport-enabler (PTE)**, which has an `OebbProvider` extending its HAFAS provider base. Older versions used `fahrplan.oebb.at/bin/query.exe`; current PTE/others use the JSON **mgate** API.
- **KDE KPublicTransport** network config for ÖBB (at_oebb, 2026-04): endpoint `https://fahrplan.oebb.at/bin/mgate.exe`, auth `{type: "AID", aid: "OWDL4fE4ixNiPBBm"}`, client `{id: "OEBB", type: "AND"}`. Realtime coverage AT, regular coverage incl. CH, CZ, DE, HU, IT, …
- **hafas-client** (JS, `public-transport/hafas-client`) has an `oebb` profile (`hafas-client/p/oebb`). Good reference for request/response parsing (lines, products bitmask, remarks, polylines). Ports exist: pyhafas (Python), hafas-rs (Rust), fshafas (F#), hafas-client-php.
- Community docs (e.g. mitsuhiko's "oebb-scotty" agent skill) use `ver: "1.67"`, `client: {id:"OEBB", type:"WEB", name:"webapp", l:"vs_webapp"}`.

> ⚠️ Unofficial API. No SLA, no published ToS for third-party use, may change any time (AID / version bumps). Must be polite: caching, rate limiting, honest User-Agent with contact. We should design an adapter layer so we can swap sources.

### 3.2 Request envelope

```json
POST https://fahrplan.oebb.at/bin/mgate.exe
Content-Type: application/json

{
  "id": "1", "ver": "1.67", "lang": "deu",
  "auth":   { "type": "AID", "aid": "OWDL4fE4ixNiPBBm" },
  "client": { "id": "OEBB", "type": "WEB", "name": "webapp", "l": "vs_webapp" },
  "formatted": false,
  "svcReqL": [ { "meth": "LocMatch", "req": { "input": { "field": "S", "loc": { "name": "Wien Hbf", "type": "ALL" }, "maxLoc": 10 } } } ]
}
```

`svcReqL` can batch several requests in one HTTP call.

### 3.3 Methods we need

| Method                           | Use                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `LocMatch`                       | station/address/POI search (fallback when local index misses, addresses/POIs) |
| `LocGeoPos`                      | nearby stations                                                               |
| `TripSearch`                     | journeys; `outCtxScrF`/`outCtxScrB` context tokens for "earlier/later" paging |
| `Reconstruction`                 | refresh a journey by its `ctxRecon` token (permalinks, live updates)          |
| `StationBoard`                   | departures/arrivals (`type: DEP/ARR`)                                         |
| `JourneyDetails`                 | full train run incl. stops, remarks, polyline                                 |
| `JourneyGeoPos` / `JourneyMatch` | live train positions ("radar") / find train by number                         |
| `HimSearch`                      | disruptions                                                                   |

Response quirks to handle (hafas-client has prior art for all of these):

- Common lookup tables in `res.common` (`locL`, `prodL`, `opL`, `remL`, `himL`, `polyL`), objects reference them by index
- Times as `HHMMSS` strings with optional day offset prefix (`01HHMMSS`), relative to a `date` (`YYYYMMDD`), Europe/Vienna
- Realtime vs planned: `dTimeS`/`dTimeR`, `dPlatfS`/`dPlatfR`, cancellations flags
- Coordinates as integers ×10⁶
- `lid` location strings: `A=1@O=Wien Hbf@L=8103000@…`
- Products as a class bitmask (`pCls`) → map to RJX/RJ/NJ/ICE/EC/IC/D/REX/R/S/Bus/…
- Encoded polylines (`polyG`/`crdEncYX`) for map display

### 3.4 No backend: static SPA + dumb reverse proxy (decided)

The browser can't call `mgate.exe` directly (no CORS headers). Instead of an app backend we serve the SPA and the API from **one origin**, so no CORS is needed at all:

```
browser ──► host Caddy (zugx.legner.me, TLS)
             └─► 127.0.0.1:9849  podman container "zugx" (Caddy, HTTP only)
                   ├─ /            → static Vue SPA (dist/, incl. hashed stations chunk)
                   └─ /api/mgate   → reverse_proxy https://fahrplan.oebb.at/bin/mgate.exe
```

The host Caddy only terminates TLS and forwards; everything app-specific is inside the container image, so the app is self-contained and versioned with the repo.

- All HAFAS logic (request building, parsing, normalizing) lives **in the browser** in `packages/hafas` (typed, framework-free TS). The AID is public anyway (it ships in the official apps).
- **Caddy** (decided), stock build:
  - only `POST`, `request_body max_size 8KB`, fixed upstream → it can't be abused as an open proxy
  - set an honest `User-Agent` with a contact
  - TLS automatic, as usual with Caddy
- Stock Caddy has **no response cache and no rate limiting**. Options:
  1. **Start without** (decided default): cache in the client instead (in-memory + IndexedDB, ~30 s TTL for boards/searches, dedupe in-flight identical requests). Fine at hobby traffic.
  2. Later, if needed, build Caddy with `xcaddy`: `github.com/mholt/caddy-ratelimit` for rate limits, and `github.com/caddyserver/cache-handler` (Souin) for caching — **to verify** whether it can key on the POST body (HAFAS is POST-only, so a cache needs the body in its key).
  3. Alternatively a ~50-line proxy sidecar (Go/Bun) behind Caddy that hashes the body and caches — only if 2 doesn't work.
- If we ever need more (sampling delays for statistics, push), we add a small service then — not now.
- Option: use `hafas-client` with the ÖBB profile in the browser vs. our own minimal typed client. Leaning towards **own small client** (only ~8 methods, no Node deps, tree-shakeable), using hafas-client as reference + test oracle.

### 3.5 Alternative / complementary sources

- **data.oebb.at** – ÖBB open data portal (checked 2026-11-13):
  - [GTFS Fahrplan ÖBB 2026](https://data.oebb.at/de/datensaetze~soll-fahrplan-gtfs~): static GTFS ZIP, valid 14.12.2025 – 12.12.2026, updated yearly, **CC BY 4.0**, download after accepting terms (no API key). Covers **ÖBB-Personenverkehr, CAT, Montafonerbahn only** — not WESTbahn, GKB, StH, …
  - [NeTEx 2026 (EU 2024/490 / MMTIS)](https://data.oebb.at/de/datensaetze~datenbereitstellung_delegierte_verordnung_eu_2024-490~) by ÖBB-Infrastruktur, CC BY 3.0 AT ("Datenquelle: ÖBB-Infrastruktur AG").
  - **"Zugfahrten" CSV** (same page; also on mobilitydata.gv.at as "Zugfahrten" and "Verspätungen von Zugfahrten"): planned **and actual** times of train runs incl. cancellations, updated at least weekly. Not live, but the ready-made basis for **delay statistics later** (§11) — no sampling service needed.
  - Use for the **station index**, the **train index**, and later **Netzgrafik/ITF analysis** (static schedule).
- **mobilitydata.gv.at** (national access point): Austria-wide "Soll-Fahrplandaten (GTFS)" / "(NeTEx)" for **all operators** → preferred source for the train index (§8) since the ÖBB GTFS misses other operators. Licence, coverage and train numbers — to verify in M0.
- **Realtime: no open GTFS-RT / SIRI / VDV feed for Austrian rail exists** (checked 2026-11-13: data.oebb.at, mobilitydata.gv.at "Echtzeit" filter, MobilityDatabase). The FFG project **SIRI4AT** (06/2026 – 11/2027) is building an Austrian SIRI profile with open-source converters incl. to GTFS-RT → watch it; until then **realtime only via HAFAS**.
- Neighbours later (DB, SBB opentransportdata.swiss GTFS) if cross-border matters.

---

## 4. Station cache ("super fast access")

Goal: station autocomplete returns results in < 5 ms after first load, works offline.

**Build step (CI, e.g. weekly cron)**

1. Source stations from **open data** GTFS/NeTEx (mobilitydata.gv.at / data.oebb.at — the same feed as the train index, §8) (decided), then map/verify each to its **HAFAS ID** (what the API needs) via `LocMatch` in CI. No HAFAS grid crawl.
2. Merge + dedupe; keep: `id`, `name`, `lat`, `lon`, product mask, "weight" (importance — e.g. number of departures/day or product class, so "Wien Hbf" beats "Wiener Neustadt Hbf" for `wien`), aliases/abbrev (e.g. `Wien Hbf`, `Wien Hauptbahnhof`, Betriebsstellen-Kürzel like `Wbf`?).
3. Write **`packages/stations/stations.json` — committed to the repo** (decided). Pretty-printed, one station per line, sorted by ID → readable, small `git diff`s show exactly which stations changed. Rail-only AT ≈ 1–2k stations → ~100–200 KB raw, a few tens of KB compressed.
4. A scheduled GitHub Action reruns the build weekly and **opens a PR** if the JSON changed (review the diff, merge). The build is never run at deploy time, so deploys are reproducible and don't depend on ÖBB being up.

Example entry:

```json
{
  "id": "8103000",
  "name": "Wien Hbf",
  "lat": 48.185184,
  "lon": 16.376413,
  "p": ["RJX", "RJ", "NJ", "EC", "REX", "R", "S"],
  "w": 1000,
  "alias": ["Wien Hauptbahnhof"]
}
```

(Coordinates illustrative.) A JSON Schema (`stations.schema.json`) + a CI check validates the file.

**Client**

- The SPA loads it with a dynamic `import('…/stations.json')` → Vite emits it as its own content-hashed chunk: cached forever by the browser, not in the main bundle, re-downloaded only when it changes
- Precached by the service worker (PWA, offline)
- Search: normalized (lowercase, strip diacritics: `ö→o`/`oe`, `ß→ss`, `St.`↔`Sankt`, `Hbf`↔`Hauptbahnhof`), prefix + fuzzy (e.g. `uFuzzy` or a small trigram/prefix index built in a Web Worker), ranked by weight
- Recents & favourites in `localStorage`; ranked above index hits
- Fallback to server `LocMatch` for addresses/POIs or zero hits

---

## 5. Visualizing connections

The main differentiator. Ideas, roughly in priority order:

1. **Timeline strip per journey ("Gantt row")** – horizontal time axis shared by all results on screen; each journey a row; each leg a bar coloured by product (RJX red, S-Bahn blue, bus, walk = dotted), transfers as gaps with transfer time labelled (red if tight). Realtime: planned bar ghosted behind actual. Scanning many results at once shows the Takt pattern instantly.
2. **Summary table, terminal-ish** – dep/arr (with `+3` delay superscripts), duration, transfers, products, platform; sortable; keyboard nav; expand inline.
3. **Leg detail / Zuglauf** – vertical line diagram with all intermediate stops, platforms, delay sparkline along the run, occupancy if provided, remarks/HIM inline.
4. **Map** – MapLibre GL + OSM/OpenRailwayMap tiles, legs as polylines from HAFAS geometry, live train position (`JourneyGeoPos`).
5. **Bildfahrplan (time–distance diagram)** – for a corridor (e.g. Westbahn Wien–Salzburg): x = distance/stations, y = time; every train a line. Perfect geek view and a bridge to §7.
6. **Transfer quality view** – for a connection, show alternatives if a transfer breaks ("what if I miss it?" → next options via `TripSearch` from the transfer station).

Tech: SVG via D3 scales (or plain Vue + computed SVG) for 1–3, 5; Canvas/WebGL only if data volume demands.

---

## 6. Proposed stack

| Concern        | Choice                                                                                                                                                                                                         | Notes                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Framework      | **Vue 3 + Vite + TS, SPA** (decided)                                                                                                                                                                           | Vue Router, Pinia only if needed; no SSR/Nuxt since there's no backend        |
| i18n           | `vue-i18n`                                                                                                                                                                                                     | en, de, it (decided)                                                          |
| Licence        | **AGPL-3.0** (decided)                                                                                                                                                                                         | hafas-client (ISC) code reusable; PTE (GPL) usable as reference               |
| Styling        | UnoCSS                                                                                                                                                                                                         | dense utility styling; CSS vars for theme (npmx-like)                         |
| Viz            | D3 (scales/shapes only) + SVG                                                                                                                                                                                  | no heavy chart lib                                                            |
| Map            | MapLibre GL                                                                                                                                                                                                    | open tiles, OpenRailwayMap overlay                                            |
| Station search | Web Worker + uFuzzy / custom prefix index                                                                                                                                                                      |                                                                               |
| Offline        | `vite-plugin-pwa`                                                                                                                                                                                              | precache station index + shell                                                |
| Hosting        | **zugx.legner.me**, own server, **Podman** (decided): one container (Caddy serving `dist/` + `/api/mgate` proxy) run as a systemd service via Quadlet; host Caddy in front for TLS                             |                                                                               |
| Toolchain      | **Vite+ (`vite-plus`, latest — 1.6.0 as of 2026-11) + pnpm (latest — 12.18.0)** (decided)                                                                                                                      | one `vp` CLI for dev/build/test/lint/fmt/typecheck/pack/tasks/hooks, see §6.1 |
| Testing        | Vitest via `vp test` (unit, recorded HAFAS fixtures), Playwright (e2e)                                                                                                                                         |                                                                               |
| CI             | GitHub Actions: build image → push to `ghcr.io/simon04/zugx` (decided), server pulls via `podman auto-update`; weekly job regenerating `stations.json` + `trains-<year>.json` / `trains-<year>.full.json` → PR |                                                                               |

Repo layout (monorepo, pnpm workspace, Vite+):

```
apps/web            Vue SPA (pages, components, viz)
packages/hafas      typed ÖBB mgate client + normalizer, runs in browser (+ fixtures)
packages/stations   build script (Node, CI only) + committed stations.json + schema
packages/trains     train index build script (Node, CI only) + committed trains-<year>.json (default, long-distance) + trains-<year>.full.json (all)
packages/netz       (later) GTFS → ITF analysis → Netzgrafik model
deploy/             Containerfile (node build stage → caddy:2-alpine), Caddyfile (in-container),
                    zugx.container (Quadlet unit), Caddyfile.host (snippet for the host Caddy)
```

### 6.1 Tooling: full Vite+ with pnpm (decided)

Use **all of Vite+** (VoidZero's unified toolchain, https://viteplus.dev) — no separate ESLint/Prettier/Husky/lint-staged/Turbo/tsup:

| Concern                                   | Vite+ command                                              | Wraps             |
| ----------------------------------------- | ---------------------------------------------------------- | ----------------- |
| dev server / build / preview (`apps/web`) | `vp dev`, `vp build`, `vp preview`                         | Vite (Rolldown)   |
| unit tests                                | `vp test`                                                  | Vitest            |
| lint (type-aware)                         | `vp lint`                                                  | Oxlint + tsgolint |
| format                                    | `vp fmt`                                                   | Oxfmt             |
| all checks (fmt + lint + types)           | `vp check` (`--fix` locally)                               |                   |
| library builds (`packages/hafas`)         | `vp pack`                                                  | tsdown            |
| monorepo tasks with caching               | `vp run -r build`, `vp run --filter …`                     | Vite Task         |
| git hooks                                 | `vp config` → `.vite-hooks/pre-commit` running `vp staged` | lint-staged       |
| deps                                      | `vp install`, `vp add`, `vp outdated` → pnpm               |                   |
| Node + pnpm versions                      | global `vp` (`vp env`)                                     |                   |

- Always use the **latest** `vite-plus` and **pnpm**: `packageManager: "pnpm@<latest>"` in the root `package.json`, Node 24 LTS in `.node-version`; Renovate (or Dependabot) keeps `vite-plus`, pnpm and `voidzero-dev/setup-vp` current.
- Scaffold with `vp create` (Vue template, monorepo) in M1 rather than hand-writing configs.
- **One root `vite.config.ts`** holds shared `lint`, `check`, `staged` and `run.tasks`; **formatting uses Oxfmt defaults** (no `fmt` block, decided); per-package overrides via `overrides` in the root config (Vite+ recommends against package-level lint/fmt blocks). `apps/web/vite.config.ts` only has app-specific Vite config (Vue plugin, PWA, UnoCSS, `server.proxy` for `/api/mgate`).
  ```ts
  // vite.config.ts (root) — sketch
  import { defineConfig } from "vite-plus";
  export default defineConfig({
    defaultPackage: { dev: "./apps/web", build: "./apps/web" },
    lint: { plugins: ["typescript", "vue"], options: { typeAware: true, typeCheck: true } },
    staged: { "*": "vp check --fix" },
    run: {
      tasks: {
        "stations:build": { command: "node packages/stations/build.ts", cache: false },
        "trains:build": { command: "node packages/trains/build.ts", cache: false },
      },
    },
  });
  ```
  (Untested; exact keys checked against the docs when scaffolding.)
- **CI**: `voidzero-dev/setup-vp@<pinned release>` (v1.22.0 as of 2026-11; pin an exact tag/SHA, not `v1`) with `cache: true`, then `vp check`, `vp test`, `vp build`; plus the Vite Task GitHub Actions cache. Containerfile build stage uses the same: install `vite-plus`, `vp install --frozen-lockfile`, `vp build`.
- **To verify in M1 (Vue)**: how well Oxlint/tsgolint and Oxfmt handle `.vue` SFCs (template + `<script setup lang="ts">`). If type checks don't cover SFCs, add a `vue-tsc --noEmit` task to `vp run` and CI; if Oxfmt can't format `.vue` yet, accept that until it can.

Sketch of `deploy/Caddyfile` (inside the container, plain HTTP on :8080):

```caddyfile
{
	admin off
	auto_https off
}

:8080 {
	encode zstd gzip

	handle /api/mgate {
		@notPost not method POST
		respond @notPost 405

		request_body {
			max_size 8KB
		}

		rewrite * /bin/mgate.exe
		reverse_proxy https://fahrplan.oebb.at {
			header_up Host fahrplan.oebb.at
			header_up User-Agent "zugx (https://zugx.legner.me)"
			header_up -Cookie
			header_down -Set-Cookie
		}
	}

	handle {
		root * /srv
		@hashed path /assets/*
		header @hashed Cache-Control "public, max-age=31536000, immutable"
		try_files {path} /index.html
		file_server
	}
}
```

`deploy/Caddyfile.host` (add to the existing host Caddy):

```caddyfile
zugx.legner.me {
	reverse_proxy 127.0.0.1:9849
}
```

`deploy/zugx.container` (Quadlet → `~/.config/containers/systemd/` for rootless, or `/etc/containers/systemd/`):

```ini
[Unit]
Description=zugx timetable web app

[Container]
ContainerName=zugx
Image=ghcr.io/simon04/zugx:latest
PublishPort=127.0.0.1:9849:8080
AutoUpdate=registry
ReadOnly=true
Tmpfs=/data
Tmpfs=/config

[Service]
Restart=always

[Install]
WantedBy=default.target
```

Then `systemctl --user daemon-reload && systemctl --user start zugx`. Updates: `podman auto-update` (enable `podman-auto-update.timer`) pulls new images pushed by CI. Rootless + `loginctl enable-linger` so it runs without a login session. Alternative without a registry: `podman build -t localhost/zugx -f deploy/Containerfile .` on the server and `Image=localhost/zugx`.

(Untested sketches — validate with `caddy validate` and a first deploy in M1. For local dev (`vp dev`), Vite's `server.proxy` does the same `/api/mgate` forwarding.)
Client sends deterministic JSON (fixed key order, "now" rounded to the minute) so its own cache — and a proxy cache later — gets hits for equal searches.

---

## 7. Later: Netzgrafik for the integrierter Taktfahrplan

Reference: **Netzgrafik-Editor (NGE)** by SBB, open source since 2024 (Angular/TS frontend, Java backend), now under the OpenRail Association; has JSON import/export. SNCF's OSRD integrates it.

Approach options:

- **A. Export to NGE JSON** – derive from GTFS: for each line pattern & hour, the departure/arrival **minutes** at nodes, frequency (Takt 30/60/120), travel times between nodes; generate NGE JSON → open in the public NGE demo. Lowest effort, great validation.
- **B. Own read-only Netzgrafik renderer** – nodes = Knoten (Wien Hbf, St. Pölten, Linz, Salzburg, Graz, Villach, Innsbruck…), edges = Linien with minute labels at both ends, symmetry check (Symmetrieminute ≈ :00/:30), Knotenzeiten highlighting (Vollknoten vs Halbknoten), transfer quality at nodes.
- **C. Live-ish overlay** – colour edges by today's realtime punctuality from sampled HAFAS boards.

Data pipeline: GTFS → filter rail → cluster trips into line patterns → detect Takt per pattern/time window → compute node minutes → model. Prototype in a notebook/script first.

Note: the ÖBB "Zielnetz 2040"/Taktfahrplan Österreich planning is published as documents, not data — so the Netzgrafik would be reconstructed from the _current_ timetable.

---

## 8. Train index ("Zugindex", vagonweb-style)

A browsable, searchable list of **every train running in Austria** in the current timetable year (Fahrplanjahr 2026: 14.12.2025 – 12.12.2026), in the spirit of [vagonweb.cz](https://www.vagonweb.cz/razeni/index.php?rok=2026) — but focused on Austria, for all operators, and linked into our live views.

### 8.1 Scope

- "Running in Austria" = at least one stop at an Austrian station (`81xxxxx` IDs / inside AT). Includes foreign operators on Austrian tracks (DB ICE, ČD/MÁV Railjets, SBB/FS EC, partner Nightjets, ...).
- Operators: ÖBB, WESTbahn, CAT, GKB, StH (Steiermarkbahn), SLB, Zillertalbahn, NÖVOG, Montafonerbahn, Raaberbahn (GySEV), foreign operators as above.
- Categories: RJX, RJ, NJ, EN, ICE, EC, IC, D, WB, CJX, REX, R, S, plus heritage/special trains if in the data. Buses excluded.

### 8.2 What it shows

Per train, one row (dense, sortable, like vagonweb's lists):

| Field                       | Example                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| category + number           | `RJX 260`                                                                                                      |
| name                        | `»Transalpin«`                                                                                                 |
| operator                    | ÖBB                                                                                                            |
| route                       | Wien Hbf 07:30 → … → Zürich HB 15:20 (first/last stop, with times; key intermediate stops in a tooltip/expand) |
| Verkehrstage (running days) | `täglich`, `Mo–Fr`, `nicht 24.–26.12.`, plus a small calendar heat-strip over the year                         |
| validity                    | first/last running day in the timetable year                                                                   |
| links                       | our train run `/train/RJX-260?d=…` (live), vagonweb composition (later, §8.5)                                  |

Quick filters (one key/chip each): **all · long-distance** (RJX, RJ, NJ, EN, ICE, EC, IC, D, WB) **· regional** (CJX, REX, R) **· S-Bahn** (S) — regional and S-Bahn load the full file (§8.3) **· night trains** (NJ, EN). Further filters: operator, category, station ("all trains stopping at Linz Hbf"), "runs on date X / today", number range, name. Grouping like vagonweb: operator → category → number. Keyboard nav as everywhere else. Typing a train number (`260`, `rjx260`, `RJX 260`) or a train name (`transalpin`) in the global search jumps straight to the train.

URLs:

| Page                  | URL                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Index (all operators) | `/trains` (`?y=2026`, `?d=2026-11-13` = runs on that day)                                                               |
| Operator / category   | `/trains/oebb`, `/trains/oebb/rjx`                                                                                      |
| Trains at a station   | `/trains?at=8103000`                                                                                                    |
| Single train          | `/train/RJX-260` (existing train page, gains a "timetable year" tab: running days, route variants; vagonweb link later) |

### 8.3 Data pipeline

- **Source: static timetable open data**, not HAFAS crawling — Austria-wide GTFS / NeTEx Sollfahrplan from mobilitydata.gv.at (covers all operators) and/or data.oebb.at. Licence and whether train numbers (`trip_short_name`) and names are included — **to verify** in M0.
- Build script `packages/trains` (Node, CI only, same pattern as `packages/stations`):
  1. Load GTFS, keep rail trips with ≥ 1 Austrian stop
  2. Group by (operator, category, number) → one train; collect route variants (different stop patterns over the year) and service days (`calendar` + `calendar_dates` → bitset over the timetable year)
  3. Map GTFS stop IDs → HAFAS IDs via `stations.json` (§4)
  4. Train names: from GTFS if present; otherwise enrich long-distance trains (a few hundred) via one HAFAS `JourneyMatch`/`JourneyDetails` each, cached and throttled
  5. Derive human-readable running days (`Mo–Fr`, `nicht 24.12.`) from the bitset
- Output, **committed** like `stations.json`, as **two files** per timetable year (decided), one train per line, sorted by category + number → readable diffs, fields kept to the summary (no full stop lists):
  - `packages/trains/trains-2026.json` — **default**: without regional trains — no R, REX, CJX, S — i.e. long-distance + night only (RJX, RJ, NJ, EN, ICE, EC, IC, D, WB, …; a few hundred to ~2k trains, tens of KB compressed)
  - `packages/trains/trains-2026.full.json` — **full**: all trains (~10–15k → roughly 1–2 MB raw, a few hundred KB compressed)
  - `trains-2026.json` is a strict subset of `trains-2026.full.json`, generated from it in the same build step; a CI check verifies this.
  ```json
  {
    "op": "oebb",
    "cat": "RJX",
    "nr": 260,
    "name": "Transalpin",
    "from": ["8103000", "07:30"],
    "to": ["8503000", "15:20"],
    "via": ["8100013", "8101001", "8100108"],
    "days": "<base64 bitset>",
    "text": "täglich"
  }
  ```
  (Illustrative.) Running days are a 365/366-bit set → ~62 chars base64 per train.
- The full stop list for a train comes **live** from HAFAS (`JourneyMatch` by number + date → `JourneyDetails`) when the train page opens — no need to ship it statically.
- Weekly CI job opens a PR on changes (like stations). At the timetable change in December, new `trains-<year>.json` + `trains-<year>.full.json` are added; the previous year is kept for a while (`?y=2025`), since the new timetable is usually published weeks before it starts.
- Both files are lazy, content-hashed chunks, loaded only on `/trains*` pages and for train-number search; filtering/search runs in the same Web Worker as the station search.
- **`trains-<year>.json` loads by default.** `trains-<year>.full.json` is loaded on demand: when the regional/S-Bahn quick filter is picked, a regional category or `?all` is in the URL, a station filter is set, or a train-number search misses in the default file. Once the full file is loaded, it replaces the default one for the rest of the session (the service worker caches both).

### 8.4 Later extensions

- Composition ("Wagenreihung"): whether ÖBB exposes planned/actual composition via HAFAS or another endpoint — **to verify**; if so, show it on the train page. Otherwise link to vagonweb (§8.5).
- Diff between timetable years ("what changed in Fahrplan 2027": new/removed trains, new names, changed routes).
- Train-number ranges reference (ÖBB numbering scheme by category/region).

### 8.5 Link to vagonweb (later — decided: not part of M5)

vagonweb.cz is the reference for train compositions (Řazení vlaků); we **link to it, never scrape it** (it returns 403 to automated clients, and the composition data is their community's work).

- Single train: `https://www.vagonweb.cz/razeni/vlak.php?zeme=<op>&kategorie=<cat>&cislo=<nr>&nazev=&rok=<year>&lang=de`
- Operator/category list: `https://www.vagonweb.cz/razeni/razeni.php?zeme=<op>&kategorie=<cat>&rok=<year>&lang=de`
- `rok` = timetable year (vagonweb's 2026 = 14.12.2025 – 12.12.2026, same as ours).
- Operator codes (`zeme`) seen on vagonweb for Austria: `ÖBB`, `WSTBA` (WESTbahn, category `WEST`), `CAT`, `SLB`, `StB`, `ZB`, `NÖVOG`, `ÖGEG`, `A-` (other operators); foreign ones e.g. `ČD`, `DB`, `MÁV`, `SBB`. Their ÖBB categories: RJX, RJ, ICE, EC, NJ, EN, IC, D, IR, CJX, REX, R, SB (= S-Bahn), ASTB.
- Keep a small mapping table `vagonwebOperator(op)` / `vagonwebCategory(cat)` (e.g. our `S` → `SB`, our `WB` → `WEST`) with unit tests. The `cislo` form was only seen for non-Austrian trains (vagonweb also uses `?id=` internally) — **verify by hand** in a browser that it resolves for ÖBB trains; if not, fall back to linking the operator/category list.
- Before building it: verify by hand that `cislo` links resolve for ÖBB trains.
- Link shown on: train page, each row in the train index, journey legs (small "Wagenreihung ↗" link).

---

## 9. Milestones

- **M0 – Spike (1–2 days):** script calling `LocMatch`, `TripSearch`, `StationBoard`, `JourneyDetails`; record fixtures; confirm current `ver`/client values work.
- **M1 – Skeleton:** Vite/Vue SPA, theme, layout, `/` search, Podman/Quadlet container (Caddy) with `/api/mgate` proxy, live on zugx.legner.me, client-side request cache, station board page, **raw JSON view** toggle (request + response, from day 1 — doubles as debug tool).
- **M2 – Station index:** build script + client worker search + PWA caching.
- **M3 – Journeys:** search form, results table + **timeline strips**, earlier/later paging, permalinks via `ctxRecon`.
- **M4 – Detail, realtime & map:** Zuglauf, remarks/HIM, auto-refresh, **map + live radar** (`JourneyGeoPos`).
- **M5 – Train index:** GTFS → `trains-<year>.json` + `trains-<year>.full.json` build + weekly PR, `/trains` pages, train-number search.
- **Later (after M5, no fixed slot):** vagonweb links (§8.5).
- **M6 – Bildfahrplan** for corridors (Westbahn, Südbahn first), keyboard command palette (`Ctrl+K`), compare connections.
- **M7 – Netzgrafik:** GTFS → NGE JSON export, then own renderer.

---

## 10. Risks

- Unofficial API: blocking / AID changes → adapter layer, caching, monitoring job that pings key methods daily.
- Legal/ToS of scraping HAFAS → keep traffic low, consider contacting ÖBB (opendata@oebb.at); prefer open data where possible.
- Station ID mismatch between GTFS and HAFAS → mapping table, verified by `LocMatch`.
- Train numbers/names missing or inconsistent in GTFS → HAFAS enrichment, manual overrides file.
- Realtime data only via HAFAS: confirmed, there is no open GTFS-RT/SIRI feed for Austrian rail (2026-11); SIRI4AT may change that from late 2027.

---

## 11. Decisions

- Station index: **rail only, Austria** (≈1–2k stations; LocMatch fallback for everything else), built from **open data GTFS/NeTEx, mapped to HAFAS IDs** via `LocMatch`
- Stack: **Vue 3 SPA**, no app backend — only a **Caddy** reverse proxy to the ÖBB API
- Name: **zugx**, hosted at **zugx.legner.me**
- Hosting: **own server, Podman** (Quadlet systemd service), host Caddy for TLS
- Station cache: **committed `stations.json`**, refreshed by a weekly CI PR
- First geek features: **timeline strips, Bildfahrplan, map + live radar, raw API JSON view** (all four)
- UI language: **en + de + it**, i18n from day 1
- Images: **GitHub Actions → GHCR**, `podman auto-update` on the server
- Licence: **AGPL-3.0**
- vagonweb links: **later**, not part of the first train index (M5)
- Netzgrafik: **export to NGE JSON first** (option A), own renderer later
- Layout: **responsive, desktop-dense**
- Prices: **ignored** (at most a link to the ÖBB ticket shop)
- Delay history/statistics: **out of scope for now**, idea kept for later — ÖBB's weekly "Zugfahrten" CSV (planned + actual times) could feed it without a sampling service
- Tooling: **full Vite+ (latest) + pnpm (latest)**, no separate ESLint/Prettier/Husky/Turbo
- Train index: **all trains** incl. regional/S-Bahn, with quick filters (long-distance / regional / S-Bahn / night); source **open data GTFS/NeTEx**, HAFAS only to enrich names

## 12. Open questions

None right now — all answered (see §11). Verified since: the ÖBB GTFS is CC BY 4.0 and has train numbers (`trip_short_name`) but no train names (those come from HAFAS, §13). Dropped: Souin/proxy caching of POST bodies (the client caches requests itself). Still **to verify**: whether ÖBB exposes composition data (§8.4).

---

## 13. Implementation status & findings (2026-11-13)

All milestones M0–M7 are implemented on `master` and deployed to zugx.legner.me (image `ghcr.io/simon04/zugx`, Quadlet, Cloudflare Tunnel; see `deploy/`). `vp check`, unit tests (hafas, gtfs, stations, trains, netz, web), `vue-tsc` and 52 Playwright e2e tests (26 tests × desktop + mobile, API mocked from fixtures, against the production build) pass and run in GitHub CI. Since then: Node 26 (LTS), Temporal API for all date/time logic (polyfill only for browsers without it), VueUse, a self-written i18n module instead of vue-i18n, imprint and privacy policy (§15).

Findings from the API and data, and deviations from the plan:

- **mgate:** `ver 1.67` + `vs_webapp` client works for all methods. Reconstruction takes `outReconL: [{ ctx }]` (from `con.recon.ctx`), not `ctxRecon`. HAFAS rejects any `Host` other than exactly `fahrplan.oebb.at` (Caddy sets it explicitly and drops `X-Forwarded-*`). TripSearch takes ~3–5 s.
- **Product classes:** `cls 2` is rail replacement (SEV/Bsv), **not** night trains — NJ/EN come as `cls 8` and are detected by category. Boards default to rail classes only (the Wien Hbf meta-station otherwise lists trams/buses).
- **Train names** (e.g. »Transalpin«) are not in the GTFS; HAFAS has them as a remark with code `ZN` in `JourneyMatch` (cached in `packages/trains/data/names-<year>.json`).
- **Open data:** the ÖBB GTFS (CC BY 4.0) is freely downloadable and has train numbers in `trip_short_name`, but covers only ÖBB-PV, CAT and Montafonerbahn; the Austria-wide GTFS on mobilitydata.gv.at needs registration and a licence agreement, so it is not used (builds accept `GTFS_ZIP=` to merge more feeds later). It is the December snapshot, so mid-year changes are missing, and foreign termini are cut at ÖBB's part of the run.
- **Data built:** 1016 stations (1142/1146 GTFS stations mapped to HAFAS ids), train index 715 default / 7938 full trains (16 KB / 113 KB gzip), Netzgrafik 44 nodes / 63 lines (+ NGE export, not yet test-imported into NGE), 68 Bildfahrplan corridors (all ÖBB Fahrplanbilder, plus the original Westbahn, Südbahn, Koralmbahn, Brenner).
- **Station search** runs on the main thread (2–5 ms for 1k stations), no Web Worker needed. Extra package `packages/gtfs` holds shared GTFS/CSV/zip/HAFAS-throttling code.
- **Type checking:** tsgolint (TypeScript 7) can't read `.vue` files, so the web app additionally runs `vue-tsc` (pinned to TypeScript 6 in `apps/web`, since TS 7 has no JS API yet) via `vp run -r typecheck`.
- **Running-days bitsets** are MSB-first per byte (like HAFAS `sDaysB`).

## 14. Later: custom station plans from OpenRailwayMap vector tiles

Station pages show a minimap with OSM Carto raster tiles (zoom 17–19: station building, platforms with numbers, entrances, lifts). A custom, calmer rendering would be nicer:

- **OpenRailwayMap-vector** (github.com/hiddewie/OpenRailwayMap-vector, live at openrailwaymap.app) has exactly the needed vector layers: `standard_railway_platforms`, `standard_railway_platform_edges`, `standard_station_entrances`, `standard_railway_stop_positions`, `standard_railway_grouped_station_areas`, `railway_line_high` (tracks), switches, signals. Its style is at `https://openrailwaymap.app/style.json` (TileJSON sources such as `/standard_railway_platforms,standard_railway_platform_edges`).
- **Blocker:** the tile endpoints answer `403 Forbidden` to other sites (referer-restricted). Do **not** work around that.
- **Options:**
  1. Ask the maintainer (issue on hiddewie/OpenRailwayMap-vector) whether zugx.legner.me may use the tiles.
  2. Self-host for Austria: the project is open source (osm2pgsql + PostGIS + Martin tile server); an Austria extract is small enough for a container next to zugx, plus a weekly OSM update.
- Overpass (live queries for platforms/entrances) was considered and rejected: too slow and unreliable.

## 15. modern-web-guidance pass (2026-11-13)

Working through https://github.com/GoogleChrome/modern-web-guidance (clone in `modern-web-guidance/`, local only, never commit). One commit per guide; done so far: dark-mode(-toggle)/browser-ui-theming, dialog (+ light dismiss, no scroll under modal), sortable-table, accessibility + respect-os-text-scale, ime-safe-enter-submit, deprioritize-background-fetches, defer-rendering-heavy-content, same-document-transitions, install-web-app (+ smaller SW precache), security/trusted-types headers, typography/scrollbar-color, forms (`<search>`, type=search, enterkeyhint), copy-button, state-aware-sticky-headers + scrollability-affordance-hints.

Still to do:

- ~~Flaky e2e test~~ fixed: a stale async `close` event closed a quickly reopened `<dialog>`.
- Also done: navbar (popover menu when the links don't fit), break-up-long-tasks (train index filter), color/contrast (badges ≥ 4.5:1). `legacy-scan` now reports 0 findings.
- Checked, deliberately not changed: responsive-table (tables already fit on phones by hiding secondary columns; a scroll wrapper would break the page-level sticky headers), visually-stable-font-fallbacks (no web fonts are loaded).
- Also done later: interest-triggered-tooltips (`ToggleTip`), scroll-target-on-load (`/j/…#n`).
- Second sweep over the whole catalogue (2026-11-14):
  - coordinate-global-events: times are always Europe/Vienna (`viennaDate`/`viennaMinutes`), not the browser's zone. Fixed the Bildfahrplan start hour and now-line, "today" in the train index and palette, and the timeline ticks. Since then all date/time logic uses Temporal: native where available, else `temporal-polyfill` 1.0.8 as a separate chunk loaded before the app (19.5 kB gzip, only for browsers without Temporal, e.g. Safari). Node 26 (LTS) has Temporal natively, so build scripts and tests need no polyfill.
  - viewport-aware-dropdowns: toggletip uses CSS anchor positioning where supported, with the JS placement as fallback.
  - privacy: the access log masks client IPs (Caddy `ip_mask`, /24 and /48).
  - animate-to-from-top-layer: short fade/scale for dialogs and popovers.
  - adapt-scrollbar-to-contrast-preferences: `prefers-contrast: more` scrollbar; `-webkit-scrollbar` only as an `@supports` fallback.
  - Checked, already fine: platform-controls-dismiss-dialog / declarative-dialog-popover-control (native modal `<dialog closedby=any>`), accessible-error-announcement (no validated forms), restrict-outbound-connections / secure-external-subresources / sanitize-untrusted-html (strict CSP connect-src, no third-party scripts, no `v-html`), text layout (`text-wrap` balance/pretty), copy-button status, single-line-overflow (only the corridor category hint, full data in the SVG title).
  - Not applicable: passkeys/auth, autofill, payments, built-in AI, WebMCP, web components, carousels, analytics/A-B testing, speculation rules (SPA), detect-initial-visibility-state (no metrics).
  - Design choice: page transitions stay a crossfade (no directional slides).
- Container queries for the board + station-map layout: not needed.

### Adopt VueUse — done

- `useLocalStorage` (store via `toReactive`, delay palette, ORM toggle, radar mode, station-map state; same storage formats, now synced across tabs), `usePreferredDark` (theme), `useIntervalFn` + `useDocumentVisibility` (`lib/refresh.ts` `useAutoRefresh`: board/radar/train/journey refresh, paused while hidden, catches up when visible again), `useEventListener` (`lib/keys.ts`, toggletip), `useResizeObserver` (App nav, TimelineStrips, MapView), `useClipboard` (copy link), `useDebounceFn` (station lookup, train index query, radar moves, Bildfahrplan wheel).
- Kept native: one-shot `getCurrentPosition` for "near me" (`useGeolocation` watches continuously), `matchMedia` one-off reads.
- Bundle: index chunk 143.15 → 152.35 kB (52.84 → 56.23 kB gzip). All e2e tests green.

### Vue lint pass (eslint-plugin-vue "recommended") — done

- Oxlint 1.93 ports 46 eslint-plugin-vue rules, all script-level. The recommended-set ones plus type-based `defineProps`/`defineEmits`, `prefer-import-from-vue` and `require-typed-ref` are enabled as errors in `vite.config.ts`. Findings: MapView `center`/`zoom` needed explicit defaults.
- Template rules can't run: Oxlint only parses the `<script>` blocks of SFCs, and JS plugins can't use `vue-eslint-parser`. A separate ESLint setup is out of scope (§6.1).
- Manual template review against essential / strongly-recommended / recommended: `require-v-for-key`, `no-use-v-if-with-v-for`, `no-v-html`, `no-mutating-props` (readonly props, vue-tsc), `require-explicit-emits`, `attribute-hyphenation`, `v-bind`/`v-on`/`v-slot` shorthand, `this-in-template`, `no-template-shadow`, `no-unused-vars`/`no-unused-components` (one-off `vue-tsc --noUnusedLocals`), `attributes-order` (one fix in the Bildfahrplan svg). Formatting rules are left to Oxfmt.
- Deliberately not followed: `multi-word-component-names`. Route pages (`Home`, `Radar`, `Train`, `Netz`, …) and small components (`Platform`, `Status`) keep their single-word names; there's no clash with HTML elements.
- Index-as-key on static lists (not a recommended rule) is fine.

### Replace vue-i18n with a small self-written module — done

- `src/i18n/index.ts` (~90 lines): reactive `locale`, `t(key, params)` with `{name}` interpolation and English fallback, `tm()`, `$t` plugin, `useI18n()` with the same shape, `setLocale` / `hafasLang` unchanged.
- Keys are type-checked against the English messages (`MessageKey`); dynamic keys are typed too (`PRODUCT_GROUPS` ids, nav entries). Unit tests: de/it have exactly the keys (and array lengths) of en, interpolation, locale switching.
- The vue-i18n chunk (57 kB, 18.9 kB gzip) is gone; the remaining i18n chunk is the three message files (6.4 kB gzip).

## 16. Open items (2026-11-14)

Optional features, roughly by value/effort:

1. **vagonweb links** (§8.5) — first verify by hand that `cislo` links resolve for ÖBB trains.
2. **Train index extensions** (§8.4) — composition data (if ÖBB exposes it), timetable-year diff, train-number ranges.
3. **Netzgrafik** (§7) — the NGE export imports fine into the Netzgrafik-Editor (2026-11-14, 3rd-party import path). zugx links to the editor with the network in `#netzgrafik=<deflate-raw, base64url>`; the import of that fragment is proposed upstream (branch `feat/import-from-url` in the local netzgrafik-editor-frontend clone, PR not opened yet). Still open: option C (colour by today's punctuality).
4. **Custom station plans** (§14) — blocked by the OpenRailwayMap vector tile 403: ask the maintainer or self-host for Austria.
5. **Delay statistics** — out of scope for now; idea kept (ÖBB's weekly "Zugfahrten" CSV, §3.5, §11).
6. **CI without feed downloads** — **done (2026-11-15)**: option (b), `route:export` writes `packages/route/data[/<country>]/trips-<year>.toml` (one stop / train pattern per line; AT 12,678 patterns, 6.1 MB; SI 884, 0.4 MB), refreshed by the weekly data PR; `route:build` reads only those, CI downloads nothing. Same journeys as before (68/68 in a sample). Original note: the image build downloads the raw GTFS of every country on each push (ÖBB ~170 MB, IJPP ~45 MB) only for `route:build`: the timetable search (minotor, per-day `.bin`) needs every trip's full stop times, which the committed TOML doesn't hold. Wanted: CI builds only from what's committed. Options: (a) build the routing input from the committed full train index, if `trains-*.full.toml` holds (or is extended to hold) every stop with times — no new file; (b) commit a compact text routing input per country (rail trips only: stops, stop times, calendars; one trip per line, so diffs stay small) and let `route:build` read it instead of the SQLite; (c) commit the rail-only routing GTFS (`.cache/route-gtfs.zip`, ~2.4 MB) — binary, rewritten wholesale, least liked. Check (a) first.

To watch:

- **SIRI4AT** (06/2026 – 11/2027): may bring open realtime feeds for Austrian rail; until then realtime only via HAFAS.
- **Neighbours' GTFS** (DB, SBB) if cross-border trains matter.
- **TypeScript 7 for `apps/web`** once `vue-tsc` supports it (needs a JS API or a Go-based Vue language tool).

### Prebuilt data as TOML instead of JSON — done

- Goal: `packages/*/data` (stations, train index, train names, GTFS→HAFAS map, Netzgrafik models, Bildfahrplan corridors) as TOML. Build scripts write TOML; a small Vite plugin imports `*.toml` like JSON (parsed at build time, emitted as a JS module); one converter script turns the existing JSON into TOML once.
- **Stays JSON:** the Netzgrafik-Editor exports (`nge*.json`); they are the editor's import format (download button, `#netzgrafik=` link).
- **Nulls (decided): `null` ⇔ `""` everywhere.** TOML has no null (spec v1.0.0: values are string, integer, float, boolean, date/time, array, inline table; "Unspecified values are invalid"). Inventory of the data (without NGE exports): no empty strings at all; nulls only in corridor `pts` (arrival/departure, ~85k, in arrays), the Netzgrafik models (`edges[].lines[]` minutes/travel, `stops[].arr/dep`, `takt`, `symmetry`, `knots.type`, ~2k, in tables) and 4 unmatched stations in `gtfs-hafas-map`. So the writer stores every null as `""` (keys stay explicit, arrays may mix types since TOML 1.0) and **throws on a real empty string**; the readers (Vite plugin, Node helper for scripts/tests) map every `""` back to null. Types, consumers and schema checks stay unchanged. Rejected: `-1` in arrays (field-specific, `symmetry` can be negative), omitting table keys (null → undefined, ~11 checks and types to change, "no value" invisible in the file).
- Done: `packages/toml` (`toToml`/`fromToml`/`readToml`/`writeToml`, Vite plugin `@zugx/toml/vite`), all build scripts write TOML, tests and the web app read it; converted once with `node scripts/json-to-toml.ts` (verifies the round-trip of every file). 76 files, 14.8 → 15.8 MB (+6 %), still one record per line; rebuilt data is byte-identical to the converted files. Root arrays need a key: `stations.toml` is `stations = [...]`.

### Adopt the Netzgrafik-Editor's terminology — done

Source: netzgrafik-editor-frontend (`src/assets/i18n/{de,en}.json`, `documentation/*.md`, `business.data.structures.ts`). Goal: the same concepts carry the same names in zugx (UI, code, data) as in the tool experts use, so the NGE export becomes a 1:1 mapping and users recognise the terms.

| Concept                   | NGE (de / en / code)                                                        | zugx today                                                     | Proposal                                                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| network view              | Netzgrafik / Netzgrafik                                                     | Netzgrafik                                                     | keep                                                                                                                                                          |
| time–distance diagram     | Streckengrafik / graphic timetable, space-time chart / `streckengrafik`     | Bildfahrplan (de and en), code `corridor`, `bf`                | de: keep **Bildfahrplan** (ÖBB term, "Fahrplanbild"); en: **Graphic timetable**; code keeps `corridor` (NGE: "a corridor is required for the Streckengrafik") |
| line of the ITF           | Zuglauf / trainrun / `Trainrun`                                             | Linie, `NetzLine`, `model.lines`                               | **trainrun**: `Trainrun`, `model.trainruns`; UI de "Zuglauf", en "Trainrun" in the Netzgrafik                                                                 |
| line between two nodes    | Abschnitt / trainrun section / `TrainrunSection`                            | `EdgeLine` (per line), `NetzEdge` (node pair)                  | `EdgeLine` → **`TrainrunSection`**; `NetzEdge` stays (NGE has no node-pair aggregate) with `sections`                                                         |
| ends of a section         | source / target (`sourceNodeId`, `targetNodeId`)                            | `a` / `b`                                                      | **`source` / `target`**                                                                                                                                       |
| times on a section        | `sourceDeparture`, `targetArrival`, `targetDeparture`, `sourceArrival`      | `aDep`, `bArr`, `bDep`, `aArr`                                 | NGE names                                                                                                                                                     |
| travel time               | Fahrzeit / travel time / `travelTime`, `backwardTravelTime`                 | `travel`, `travelBack`                                         | NGE names                                                                                                                                                     |
| interval                  | Takt / frequency / `frequencyId`                                            | Takt / "Interval" (en), `takt`, type `Takt`                    | de: keep Takt; en: **Frequency**; code `frequency`, type `Frequency`                                                                                          |
| category                  | Kategorie / category / `trainrunCategory`                                   | `cat`, `cats`                                                  | `category`, `categories` (data keys too)                                                                                                                      |
| stop without halt         | Durchfahrt / transition, non-stop / `isNonStopTransit`                      | `pass`                                                         | **`nonStop`**                                                                                                                                                 |
| node                      | Knoten / node / `Node`                                                      | node                                                           | keep                                                                                                                                                          |
| node short / long name    | Betriebspunkt / operational point / `betriebspunktName`, `fullName`         | `code`, `name`                                                 | **`betriebspunktName` / `fullName`**; UI label "Betriebspunkt" / "Operational point"                                                                          |
| node times (Knotenzeiten) | — (NGE shows minutes at ports)                                              | `knots` (wrong word: knot ≠ Knoten), `type: voll/halb/viertel` | **`nodeTimes`**, `type: "full" \| "half" \| "quarter"`; UI de Vollknoten/Halbknoten/Viertelknoten                                                             |
| symmetry                  | Symmetrie / symmetry, "Symmetrie gebrochen"                                 | symmetry                                                       | keep; flag "broken symmetry" like NGE                                                                                                                         |
| dwell time                | Haltezeit / stop time                                                       | — (implicit arr/dep)                                           | if shown: "Haltezeit" / "Stop time"                                                                                                                           |
| stop list of one trainrun | Perlenkette / Perlenkette                                                   | train page: Zuglauf (`TripStops`); Netzgrafik line panel       | Netzgrafik line panel: **Perlenkette** (same view concept); train page stays "Zuglauf" (a real train, not an ITF trainrun)                                    |
| time category             | Zeitkategorie: verkehrt uneingeschränkt / zur Hauptverkehrszeit / zeitweise | `takt: null` → exported as "zeitweise"                         | keep mapping; show "zeitweise" in the UI for lines without Takt                                                                                               |
| transfer time             | Umsteigezeit / transfer time                                                | Umstieg / transfer                                             | keep                                                                                                                                                          |
| running days              | Verkehrsperiode / traffic period                                            | Verkehrstage / running days                                    | keep (ÖBB/DB term); mention "Verkehrsperiode" in the docs                                                                                                     |

Done: UI labels (en Graphic timetable, Frequency, Trainrun/Perlenkette panel, Operational point, Voll-/Halbknoten translated, "zeitweise" for lines without Takt); `packages/netz` model renamed with the TypeScript language service (symbol-aware) + data keys + Netz page + README. The NGE exports came out byte-identical. Not renamed: real-train concepts (Zuglauf, train, Verbindung), `corridor`, build options (`--cats`).

### WESTbahn & other operators: data.mobilitaetsverbuende.at (assessed 2026-11-14, not integrated)

Gap: the ÖBB GTFS covers only ÖBB-PV, CAT and Montafonerbahn, so WESTbahn, GKB, StH etc. are missing in the Bildfahrplan, Netzgrafik and train index (live HAFAS pages are complete).

Source: Datenbereitstellungsplattform of Mobilitätsverbünde Österreich OG, https://data.mobilitaetsverbuende.at (dataset list is public: `GET /api/public/v1/data-sets?tagFilterModeInclusive=true`).

- **#66 "Fahrplandaten Eisenbahn (GTFS) – aktuell"**: ÖBB-PV, Raaberbahn/GySEV, Montafonerbahn, **WESTbahn**, ÖGEG; continuously updated, current timetable year + 60 days back.
- **#70 "Fahrplandaten Eisenbahn (GTFS) – Stichtagsdaten Fahrplanwechsel"**: same plus CAT and NÖVOG, whole timetable year at the timetable change (superset of the ÖBB feed). Only version: 2026 (`GTFS_Steig_2026_obb.zip`, 268 MB); no 2027, no archive.
- Regional datasets (VOR, VVT, …) explicitly exclude ÖBB and WESTbahn.
- Access: registration + manual licence acceptance; scripted download via OpenID Connect (Keycloak, client `dbp-public-ui`, password grant) with the registered credentials (CI secrets).

Licence: all 50 datasets use the "Datenlizenz Mobilitätsverbünde Österreich" (`Lizenzvereinbarung_DBP_v1.1`, text only visible after login) plus the Nutzungsbedingungen (https://mobilitaetsverbuende.atlassian.net/wiki/spaces/DBP/pages/85524481/Nutzungsbedingungen). It is a German adaptation of CC BY 4.0 with additions:

| Section             | Rule                                                                                                                                                                                                                    | Impact on zugx                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 2(a)(1), 4          | reproduce, redistribute, create and share derived material, extract the whole database; royalty-free                                                                                                                    | ✓ derived data in the repo and on the site                           |
| 2(a)(5)             | no ticket sales based on the data                                                                                                                                                                                       | irrelevant                                                           |
| 2(a)(7)             | no impression of endorsement by the licensor                                                                                                                                                                            | wording of the attribution                                           |
| 3(a)(1)             | attribution: creator ("Datenquelle: Mobilitätsverbünde Österreich OG – data.mobilitaetsverbuende.at"), copyright notice, licence notice + link, **disclaimer notice**, URL, **mark modifications**                      | footer, `source` in data files, notice in `packages/*/data`          |
| 3(a)(3)             | remove attribution on request                                                                                                                                                                                           | –                                                                    |
| 3(a)(4)             | licensees must **pass the licence obligations on** to recipients of derived material                                                                                                                                    | data files need their own licence notice (AGPL covers only the code) |
| 5(c)                | licensee **indemnifies** the licensor against third-party claims                                                                                                                                                        | liability risk for a private project                                 |
| **6(a)**            | licence covers the data **only for its validity period**; afterwards only statistics/research/science                                                                                                                   | data must disappear when its timetable year ends                     |
| **7(d)**            | using data after its validity "in öffentlich zugänglichen Routenplanern oder Auskunftssystemen" is a gross violation; **€20,000 contractual penalty per violation** (wording also ties it to commercial use; ambiguous) | expired years must not stay online                                   |
| 8(d,e)              | Austrian law; court at the licensor's seat (Handelsgericht Wien)                                                                                                                                                        | –                                                                    |
| 9(c)                | consent only in writing                                                                                                                                                                                                 | ask in writing                                                       |
| Nutzungsbedingungen | licensor may list/link apps; asks to be informed at services@mobilitaetsverbuende.at; no use for criminal, discriminatory etc. purposes                                                                                 | fine                                                                 |

Consequences:

1. **Current timetable year: OK in principle**, if 3(a) is fully met (source, licence link, disclaimer, "modified", pass-through notice).
2. **Not for previous years** (`netz-years`): exactly what 7(d) names. Past years keep coming from ÖBB's own feeds (CC BY 4.0, no expiry; e.g. the 2024 file from the Mobility Database archive `mdb-2138` is ÖBB's).
3. **Git history**: committed derived data stays downloadable after expiry, arguably continued distribution. Safer: build-only overlay (download in CI with the credentials, publish only on the site, replace yearly; never commit), or written permission covering an open-source repo with history.
4. **Risk**: indemnification + penalties under Austrian law vs. a hobby project; plain CC BY data (ÖBB) has none of that.
5. ÖBB data (CC BY 4.0) and this data can be combined in derived files; both attributions, and the stricter terms apply to the combined files.

Recommendation / next steps: ask services@mobilitaetsverbuende.at in writing first (zugx = open-source, non-commercial; git history; WESTbahn/GKB only). If granted: build-only overlay for WESTbahn & co. in the current year, full attribution set, removal at year end. Alternatives meanwhile: a UI note "ohne WESTbahn, GKB u. a. (nicht in den ÖBB-Open-Data)"; WESTbahn runs from HAFAS for the reference days. Not legal advice.

### Bildfahrplan: realistic train paths instead of straight lines (partly done: passing times by speed limit)

Feedback: "statt der linearen Interpolation zwischen Halten eine realistischere Darstellung — vielleicht die VzG-Daten der OpenRailwayMap anzapfen und daraus eine realistischere Trasse rechnen lassen?"

Today: straight lines between timetable times; passing points (trains running through without stopping) are interpolated linearly by track distance. Real trains accelerate after a stop, run at the line's speed limit, brake before the next stop, so their paths are curved at stops and steeper/flatter by section.

**Data**

- The VzG (Verzeichnis der örtlich zulässigen Geschwindigkeiten) is DB's; ÖBB's equivalent (speeds in La/Buchfahrplan) is not open.
- OpenRailwayMap's "max speed" layer shows OSM tags: `railway=rail` ways with `maxspeed` (+ `maxspeed:forward/backward`, `railway:preferred_direction`). Good on Austrian main lines, patchy on branch lines.
- Access: not Overpass (too slow/unreliable, rejected earlier), not ORM tiles (403). Instead the Geofabrik Austria extract (~700 MB PBF) in the weekly build, filtered with osmium (`railway=rail` + speed tags → a few MB). _Done as an experiment (no osmium, pure Node): `packages/vzg`, see "VzG-Grafik" below — speed profiles per line and track are now in `packages/vzg/data/*.toml`._
- **Licence: ODbL.** Rendered diagrams are a "produced work" (attribution "© OpenStreetMap contributors" suffices); a committed derived database (speed profiles per corridor) is ODbL share-alike → keep it in its own files with ODbL notice, or derive at build time only.

**Method**

1. _Step 1 — no new data_: per section between two stops a trapezoidal speed profile (accelerate a, cruise, brake b) fitted to the timetable time: from distance d and time T solve d = v·T − v²/2·(1/a + 1/b) for the cruise speed v (triangular profile if it has no solution). Category parameters (e.g. RJX/RJ a = 0.4, b = 0.5 m/s², v_max 230/200 km/h; REX/CJX 0.6/0.6, 160; S/R 0.8/0.8, 140/120). Passing points get no acceleration/braking. Computed client-side from the existing (km, time) points, so no data growth; drawn as sampled polylines (only for visible trains).
2. _Step 2 — speed limits from OSM_: map-match each GTFS shape (or each corridor) to OSM ways (nearest way within ~20 m, direction-consistent) → limit profile v_lim(s) along the track; per section the minimum running time with v ≤ min(v_lim, v_max(category)) via forward (acceleration) and backward (braking) integration — the classic Fahrzeitrechnung; then stretch to the timetable time (running time reserve spread by lowering the cruise speeds uniformly). Store per corridor one compact limit profile (km → v_lim), the client does the rest (same as step 1, with limits).
3. Passing times: once profiles exist, also use them for the interpolated passing points (instead of linear by distance).

**Validation**: compare with ÖBB's Fahrplanbild PDFs (they show Fahrschaulinien), with HAFAS passing times where available (JourneyDetails sometimes lists non-stop points), and with radar positions (`JourneyGeoPos` is itself calculated by HAFAS).

**Effort / risks**: step 1 small (one module + tests + rendering). Step 2 several days: OSM pipeline in CI, map-matching at junctions/stations, gaps in `maxspeed` (fallback: category v_max), ODbL handling, build time.

**Status (2026-11-15)**

Done:

- Data: speed limits per line and track from OSM via `packages/vzg` (Geofabrik extract, pure Node, no osmium); ODbL attribution in footer and docs.
- Linking: Bildfahrplan stations ↔ VzG station points by position (≤ 400 m), at build time (`speedLookup` in `packages/vzg/src/speed.ts`).
- Simplified step 3: passing times (stations passed without stopping) split per stretch by the average permitted speed, capped at the category's top speed (`VMAX` in `packages/netz/src/build.ts`), instead of evenly by distance (`passingPoints` in `packages/netz/src/corridors.ts`); e.g. corridor 110 Wienerwald up to 2 min later.

Open:

1. Step 1 (acceleration/braking at stops): no trapezoid profile, no category parameters (a, b); trains are drawn as straight segments between their points (`Bildfahrplan.vue`). Visually the biggest gain.
2. Step 2 (running-time calculation): no continuous limit profile per corridor (km → v_lim), only an average speed per station-to-station stretch; no minimum running time + stretching to the timetable time; hence no curved paths between stations.
3. Linking gaps: stretches whose stations are not found on one VzG line (or lie on different line numbers) use the average of the known ones — corridor 110: 4 of 22 stretches (e.g. Neulengbach, Wien Westbf).
4. Live overlay: between reported times still straight (planned + delay), no speed weighting.
5. Validation: not compared yet with ÖBB Fahrplanbild PDFs or HAFAS passing times.
6. Refresh: OSM extract and VzG build are manual; the weekly CI job only rebuilds the GTFS data.

Next: step 1 client-side (curves at stops), then step 2 on the existing VzG data (limit profile per corridor at build time, Fahrzeitrechnung in the client).

### VzG-Grafik: speed profile per line and track from OSM (experiments 2026-11-14, view planned)

Goal: a new view "VzG-Grafik" modelled on ÖBB's VzG pages (Strecke 10101 / REGELGLEIS / Richtung 2), for every Streckennummer and every Regelgleis: km axis, operating points and signals, speed changes with their km, a speed diagram, remarks. Data from OSM, unless better open data turns up. Also the source for the realistic Bildfahrplan paths (step 2 above).

**What the ÖBB VzG page shows** (columns 1–9): 1 km · 2 operating points/signals (symbols) · 3 braking distance (1000/1200 m) · 4/5 decisive gradients ‰ (+10, +9 …) · 6 km of the speed changes · 7 speed diagram (×10 km/h; solid line and dash-dot line = two speed bands, e.g. normal and tilting/higher brake class) · 8 km · 9 remarks.

**What OSM has (Geofabrik Austria 2026-11-13, `.cache/austria-261113.osm.pbf`, 760 MB)**

- 315 `route=tracks` relations with ÖBB line numbers (`ref` = "101 01", 181 of the pattern `ddd dd`), plus `ref` on the ways.
- `maxspeed` on nearly all main-line track ways; `maxspeed:forward/backward` where it differs by direction.
- `railway:track_ref` = ÖBB section track numbers (e.g. "e21"/"e22"; last digit 1/2 = Regelgleis of direction 1/2) → the two tracks of a double-track line can be told apart.
- `railway:position` (km) on ~9,000 nodes along the paths (signals, stops, milestones, switches) → chainage.
- 50,000 railway nodes: signals with `railway:signal:*` types and refs (e.g. "Ae22/r"), stop positions, switches, level crossings; 1,700 named stations/halts (usually beside the track).
- **Not in OSM**: braking distance (col. 3), gradients (col. 4/5), the second speed band (col. 7 dash-dot), remarks (col. 9), validity dates. Gradients could come from a DEM (basemap.at DGM 10 m, CC BY 4.0; or Copernicus GLO-30), but tunnels/bridges make a terrain model wrong exactly where it matters; the braking distance is per line section and only in ÖBB's documents.

**Pipeline (`packages/vzg`, pure Node, no osmium/GDAL)**

1. `scripts/extract.ts` (24 s): reads the PBF with an own minimal reader (`src/pbf.ts`, mapbox `pbf` + zlib) → `.cache/osm-rail.json` (35 MB, not committed): all `railway=rail` ways except yard/siding/spur and industrial/military/test usage (31,455), the route=tracks relations, coordinates (216,000), railway nodes, stations.
2. `scripts/build.ts` (6 s): `src/lines.ts` → `data/<ref>.toml` per line + `data/index.toml` (2 MB TOML; ODbL, `data/LICENSE.md`).
   - one global track graph; per line and direction the cheapest path between the line's km extremes (Dijkstra): own direction's section tracks ×0.5, other direction ×4, connectors without ref ×2, other lines ×6 → one continuous Regelgleis through the stations (single track: "1").
   - km extremes: the largest connected component, then the largest run of positions without jumps (> 20 km, or much farther apart than their km difference).
   - chainage: OSM positions on the path → longest monotonic, plausible subsequence (outliers of other lines dropped) → linear interpolation, slope 1 beyond.
   - speeds per edge relative to increasing km, equal sections merged: `[kmFrom, kmTo, v increasing, v decreasing]`.
   - curves: heading change over ±100 m on a 25 m resample → sections with radius < 3,000 m (median, 10 m).
   - points: stations/halts/stops/signals/switches/level crossings on the path, stations beside it within 250 m; `measured` if the km is OSM's own.
3. `scripts/explore*.ts`, `scripts/diagnose.ts`: the experiments (tag statistics, line coverage, detours).

**Result**: 156 of 181 lines built (37 double-track), 3,050 km of track paths, speed coverage ≈ 100 % (except 105 11, 181 01, 408 11), 19,500 points (9,200 with measured km), 4,800 curve sections.

**Validation** against the ÖBB VzG page 101 01 Regelgleis Richtung 2 (2013): speed changes at km 30.558 / 30.963 / 32.863 / 34.629 (VzG: 30.550 / 30.960 / 32.866 / 34.630) with 85 / 95 / 90 / 95 km/h — identical. Curve radii 280–290 m in the 65 km/h section near Eichgraben are plausible.

**Known gaps**

- missing (25): mostly tiny connector refs; real ones: 116 11, 132 01, 139 01, 162 01, 166 01, 170 01 (few or inconsistent km positions / mixed track refs).
- partial: 101 05 Arlbergbahn (path 26 km for km 49.6–135.9), 102 01 (32 of 81 km), 206 02 (63 of 150), 107 01 (only km 43.8–72.3), 118 01 (1.9–48.4); detours 122 12, 130 01. Causes: gaps in the graph (missing connectors/excluded service ways), km positions of other lines on shared ways, km resets at line borders.
- fix options: path via the relation's own member order; stitching components; manual overrides in a small TOML (`data/overrides.toml`: per line via-nodes or km corrections); fixing OSM itself (positions, track refs).

**View — first version done (2026-11-14)**: nav entry "VzG-Grafik" → `/vzg` (index by Streckennummer like the Bildfahrplan index: filter by number — "10101" finds "101 01" —, name or station; sortable) and `/vzg/101-01?t=2&z=100&rev=1&all=1` (track, scale px/km, swap direction, all signals). Vertical km axis in the direction of travel (Regelgleis 1 → increasing km, 2 → decreasing); columns km · stations/signals · km of the speed changes · speed diagram (solid = direction of travel, dash-dot = opposite direction where different) · curve radii · km. Named OSM stop positions without a station node count as halts (e.g. Maria Anzbach). Line cut = VzG/Streckenlisten (ÖBB), not the historic lines; names/ends from the OSM `route=tracks` relations — official names could come from the Wikipedia list of ÖBB lines by VzG later.

**View concept (to discuss)**

- route `/vzg/:ref` (e.g. `/vzg/101-01`) + index `/vzg` listing lines (search by number, name, Kursbuch number); links from the Bildfahrplan sheet and the station menu.
- SVG, vertical km axis like the original (or horizontal for wide screens): columns km · points (symbols per kind/signal type) · speed changes · speed diagram (step line per direction; both tracks side by side or a toggle) · curves (optional column, replacing braking distance) · km.
- zoom/scroll along km; hover → OSM way/node link; "© OpenStreetMap contributors" visible.
- Kursbuch strecke (e.g. 100 Wien–Salzburg) → several Streckennummern (101 01, 101 02, …): mapping table Kursbuch ↔ lines (from the corridors' stations: stations per line in the TOML ↔ corridor stations).

**Questions (for Simon)**

1. Granularity: one view per Streckennummer (like the VzG) or per Kursbuchstrecke (stitching several lines, km resets at the borders)?
2. Orientation: vertical km axis like the original, or horizontal (fits the Bildfahrplan)?
3. Both directions: two columns (Richtung 1 / Richtung 2) side by side, or one track at a time with a toggle?
4. Column 3/4/5 (braking distance, gradients): leave out, or try gradients from a DEM (basemap.at, CC BY) with tunnels/bridges interpolated?
5. Curve radii instead of braking distance in column 3 — useful or noise?
6. Which signals to show: all (1,000 on the Südbahn), or only main/distant/speed signals?
7. Data refresh: weekly CI job (Geofabrik download 760 MB → extract → build → commit TOML), or manual like now? The committed TOML is ODbL — OK to keep it in this repo (with `data/LICENSE.md`), or a separate data repo?
8. Gaps: fix in OSM (upstream, benefits everyone) vs. local overrides TOML — which first?
9. Scope of lines: only ÖBB (ref pattern ddd dd), or also private lines (GKB, Montafonerbahn, Zillertalbahn, narrow gauge)?
10. Feed the speed profiles into the Bildfahrplan now (step 2 of the realistic paths), or first ship the VzG-Grafik view?

### VzG chart / line map: ideas from the Wikipedia route diagram (Streckenband, BS icons)

Reference: the Arlbergbahn's route diagram on Wikipedia (Innsbruck – Landeck): a schematic vertical strip of BS icons with km, names, details and elevation per row. What it shows that our VzG chart lacks, and where the data would come from:

- **Track layout as a schematic strip**: single/double track (the line splits into two where it becomes double track), stations as filled circles, halts smaller, closed stations faint, sidings/connections (Anschlussstelle "Awanst", Überleitstelle "Üst", Abzweig) as small branches. OSM: `tracks` on the ways (already extracted), `railway=station|halt|service_station|crossover|junction` + `railway:ref`, sidings/industrial spurs (`service=spur`, `usage=industrial` — excluded today, would be needed as stubs only).
- **Junctions with the connecting lines named and directed**: "Mittenwaldbahn nach Garmisch-Partenkirchen", "Brennerbahn nach Verona", "von Kufstein" — our connections plus the far end of the other line.
- **Tunnels with length and portals**, **bridges with length and height** ("Trisannabrücke (L 207 m / H 87,4 m)", "Zammer Tunnel (2335 m), Ostportal … Westportal"). OSM `tunnel`/`bridge` + names (`tunnel:name`, `bridge:name`), length from the geometry, height from OSM `height` (rare) or a DEM (terrain below the deck).
- **Road crossings**: motorways crossing the line with their numbers ("A12 E60 Inntal Autobahn"). OSM `highway=motorway|trunk` ways intersecting the line (bridge or tunnel over/under), `ref`/`int_ref`.
- **Elevation per station** ("582 m ü. A.", a column on the right; highest point). OSM `ele` on station nodes (partly), else a DEM (basemap.at DGM) at the station position — also enables a **gradient column** (VzG columns 4/5) as a by-product.
- **History in the rows**: former names ("vorm. Wilten", "bis 2005: Landeck", "1944: Imst"), opening/closing dates ("Unterperfuss bis 29. September 1968", "Oberhofen im Inntal ab 12. Dezember 2004"), realignments ("Beginn/Ende Linienverlegung", old alignment drawn faint), old tunnels ("alter Moltertobeltunnel, bis 22. April 1914"). OSM `old_name`, `start_date`/`end_date`, `railway=abandoned|disused` (not extracted), Wikidata for names over time.
- **Chainage errors ("Fehlerprofil")**: km jumps where the kilometrage was not renumbered after a realignment ("Fehlerprofil (−85 m)"). Our chainage fit already sees these as steps between consecutive OSM `railway:position` values — show them as rows instead of smoothing them away.
- **Links**: station and structure names link to their articles; OSM `wikipedia`/`wikidata` on stations, bridges and tunnels.
- **Layout**: km with 3 decimals left, the strip, names in the middle (main stations large), remarks after the name, elevation right — a compact, scrollable list that works on phones better than our wide chart.

**Status (2026-11-15)**: first version of the Streckenband mode done (stations by class, bridges ≥ 20 m and tunnels with length, connecting lines, elevation where OSM has `ele`; SVG download; snapshot test with 174 01). Open from the list above: river/road names at bridges (OSM rail bridges rarely carry a name — needs the crossed waterway/road from OSM), elevation from a DEM where `ele` is missing, double/single track in the strip, sidings/Üst/Abzw, history (former names, closing dates, realignments), chainage errors, motorway crossings, BS wikitext export.

**Possible outputs**

1. **"Streckenband" mode for the VzG view**: the schematic strip as an alternative to the speed chart (same data, plus tracks, structures, elevation, history), or as extra columns in the chart (structures, elevation/gradient).
2. **Line map**: named tunnels/bridges with lengths (see the reference-map ideas), stations by class, closed stations faint, realignments.
3. **Wikitext export** of a draft route diagram (`{{BS-table}}` / BS rows: icon codes, km, names, links) from the OSM data, for Wikipedia editors to start from — the BS icons are on Commons, so only the row codes need generating; the facts (km, names, lengths) are fine to reuse with an OSM attribution note.

### Line map (Streckenkarte): ideas from reference maps (collected 2026-11-15)

First version done (`/vzg/:line/map`): line in red with tunnels dashed, other lines grey, stations with non-overlapping labels linked to departure boards, connecting lines linked to their maps, optional km posts, colour by permitted speed (ColorBrewer RdYlBu), scale bar, north arrow, title/legend/sources inside, SVG download, print, snapshot test (Stubaitalbahn). Compared with five reference maps — a German-Wikipedia locator map ("Mittelbadische Eisenbahnen"), a modern editorial map ("Zackenbahn", Jelenia Góra – Harrachov), the SBB GA network map, a Wikipedia project map ("Brenner-Nordzulauf") and a Wikipedia line map ("Arlbergbahn") — ours lacks:

**Base map and orientation**

- **Water**: rivers and lakes in blue (the strongest orientation in most maps: Rhine, Lake Geneva). OSM `natural=water`, `waterway=river` (+ `canal`), riverbanks; simplify generously.
- **Land cover**: forest green, built-up areas grey, open land light (Wikipedia, Zackenbahn). OSM `landuse=forest`/`natural=wood`, `landuse=residential|industrial|…` — big polygons, need strong simplification / aggregation per zoom.
- **Terrain / relief shading**: soft hillshade (Zackenbahn subtle, SBB strong, Wikipedia very light). Needs a DEM: basemap.at DGM (CC BY 4.0) for Austria, Copernicus GLO-30 beyond; render a hillshade raster at build time per map extent (or as an embedded PNG layer in the SVG; Commons accepts mixed SVGs). Biggest effort.
- **Roads**: motorways and main roads as thin grey/white lines (Wikipedia). OSM `highway=motorway|trunk|primary`.
- **Borders and country names**: national borders (dashed white in Zackenbahn, grey in SBB), country names in large letter-spaced capitals ("POLEN", "TSCHECHIEN", "ÖSTERREICH"); neighbouring countries muted/masked (SBB). OSM `boundary=administrative`, admin_level 2 (+ 4 for federal states).
- **Place names separate from station names**: towns in large bold type, size by importance (city > town > village; SBB hierarchy), stations then only the suffix ("-Bahnhof", "-Marktplatz") where they share the town's name (Wikipedia). OSM `place=city|town|village` with `population`.
- **Landscape names**: mountain ranges and regions in italic, letter-spaced, following the terrain ("Riesengebirge", "Isergebirge"). OSM `natural=mountain_range` / `place=region` are sparse; maybe a small hand-made list per area.
- **Off-map destinations**: arrows with the next big station beyond the frame where a line leaves the map ("← Liberec", "Wrocław →", "↖ Görlitz"; SBB: "Milano | Malpensa | Venezia" at the edge). From the connecting lines and their far ends.

**Locator and layout**

- **Locator inset**: country silhouette (Austria with federal states) and a red rectangle for the map extent; in the Zackenbahn style a soft white panel in a corner. OSM admin boundaries, strongly simplified, built once.
- **Map fills the image**; title, legend and scale bar in a framed box (Wikipedia) or a soft panel inside the map, not above/below. Title as a pill label next to the line ("Zackenbahn", Zackenbahn style).
- **Segmented scale bar** (alternating black/white) and a stated scale ("1:1 Mio.", SBB).
- **Line name on the map** in the line colour, in a rounded halo/pill, placed along a straight stretch.

**Line styling and content**

- **Line status categories** in the legend: in use, former line (dotted), regauged / other gauge (other colour), each with its station symbol (Wikipedia). OSM `railway=disused|abandoned|razed` (not extracted yet), `gauge`.
- **Station symbols in the line colour** (white fill, coloured ring) instead of black; bigger rings for main stations.
- **Hierarchy for the other lines**: connecting main lines dark and thick (Zackenbahn: black, almost as strong as the line itself), minor lines lighter/thinner; only lines relevant to the map, not every track.
- **Fewer, better labels**: only the important stations on overview maps (Zackenbahn labels 7 stations), all stations on detailed maps; label size by importance.
- **Typography**: one clean sans (Inter-like) in two weights; place names letter-spaced capitals; italic for landscape; generous halos.
- **Rounded, smooth line rendering** (round joins, slight smoothing of the simplified geometry).

**From "Brenner-Nordzulauf" (project map, Wikipedia)**

- **Project status by colour**: in planning / approval in progress / under construction / in operation, each with its own colour; the existing line dark grey; upgraded line ("Ausbaustrecke") as a two-colour dashed line. OSM `railway=construction|proposed` (+ `construction=*`, `opening_date`, `start_date`) — not extracted yet; would also cover the Koralmbahn-style new lines before they open.
- **Opening years** next to sections and tunnels in italic ("Inntaltunnel 1994", "Brenner-Basistunnel 2032"). OSM `start_date` / `opening_date` on ways or relations.
- **Tunnel names along the tunnels**, italic, in the line/status colour ("Terfnertunnel", "Münstarertunnel"); tunnels dotted. OSM `tunnel:name` / `name` on tunnel ways (extract keeps `name`; add `tunnel:name`).
- **Motorways** as light yellow/beige lines underneath (the classic road colour, subtle).
- **State borders** in violet/pink with **state names** in letter-spaced violet capitals ("BAYERN", "TIROL") — for lines near borders the federal states / neighbouring states matter more than the country outline.
- **Legend box over the map** with the title in large bold, all line categories, "Stationen (Auswahl)", "Stand: 2023" and the year notation ("_2012_ Inbetriebnahmedatum").
- **Station hierarchy**: large ring + bold label for main stations (Rosenheim, Innsbruck), small ring for others, very small labels for minor places; selected stations only.
- **Segmented scale bar** bottom right.

**From "Arlbergbahn" (Wikipedia line map, Bludenz – Innsbruck)**

- **Station classes** with their own symbol and label style in the legend: Bahnhof (large ring, bold), Haltepunkt (small ring), Betriebsbahnhof (grey label, operating point without passengers), aufgelassener Haltepunkt (grey italic with the closing date, "Unterperfuss 29.09.1968 aufgelassen"). OSM `railway=station|halt|service_station|…`, disused stations via `disused:railway=*` / `railway=…` + `disused=yes` and `end_date`.
- **Bridges** (> 100 m) with a tick symbol and their names ("Trisannabrücke", "Inn-Brücke", "Schmiedtobelbrücke"); **tunnels** (> 1000 m) dotted and named ("Arlbergtunnel", "Wolfsgrubentunnel") — length thresholds keep it readable. OSM `bridge=yes` + `bridge:name`/`name`, `tunnel:name`; lengths from the geometry.
- **Annotations**: highest point with elevation ("1310 m ü. M. – höchster Punkt der Arlbergbahn"), renamed stations ("bis 2005: Landeck"), notes ("werden nur bei Großereignissen genutzt"). Elevation from OSM `ele` on stations or a DEM; former names from `old_name` / Wikidata; notes hand-curated (small TOML per line).
- **Leader lines** from labels to their station where the line is dense (Innsbruck Westbahnhof, Flaurling, Hatting) instead of dropping the label.
- **Label size by class**: main stations large and bold (Bludenz, Landeck-Zams, Innsbruck Hbf), others medium, minor small.
- **Panorama format**: a wide frame for an east–west line (aspect up to ~3:1) — ours caps at 16:9; allow wider for elongated lines (and taller for north–south ones).
- **Legend panel + locator side by side** in the bottom-right corner: title, symbols; Austria with federal states, the capital marked, red rectangle for the extent.
- **Base map details**: mountain peaks as small triangles, road numbers (B171), forest, the OSM-Carto look (lighter).
- **Connecting lines in the line colour but thin** (red, at Bludenz and Innsbruck) — "same railway family", distinguished by width.

**Network maps (SBB style) — later, a different view**

- Whole network or region map: all lines by mode (rail red, bus yellow, cable car black, ship) and by status/tariff (solid / dashed / dotted), dense labels with hierarchy, lakes, relief, neighbouring countries muted, multilingual title and legend, "Stand" date, info panels. Would build on the same layers (water, relief, borders, places) plus all VzG lines; GTFS for bus/other modes.

**Data and effort**

- All vector layers (water, land cover, roads, borders, places) come from the Geofabrik extract already used — a second extract step (`scripts/extract-base.ts`) writing simplified, clipped layers per zoom class (e.g. `data/base-*.toml` or one compact binary/JSON per region); licence ODbL like the rest.
- Relief needs a DEM (basemap.at CC BY 4.0 → attribution in the footer) and a raster step (hillshade per map extent at build time or a pre-rendered Austria hillshade PNG cropped per map).
- Suggested order: 1) water + places + borders (incl. federal states), 2) locator inset + legend box inside the map + segmented scale bar, 3) station classes/symbols/hierarchy (incl. leader lines), line hierarchy, line name label, named tunnels and bridges with length thresholds, off-map arrows, wider/taller frames for elongated lines, 4) land cover + motorways, 5) relief, 6) former lines/closed stations with dates, lines under construction/planned with opening years (project maps), annotations (highest point, renamings, notes), 7) SBB-style network map.

### Interfaces to expert tools (idea, 2026-11-15)

Overview of the planning tools used in the DACH region (FBS, TPS, Viriato, RailSys, OpenTrack, LUKS, ProVI, PlanPro, railML …): [docs/expert-tools.md](docs/expert-tools.md). Idea: a **railML export** of the VzG data (lines, km, speeds, signals, structures) and of Bildfahrplan sheets, so planners can load zugx data into FBS/TPS/Viriato/RailSys; validation of the OSM-derived data against the official VzG/Streckenlisten.

### Feature ideas (collected 2026-11-15)

Ordered by what they need; numbers for reference.

**Existing data only (static, cheap)**

1. **Network map by attribute**: all of Austria, lines coloured by permitted speed, electrification, ETCS/PZB, track count, gauge or operator. _Done_ (`/vzg/netz`, with national and federal-state borders and a region switch `?region=AT-n`); open: track count wrong where a line path runs over another line's ways, water and places as on the line map.
2. **Traffic density**: trains per day per section from the GTFS, as line width/colour on the network map ("Verkehrsstärke"). _Done_ (network map mode "Züge/Tag", `packages/netz/data/density.toml`); open: other days/day types, per category (long-distance/regional/S-Bahn), lines of other operators (not in the ÖBB GTFS).
3. **Line profile per Streckennummer**: length, double-track share, top and average speed, tunnels/bridges, electrification, train protection, trains per day, stations, connecting lines — one overview combining VzG, GTFS and the map. _Done_ (box "Streckenprofil" on the VzG page); open: double-track share where line paths borrow other lines' ways (see 1), gradients/elevation profile from a DEM, comparison between lines (sortable index columns).
4. **Isochrones**: how far one gets from a station in 1/2/3 h, from the GTFS, for a chosen departure time.
5. **Timetable-change comparison**: 2027 vs 2026 per corridor/train (new, dropped, faster/slower trains); the 2027 GTFS is available.
6. **Batch export for Wikipedia**: maps, Streckenband and VzG charts for all ~200 lines at once, plus BS wikitext for route diagrams.
7. **Open dataset**: the derived VzG data (lines, km, speeds, signals, structures, geometry) as a documented download (ODbL), later as railML.

**With live data (HAFAS)**

8. **Connections at a station**: arrivals × departures matrix with transfer times and live delays.
9. **Live delay map**: radar aggregated per line/section.
10. **Disruptions on the map**: HIM messages assigned to lines/sections, also in the Bildfahrplan and VzG view.

**Needs storage over time (small backend or scheduled CI job)**

11. **Punctuality statistics** per train, line, station, time of day — the most valuable for passengers, the first that needs storage.
12. **Planned vs. actual running times** per section (where trains lose time; ties in with the VzG speeds).
13. **Watching a train**: push notification on delay or platform change (PWA).

Also see the planned items above: line map layers (water, places, locator), Streckenband details, Bildfahrplan acceleration/braking, vagonweb, station plans, other operators (WESTbahn via mobilitaetsverbuende data), railML export.

### Bildfahrplan as a planning tool: shorter connections, reliable single-track lines, faster trains (planned 2026-11-15)

Goal from the passenger's side: shorter transfer times, more reliable trains on single-track lines, faster trains (no waiting for connections) — with the same number of trains. From the planner's side: the Bildfahrplan should not only show but evaluate. Data: planned times (GTFS, whole year), passing points, single/double track (`tracks`), VzG speed limits, live delays (HAFAS).

**Connections**

1. **Transfer view per station**: click a node → all arrival → departure pairs between trains of different lines with the transfer time; green < 10′, amber 10–20′, red missed/too short; best and waiting times at the major nodes.
2. **Taktknoten check**: do the trains meet around the full/half hour (Vollknoten / Halbknoten), symmetry minute per station (arrival + departure ≈ 60′ for opposite directions); flag nodes where a few minutes' shift would turn a long wait into a short transfer.
3. **Missed connections live**: with the live overlay, which transfers break today and the resulting arrival delay.

**Reliability on single-track lines** 4. **Crossings (Kreuzungen)**: where trains of opposite directions meet on single track, mark the crossing station; a meeting point inside a single-track stretch (between stations) is a conflict. 5. **Crossing as a delay chain**: buffer at each crossing (time between the first train's arrival and the second train's departure); a late train delays the opposite one by (delay − buffer). 6. **Punctuality on top of the plan**: where do trains lose time (per stretch, per hour) — from the live data; one day in the browser for a start, collected over days later (needs storage/a backend). 7. **Occupancy band per single-track stretch**: occupied minutes per hour (a simple capacity view, light version of UIC 406).

**Faster trains** 8. **Running-time reserve**: scheduled running time per stretch vs. the minimum at the permitted speed (VzG) → slack (padding or waiting for connections) vs. tight. 9. **Stop pattern check**: cost per stop (braking, dwell, accelerating) and the gain of an express variant. 10. **Following and overtaking**: fast trains behind slow ones, possible overtaking stations, lost time.

**Planning in the browser (later)** 11. Drag a path by ±n minutes, transfers/crossings update live; shareable link. 12. Scenario comparison (timetable year vs. variant). 13. Edited section → Netzgrafik-Editor (NGE JSON).

Order: 1 + 2, 4 + 5, 8, 6; then 3, 7, 9, 10; 11–13 later.

**Status (2026-11-15):** done — 1 + 2 (`?plan=knoten`), 4 + 5 (`?plan=kreuzung`), 8 (`?plan=reserve`, `minRun` in the corridor files), 6 (`?plan=puenktlichkeit`, collected in the browser). Limits: the node panel covers other lines via the station's HAFAS boards ("alle Linien"), the other panels only the sheet's trains; passing loops without passenger stops unknown (meetings there show as conflicts), minimum running time without dwell/gradients/rolling stock, punctuality only what one browser saw. Open: 3, 9, 10; a shared punctuality history (backend). 7 (occupancy) done as **Kapazität** (`?plan=kapazitaet`): blocking times per block section from the OSM main signals (Sperrzeitentreppe), occupancy per block (UIC 406 colours), conflicts; parallel lines (another line number, from the GTFS shapes) done; open: several tracks per direction within one line, station track occupation, speed profile within the block instead of even speed.

### Coupled train parts (Zugteile): radar and train panel (planned 2026-11-15)

Feedback: night trains and Railjets often consist of several commercial train parts, and the radar picks one of them at random (e.g. EN 40462 instead of NJ 466). Three cases:

- **Purely commercial numbers** (40xxx/50xxx/60xxx in night traffic): never run on their own; in each section they hang on another operational train (EN 40462 = EC 462 Budapest–Salzburg, then NJ 466 Salzburg–Zürich).
- **Trains that are operational on part of the run and joined elsewhere** (RJX 860 joined to RJX 60 Wien–Salzburg): which number is the operational one in the joined section is not visible in the published data.
- **Operational numbers that do not exist commercially** (EN 415 Salzburg–Zagreb = EN 40237 + EN 40465).

Findings from HAFAS (2026-11-15):

- JourneyGeoPos returns one movement per commercial part at the same position (RJX 61 + RJX 19981, RJX 60 + RJX 13470, ICE 1094 + ICE 2820), drawn on top of each other.
- JourneyDetails has `parJnySegL`: `[{ jid, fLocX, tLocX, type: "UNION" }]`, the joined trains with the section (indices into `common.locL`).
- The per-stop product (`dProdX` → `prodL[].prodCtx.matchId`) sometimes carries the operational number (EN 40237 from Schwarzach: matchId 415); not reliable alone (EN 40462 after Salzburg: still 462 instead of NJ 466).

Plan:

- **A. Radar**: movements at the same position with the same next stop merge into one marker; label "NJ 466 / EN 40462", most likely operational part first (numbers ≥ 40000 last, else lower number first).
- **B. Panel header**: one badge per part, the clicked one highlighted; each opens its own run; "Zuglauf öffnen" opens the highlighted one.
- **C. Box "Zugteile"** (radar panel and train page): per section the joined trains, linked; sections without an operational partner show the matchId ("betrieblich EN 415 lt. HAFAS").
- **D. Stop list**: a small note where the operational train changes ("ab hier NJ 466").

Limits: in a joined section the operational number is only a guess (lower number / non-commercial range).

**Status (2026-11-15):** A–D done (`groupMovements`, `partSections`, `operationalChanges` in `packages/hafas/src/coupled.ts`; box `TrainParts.vue`; fixtures EN 40462 / EN 40237). Open: HAFAS hints EN 415 only from Jesenice (Salzburg–Schwarzach has neither partner nor matchId); the radar header badges come from the merged markers only (not from `parts` when the train is selected by link).

### Category colours: distinguishability (2026-11-15)

Request (planner feedback): colours by offer level as common in Austrian timetable planning (FBS) — RJX ≠ RJ, REX green ≠ R, IR + CJX violet, private long-distance (WESTbahn, RegioJet) orange. Single source: `apps/web/src/lib/products.ts` (badges, radar, Bildfahrplan, Kursbuch, maps, Netzgrafik).

**Method** (`node scripts/color-distance.ts '<json>'`): every pair of colours, ΔE×100 in OKLab for normal vision and the minimum under protan/deutan simulation (Machado et al. 2009, severity 1). Targets: ΔE ≥ 15 normal (below: hard to tell apart even with full colour vision), ≥ 8 under CVD (6–8 only with a second cue such as a text label). Constraint: badges carry white text, so every badge colour needs ≥ 4.5:1 contrast with white (WCAG AA) — that keeps all colours dark and limits how far 12 categories can spread in lightness.

**First FBS palette** (the four requested changes on the old colours) — too close:

| Pair                    | ΔE normal | ΔE CVD |
| ----------------------- | --------- | ------ |
| ICE grey – R slate blue | 4.9       | 4.1    |
| EC/IC – D               | 6.0       | 2.3    |
| REX green – bus olive   | 6.6       | 1.4    |
| R – S                   | 6.8       | 6.1    |
| RJX – EC/IC             | 7.0       | 4.2    |
| RJ – EC/IC              | 7.0       | 7.0    |
| RJX – RJ                | 11.4      | 9.7    |
| NJ – IR/CJX             | 11.6      | 4.5    |
| IR/CJX – S              | 13.3      | 2.2    |

Root causes: four medium-dark reds (RJX, RJ, EC/IC, D); the white-text limit; red/green is the classic CVD pair.

**Adopted badge palette** (light; all ≥ 4.5:1 with white): RJX `#b8157a` (magenta), RJ `#d0102a` (red; swapped with RJX on planner feedback, current usage), EC/IC/D `#7d1a14` (brown-red, one colour), ICE `#4b4f55`, NJ/EN `#26296b`, IR/CJX `#8448b8`, REX `#2a7a2e`, R `#5a7590`, S `#1659c9`, private long-distance `#b35800`, rail replacement `#795548`, bus/other `#6b6b6b`. Remaining pairs below the targets:

| Pair                          | ΔE normal | ΔE CVD  | Note                                                |
| ----------------------------- | --------- | ------- | --------------------------------------------------- |
| R – bus, SEV – bus, ICE – SEV | 5.8–8.5   | 5.2–5.5 | buses are off by default in the radar; SEV is a bus |
| RJ – private                  | 11.5      | 1.9     | red vs orange: CVD-identical                        |
| RJX – RJ                      | 12.5      | 12.6    | both in the red family (was 11.4)                   |
| ICE – R                       | 13.2      | 12.8    | (was 4.9)                                           |
| IR/CJX – S                    | 14.3      | 2.8     | violet vs blue: CVD-close                           |
| R – S                         | 14.7      | 13.8    | (was 6.8)                                           |
| RJ – REX                      | 30.8      | 5.7     | red/green: inherent to the FBS convention           |

**Dark mode**: the badge colours are too dark as lines/text on the dark surface, so `lineColor`/`categoryColor` return lighter steps there (badges keep `lineBadgeColor`/`categoryBadgeColor`): RJX `#e862b6`, RJ `#ff4b5c`, EC/IC/D `#c4553c`, ICE `#d0d4d8`, NJ/EN `#aab0ff`, IR/CJX `#b07fea`, REX `#4fb052`, R `#7f9cc0`, S `#2f7ff0`, private `#f0902a`, SEV `#a58670`, bus `#7a7a7a` — all ≥ 3:1 against `#0b0d10`; closest pairs SEV – bus 8.1, then ≥ 11.7 (NJ – R, RJX – EC/IC, NJ – IR/CJX), RJX – RJ 12.6.

Open: CVD-safe separation of RJ/RJX/private and IR/S needs a second cue (e.g. dashed RJ paths in the Bildfahrplan, or a border on RJX badges); identity is never colour-alone today since badges and paths carry the category text.

### Navigation: flat, grouped menu with a global Live switch (done 2026-11-16)

`zugx  Suche● Radar● Störungen● │ Bahnhöfe Züge │ Bildfahrplan Netzgrafik │ Strecken Netzkarte │ Hilfe   [● Live] DE ☀`

- Why: many functions were hidden behind names that don't suggest them (sitemap and analysis: `docs/sitemap.md`). User feedback: power users want everything one click away, beginners need the everyday entries highlighted.
- Groups separated by thin lines, no group labels; live entries (● = always realtime) and Bahnhöfe/Züge bold; never collapsed on desktop, ☰ menu only on narrow screens.
- **Live switch** (`lib/live.ts`, key `e`, remembered, on by default; dot `●` with `--live`, pulsing when on): station page live board ⇄ departure plan, Bildfahrplan realtime overlay (`?live=1/0` in links overrides), station index links.
- Quick jump (⌘K) and raw JSON (`d`) moved to the footer; new shortcut `b` = Bahnhöfe.
- Open: a timetable-only train run (Live off on the train page), live variants for Netzgrafik/infrastructure (delays on the network map), mid-width collapse of the expert groups if the bar ever gets too long.

### Data pipeline: one SQLite as source of truth, TOML as exports (planned 2026-11-16)

Problem: every view has its own ad-hoc data structure and its own script that extracts something from the GTFS (stations, trains, departures, lines, corridors, Netzgrafik, density …), each re-reading the feed.

Plan: import all inputs into one local SQLite (`.cache/zugx.sqlite`, not committed); derive the views in SQL; small exporters write today's TOML files (committed, reviewable diffs). The app stays static and unchanged.

```
GTFS feeds ───────────┐
OSM extract ──────────┼─► .cache/zugx.sqlite ──► SQL views ──► exporters ──► packages/*/data/*.toml
UIC/HAFAS station map ┘
```

- **Import**: [node-gtfs](https://github.com/BlinkTagInc/node-gtfs) (MIT, npm dependency, version pinned) loads the GTFS into its standard tables (`agency`, `stops`, `routes`, `trips`, `stop_times`, `calendar`, `calendar_dates`); `shapes` only where needed (line assignment per train). OSM-derived data (VzG lines, signals, abbreviations) into own tables of the same database later.
- **Views in SQL**: departure plan = `stop_times ⋈ trips ⋈ routes` per station; train index, line per train (`route_short_name`), station index likewise. Only real computations stay TypeScript (passing times, block sections, OSM line matching).
- **Migration, one export at a time**: a new SQL export must produce byte-identical output to the old script before the old script is removed. Order: departures → lines → stations → trains → netz/corridors.
- **CI**: the data workflow builds the database first (`vp run db:build`), then the exports; better-sqlite3 needs a native build (fine on the runners).
- **Status (2026-11-16)**: all build tools read the SQLite, each verified byte-identical against the former zip reader: `lines` and `departures` (SQL queries), `stations` (rail station groups via SQL), `trains` (`gtfsFromDb`: the former in-memory structure built from SQLite, identical incl. order), `netz` (`recordSource`: tables as records in file order). Only `db:build` reads the zip — plus the GTFS shapes for netz (not imported yet). The data workflow (`.github/workflows/data.yml`) runs `db:build` first; the flow is documented in `docs/data-flow.md` (GTFS → SQLite → scripts → TOML).
- **Next steps**, each again verified byte-identical: (1) import `shapes` (needed by netz: passing points, track counts, density) and drop the zip reading from netz; (2) replace `gtfsFromDb` in `trains:build` by SQL views (train groups, running days, stop patterns); (3) replace `recordSource` in netz by SQL (trips of a day, stop times per trip); (4) remove the zip reader (`loadGtfs`, `openFeed`) once unused; (5) OSM data (VzG lines, signals, abbreviations) into the same database.
- Not in the browser: SQLite via HTTP range requests (sql.js-httpvfs) was considered and rejected — 40–80 MB even without shapes, ranges only uncompressed, many requests per query, no offline/PWA, binary not diffable.

### Several countries in one instance (idea 2026-11-16)

Goal: the same app for Italy, France … — ideally in one instance — by swapping the data.

- **Station key**: the UIC code (81… AT, 83… IT, 87… FR) — already the key today (HAFAS ids are UIC codes).
- **Per country**: GTFS feed(s) (into the same SQLite, with a feed/country column), OSM extract, the line numbering in OSM (AT: `route=tracks` relations with VzG numbers; FR: `ref:FR:SNCF_Reseau`; IT: RFI line codes), names of categories and colours.
- **Data and URLs**: exports under `data/<country>/…`; URLs with a country prefix (`/it/bf/…`) or the country taken from the station's UIC code.
- **Live data is the hard part**: ÖBB HAFAS covers Austria (neighbours partly). Each country needs an adapter behind one interface (boards, train runs, radar positions, disruptions): IT Viaggiatreno, FR SNCF API / SIRI. Independent of the SQLite pipeline, but the largest effort.
- Prerequisite: the SQLite pipeline above (one import per feed instead of country-specific scripts).
- **NeTEx**: official and anonymous for FR, IT (Trenitalia), CZ, NO, LU; behind registration in DE, AT, SE, DK, SI; none for ES, PT, IE, UK, the Baltics, GR, FI (rail). No usable npm NeTEx parser exists (only Entur's experimental TypeScript types); plan: own streaming importer (saxes) into the SQLite, starting with FR and IT.
- **Data sources per country** (static rail GTFS/NeTEx, licence, access; checked 2026-11-15): `docs/europe-rail-data.md`. Clean and anonymous: AT (ÖBB), LU, FI, NO, LV, IE, NL (OVapi), FR (official NeTEx + GTFS, ODbL), ES (Renfe GTFS, CC BY 4.0, no NeTEx), SI (CC BY-SA); key/registration: DE, SE, DK, HU, AT (MVO); restrictive or custom: CH, BE, UK (CIF only); IT: official Trenitalia/Italo NeTEx on the NAP (CCISS), licence not stated; own XML formats: CZ, RO; community-only: PL, BG and the Balkans, TR, UA, MD.

### First additional country: Slovenia (planned 2026-11-16)

**Data needed**

| Data                   | Source                                       | Note                                                                                                  |
| ---------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Timetable              | NAP nap.si, national GTFS (`b2b.gtfs`, IJPP) | CC BY-SA 4.0, anonymous, ~43 MB, updated daily; all modes → filter rail (`route_type` 2, SŽ agency)   |
| Station identity       | OSM (`uic_ref` 79xxxxx) + GTFS stops         | one station across countries (Jesenice, Maribor, Spielfeld-Straß …)                                   |
| Infrastructure (later) | OSM Slovenia extract                         | line chart, network map, signals; Slovenian line numbers in OSM to be checked                         |
| Live data              | none at first                                | ÖBB HAFAS covers only cross-border trains → Slovenia is "Live off" first (the Live switch handles it) |

Licence: CC BY-SA 4.0 is share-alike — everything derived from the Slovenian data (TOML exports) is published under CC BY-SA; attribution in footer and README.

**Updates**: `db:build` imports several feeds into the same SQLite with a country/feed column (node-gtfs prefix per feed); the existing exports run per country. **No automatic updates** (decided 2026-11-16): the Slovenian data is rebuilt by hand (`vp run db:build` + exports) when wanted, and committed like the ÖBB data. Timetable-search data (minotor) is built from both countries together, so cross-border journeys (Wien → Ljubljana) route automatically.

**Committed size (estimate)**: station index < 0.1 MB (~200 rail stations), train index ~0.3 MB (~400 trains/day), departure plans ~1–2 MB, Bildfahrplan sheets ~2–3 MB if built; routing data not committed. Layout `packages/*/data/si/…`, one item per line.

**Switching countries** (decided 2026-11-16): an explicit **country selector in the menu** (AT / SI …, remembered, also in links as `?land=si`). It sets the country for the overviews (Bildfahrplan sheets, network map, line index, station and train index) and the default for searches. Objects keep their own country: a station's country follows from its UIC code (79… SI, 81… AT), so a link to a Slovenian station or train works whatever the selector says; cross-border search spans both countries. Radar and disruptions stay ÖBB HAFAS.

**Decided (2026-11-16)**: GTFS (not NeTEx). OSM extract: `.cache/slovenia-261114.osm.pbf` (300 MB).

**Findings (2026-11-16)**:

- **Licence check (2026-11-15), changed**: the derp.si mirror (`ijpp_intl_gtfs.zip`) adds international trains scraped from ÖBB HAFAS (no licence) and OSM shapes; its plain variant renames routes from an unstated source. Now only DUJPP's official file `https://dujpp.si/gtfs/dujpp-ijpp.zip` (linked from the NAP dataset, CC BY-SA 4.0, anonymous). It has no train categories: trains are "SŽ <number>". Croatia (HŽPP: no licence, NAP lists "contractual arrangement, fee required"), Montenegro (ŽPCG website API, "all rights reserved") and Bulgaria (BDZ states no licence; only livetransport.eu claims CC BY) were built and then **dropped** for lack of a clear licence — ask the operators before adding them again (local branch `local/hr-me-bg-backup`, never pushed).
- The NAP download `https://b2b.nap.si/data/b2b.gtfs` answers **403** from here (Transitous fetches it from its servers — IP or client restriction?); the community mirror with the same IJPP feed works anonymously: `https://gitlab.com/api/v4/projects/derp-si%2Fgtfs-generators/packages/generic/IJPP/latest/ijpp_intl_gtfs.zip` (43.5 MB, rebuilt daily ~01:00). **Decided**: use the GitLab mirror (CC BY-SA 4.0), not the NAP URL.
- **Live data exists after all**: community GTFS-RT for the national feed — trip updates `https://rt.gtfs.derp.si/sources/ijpp/trip_updates` and service alerts `…/ijpp/service_alerts` (used by Transitous). A later step could feed the Live switch for Slovenia.
- Slovenian stations have UIC codes 79xxxxx, which ÖBB HAFAS also uses: the live board works for Slovenian stations with the trains HAFAS knows (mainly cross-border).
- Cross-border trains (Villach – Jesenice – Ljubljana, Graz – Maribor) appear in both feeds → dedupe by train number and day.

**Built (2026-11-15)** — see docs/data-flow.md for the commands:

- `packages/gtfs/countries.toml` + `COUNTRY=si` for every data script; per-country SQLite; SQL fix-up: train names from `route_short_name`.
- Stations: 266 (435/437 GTFS groups matched to HAFAS; diacritics restored from GTFS: Divača), 127 SŽ abbreviations from OSM `railway:ref`.
- Trains: 829 (70 long-distance/night), departure plans for 354 stations; trains with a bare number (some HŽ/SŽ) left out. No regional line names in the feed (route = train).
- VzG: 37 lines by SŽ number (`lineRef = '^\d{2}$'`); `osmLineMembers` keeps relation-listed sidings and tracks under renewal (Slovenian through-station tracks are often `service=siding`; for Austria this would break lines, so it's per country).
- Bildfahrplan: 15 sheets (`packages/netz/countries/si.toml`, ids `si-<line>`, to Villach and Spielfeld-Straß), reference day 2026-11-24 (the Primorska line was closed until 2026-04-05); no Netzgrafik (its nodes are Austrian).
- Timetable search: AT + SI merged (Slovenian ids prefixed `si:`); a train split at the border into two feed trips is one leg. CI builds both databases (raw feed downloads, see §16 "CI without feed downloads").
- App: country selector (`zugx:land`, `?land=si`), footer attribution per country.

Next: GTFS-RT (derp.si) for the Live switch in Slovenia; dedupe the cross-border trains in the train index; sheet numbers in the index file instead of from the id.

**Open decisions**: (1) scope of the first step — (a) station index, departure plan, train index, timetable search (recommended) or (b) also Bildfahrplan sheets (SŽ has no ÖBB-style sheets; corridors along OSM lines?); (2) GTFS (anonymous) or NeTEx (registration) — start with GTFS; (3) ~~update rhythm~~ — decided: no automatic updates; (4) ~~country switch~~ — decided: country selector in the menu.

### Spain (built 2026-11-19)

**Decided (2026-11-19)**: everything like Slovenia (stations, trains, departure plans, timetable search, VzG lines, Bildfahrplan sheets); both Renfe feeds from data.renfe.com (AV/LD/MD + Cercanías, CC BY 4.0, licence check in docs/europe-rail-data.md; not the NAP copies); routing merged with AT + SI (ids `es:`); Spanish UI. OSM extract: `.cache/spain-261117.osm.pbf` (1.5 GB).

**Findings**:

- AV/LD/MD feed: train numbers zero-padded in `trip_short_name`, Renfe's product as the route name (AVE, AVLO, AVANT, AVANT EXP, AVE Euromed, Intercity, Regional) → AVE, AVLO, AVANT, EM, IC, REG; no headsigns, no shapes; valid to 2027-09. Cercanías feed: fields padded with spaces, no train number field (block id = service id + number), route = line (C1, R2N, RG1, T1 Cádiz tram-train; BUS/ER24 are buses), shapes; only ~1 month ahead.
- HAFAS (ÖBB) names Renfe trains its own way (AVL, ARC = Arco/Alvia/Avant/Intercity, IR = Regional, EM, AVE) and knows **no Cercanías trains**; the train page finds Renfe trains by number + operator. HAFAS station ids are mostly `71` + ADIF code (Gualba 79105 → 7179105), major stations 7100xxx; **700 of 1477 stops aren't in HAFAS** (Majadahonda, Calafell, FEVE): they get ids "71" + ADIF code (`localStationPrefix`) if inside Spain's OSM boundary, are flagged `local` (station page → departure plan, no live board); the train page shows trains HAFAS doesn't know from the timetable (`trainRuns`, runs-<year>/<nn>.toml).
- OSM ways carry ADIF line numbers as `ref` ("050", "100"): 175 lines; few `route=tracks` relations. Line names partly in Catalan/Basque/Galician (`name`).
- Live: none for Spain (HAFAS knows only long-distance trains; Renfe has GTFS-RT — a later step).

**Built**: 1,450 stations (698 local), 8,304 trains (381 long-distance), 1,449 departure plans, runs of all trains (4.5 MB), 6,783 Cercanías lines, 175 lines, 8 sheets (es-050, -010, -030, -040, -042, -080 high-speed with `nonstop`, es-600 Mediterranean, es-200 C2).

Next: prefer `name:es` for line names; Renfe GTFS-RT for Live; shapes from the Cercanías zip (sheets/density show 0 shapes); more sheets (Cercanías Madrid/Barcelona, Galicia, North).

### Radar: look back in time, e.g. −180 min (planned 2026-11-25)

Wish: show the live map as it was up to 180 minutes ago.

**Finding (2026-11-25)**: `JourneyGeoPos` takes any date/time and answers for the past too. Vienna area, 300 trains: realtime delays for 122 now, 143 at −60 min, **6 at −180 min**. Past positions further back are mostly calculated from the timetable, not the realtime data.

Options, from least to most effort:

1. **Time slider, HAFAS directly** (no server): a −180 … 0 min slider on the radar, its time passed to `JourneyGeoPos`. Realtime good to about −60 min, then mostly timetable. First step.
2. **Reconstruct from the day's train runs** (no server): the radar for which trains were in view at that time, then each one's `JourneyDetails` (HAFAS keeps the day's actual times; the Bildfahrplan shows past realtime this way), position interpolated between its stops at the chosen time. Real delays for the whole day; one request per visible train (cache, limit to the view).
3. **Record snapshots on our own server**: a collector in the container polls the radar for Austria every 30–60 s into SQLite (24 h ring buffer: ~1,000 trains × 1 row/min ≈ 25 MB/day), served as `/api/radar-history?t=` (behind Cloudflare). Enables later punctuality statistics and replays.
4. **Supabase (Postgres + PostGIS)** instead of SQLite: hosted, PostGIS queries, live updates; but another external service and account, free projects pause after a week idle (500 MB), and the collector must still run somewhere. With our own server, option 3 is simpler.

**Licence**: options 3 and 4 store and republish data from the unofficial ÖBB HAFAS API, which goes beyond today's pass-through proxy; check first (licence-first): store at all, or only derived values (delays, not raw positions)?

**Decided**: option 1 now; 2 if realtime further back matters; 3 only for history beyond today or statistics.

## Sources

- public-transport-enabler `OebbProvider`: https://github.com/schildbach/public-transport-enabler/blob/master/src/de/schildbach/pte/OebbProvider.java
- KDE KPublicTransport ÖBB network config: https://autoconfig.kde.org/kpublictransport/networks/at_oebb-26.04.0.json
- hafas-client ÖBB profile: https://cdn.jsdelivr.net/npm/hafas-client@6.3.6/p/oebb/readme.md
- hafas-client readme: https://cdn.jsdelivr.net/npm/hafas-client@6.3.6/readme.md
- ÖBB Scotty mgate API notes (agent skill): https://tessl.io/registry/skills/github/mitsuhiko/agent-stuff/oebb-scotty
- ÖBB open data portal: https://data.oebb.at/
- Vite+ docs: https://viteplus.dev/guide (config: https://viteplus.dev/config/, CI: https://viteplus.dev/guide/ci)
- vagonweb.cz train compositions (index 2026): https://www.vagonweb.cz/razeni/index.php?rok=2026
- Austrian open transport data (national access point): https://mobilitydata.gv.at/ (realtime filter: https://mobilitydata.gv.at/daten?filter=122)
- ÖBB GTFS 2026: https://data.oebb.at/de/datensaetze~soll-fahrplan-gtfs~
- ÖBB NeTEx + Zugfahrten CSV: https://data.oebb.at/de/datensaetze~datenbereitstellung_delegierte_verordnung_eu_2024-490~
- SIRI4AT (FFG project, Austrian SIRI profile): https://projekte.ffg.at/projekt/cd1b483e-f36b-1410-8654-00d3c07d99bb
- npmx.dev repo: https://github.com/npmx-dev/npmx.dev
- Netzgrafik-Editor: https://github.com/OpenRailAssociation/netzgrafik-editor-frontend
- FOSDEM 2025 NGE talk: https://fosdem.org/schedule/event/fosdem-2025-5023-netzgrafik-editor-a-human-centric-timetable-planning-approach
