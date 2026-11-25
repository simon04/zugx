# zugx

Fast, mobile-friendly, information-dense timetable browser for trains in Austria, Germany, Slovenia and Spain (with keyboard shortcuts on desktop) — **https://zugx.legner.me**

- Station boards with realtime delays, platforms, cancellations
- Journey search with **timeline strips**, table view, earlier/later paging, compare, "what if I miss it?"
- Train runs (Zuglauf) with delay profile and map; friendly URLs like `/train/RJX-162?d=2026-11-13`
- **Live radar** of train positions
- **Train index** of every train running in the selected country in the timetable year (`/trains`)
- **Bildfahrplan** (time–distance diagrams) for every ÖBB Fahrplanbild, any day of the timetable year: live overlay, single/double track, Kursbuch-style timetable tables, a second-monitor mode, and **planning views** — Taktknoten and transfers (all lines at a station), crossings on single track, running-time reserve, punctuality
- **Netzgrafik** of the integrated interval timetable (+ export for SBB's Netzgrafik-Editor)
- **VzG-Grafik**: permitted speeds, stations, signals and curves per railway line (Streckennummer) and track, route strip, line profile, print-ready **line map** and **infrastructure network map** (speed, electrification, ETCS, track count, trains per day …, per federal state) (`/vzg`)
- Raw API JSON view (`d`), command palette (`Ctrl/⌘ K`), UI in English, German, Italian

See [docs/](docs/README.md) for how each feature works (data source, computation, display) and [PLAN.md](PLAN.md) for the design and decisions.

## Layout

```
apps/web            Vue 3 SPA (pages, components, viz)
packages/hafas      typed ÖBB HAFAS mgate client + normalizer (+ recorded fixtures)
packages/stations   station index build (ÖBB GTFS → HAFAS IDs) + committed stations.toml
packages/trains     train index build (ÖBB GTFS) + committed trains-<year>.toml / .full.toml
packages/gtfs       ÖBB GTFS download + parsing shared by the builds
packages/toml       prebuilt data as TOML: writer/reader (null ⇔ "") + Vite plugin to import *.toml
packages/netz       Netzgrafik / Bildfahrplan build (ÖBB GTFS, VzG speed limits) + committed data
packages/vzg        VzG-Grafik build (OpenStreetMap PBF) + committed data (ODbL)
e2e                 Playwright smoke tests (API mocked from fixtures)
deploy              Containerfile, Caddyfile, Quadlet unit, host Caddy snippet
```

## Development

Tooling is [Vite+](https://viteplus.dev) (`vp`) with pnpm.

```sh
pnpm install
vp run dev                  # SPA on :5173, /api/mgate proxied to ÖBB
vp check                    # format, lint, type check (+ vp run -r typecheck for .vue files)
vp run -r test              # unit tests
vp run --filter @zugx/e2e e2e
vp run stations:build       # rebuild station index (downloads ÖBB GTFS, queries HAFAS)
vp run trains:build         # rebuild train index
vp run netz:build           # rebuild Netzgrafik + corridors (+ VzG lines and passing times)
vp run vzg:extract          # OSM PBF in .cache/ (Geofabrik Austria) → .cache/osm-rail.json
vp run vzg:build            # → packages/vzg/data/*.toml
vp run vzg:boundaries       # borders of Austria and the federal states → data/boundaries.toml
vp run vzg:platforms        # platform edges with track numbers → data/platforms.toml (radar)
vp run hafas:record         # re-record API fixtures
vp run hafas:canary         # check the live API still works
```

## Deployment

One container (Caddy serving `dist/` + a strict `/api/mgate` reverse proxy to ÖBB). CI builds and pushes the public image `ghcr.io/simon04/zugx:latest` on every push to `master`. The container listens on host port **9849** ("zugx" on a T9 keypad). Static files are compressed at build time (`apps/web/precompress.ts`: `.zst` level 19 and `.gz` level 9 next to every text asset ≥ 1 KB, 27 MB → 3 MB) and served as such by `file_server { precompressed zstd gzip }`; on-the-fly `encode` only for the API proxy. Updates reach users without a manual reload: everything except the hashed `/assets/` is `no-cache`; the service worker checks for a new version on start, every 30 min and when the tab becomes visible, and applies it at the next in-app navigation (or right away in a background tab); a route chunk missing after a deploy triggers one full load of the new version (`apps/web/src/lib/update.ts`).

Linux, rootless Podman + Quadlet:

```sh
cp deploy/zugx.container ~/.config/containers/systemd/
systemctl --user daemon-reload
systemctl --user start zugx
systemctl --user enable --now podman-auto-update.timer   # pulls new images CI pushes
loginctl enable-linger                                   # keep running without a login session
curl -s localhost:9849 | head -3                         # smoke test
```

TLS: add `deploy/Caddyfile.host` to the host Caddy (`reverse_proxy 127.0.0.1:9849`) and reload it.

macOS (no Quadlet):

```sh
podman run -d --name zugx --restart=always -p 127.0.0.1:9849:8080 \
  --read-only --tmpfs /data --tmpfs /config ghcr.io/simon04/zugx:latest
```

Hardening (Containerfile + Quadlet): unprivileged user (65532), read-only root filesystem with small `noexec` tmpfs mounts, own user namespace (`UserNS=auto`), all capabilities dropped, `no-new-privileges`, memory (no swap)/CPU/PID/file limits, healthcheck on `/healthz` that kills (and so restarts) an unhealthy container, port bound to `127.0.0.1`; Caddy sends a strict CSP (no inline scripts, Trusted Types with a narrow default policy for the service worker and MapLibre) and `nosniff`/`Referrer-Policy`/`Permissions-Policy`/COOP/CORP/`X-Frame-Options` headers, the `/api/mgate` proxy only allows small `POST`s to the fixed ÖBB upstream.

Local image instead of GHCR: `podman build -t localhost/zugx -f deploy/Containerfile .`, then set `Image=localhost/zugx` and `AutoUpdate=local` in the unit.

## Data & licences

Code: AGPL-3.0-only. The data below keeps its own licence; the committed files under `packages/*/data/` are derived from it.

### Built into the app (committed, rebuilt by the scripts above)

| Data                                                                          | Source                                                                                                                                                                                                                                                                                              | Licence                                                                                                                                                                                                           | Fetched                                         | Files                                                                                         |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Planned timetable 2026 (stations, trains, Bildfahrplan, Netzgrafik)           | ÖBB open data, [Soll-Fahrplan GTFS](https://data.oebb.at/de/datensaetze~soll-fahrplan-gtfs~) (`GTFS_Fahrplan_2026.zip`, valid 2025-12-14 – 2026-12-12)                                                                                                                                              | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), attribution "ÖBB (data.oebb.at)"                                                                                                                       | 2026-11-13                                      | `packages/stations/data`, `packages/trains/data`, `packages/netz/data`, `packages/route/data` |
| Station ids (GTFS → HAFAS), train names                                       | ÖBB HAFAS (`fahrplan.oebb.at`, unofficial API: `LocMatch`, `JourneyMatch`)                                                                                                                                                                                                                          | no licence stated (facts; ids and names only)                                                                                                                                                                     | 2026-11-13 (train names: `checked` per entry)   | `packages/stations/data/gtfs-hafas-map.toml`, `packages/trains/data/names-2026.toml`          |
| Wikidata ids of the VzG lines (OSM relations' `wikidata` tag)                 | [Wikidata](https://www.wikidata.org/) via OpenStreetMap                                                                                                                                                                                                                                             | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                                                                                                                                     | 2026-11-14                                      | `packages/vzg/data` (`wikidata`)                                                              |
| VzG-Grafik: tracks, speed limits, km positions, signals, stations             | [OpenStreetMap](https://www.openstreetmap.org/) via the [Geofabrik](https://download.geofabrik.de/europe/austria.html) Austria extract (`austria-261113.osm.pbf`)                                                                                                                                   | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), © OpenStreetMap contributors (see `packages/vzg/data/LICENSE.md`)                                                                                     | OSM data as of 2026-11-13, extracted 2026-11-14 | `packages/vzg/data`; also used for the Bildfahrplan's passing times                           |
| Slovenia: planned timetable (stations, trains, departure plans, Bildfahrplan) | national timetable (IJPP) published by DUJPP on [NAP Slovenija](https://nap.si/en/datasets_details?id=6fc3966a-5e3f-cf10-1df3-70d3af14d03d) (`dujpp-ijpp.zip`, official file only)                                                                                                                  | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — share-alike: the derived files are CC BY-SA 4.0 too                                                                                             | 2026-11-15                                      | `packages/*/data/si` (`stations`, `trains`, `netz`)                                           |
| Slovenia: VzG lines, station abbreviations                                    | [OpenStreetMap](https://www.openstreetmap.org/) via the [Geofabrik](https://download.geofabrik.de/europe/slovenia.html) Slovenia extract (`slovenia-261114.osm.pbf`)                                                                                                                                | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), © OpenStreetMap contributors                                                                                                                          | 2026-11-15                                      | `packages/vzg/data/si`, `packages/stations/data/si/abbr.toml`                                 |
| Spain: planned timetable (stations, trains, departure plans, Bildfahrplan)    | Renfe Operadora on [data.renfe.com](https://data.renfe.com/dataset/horarios-de-alta-velocidad-larga-distancia-y-media-distancia): AV/LD/MD (`google_transit.zip`) and [Cercanías](https://data.renfe.com/dataset/horarios-cercanias) (`fomento_transit.zip`); not the NAP copies (stricter licence) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); Renfe's [conditions](https://data.renfe.com/legal): "Origen de los datos: Renfe Operadora" with the update date, no distortion, no implied endorsement | 2026-11-19                                      | `packages/*/data/es` (`stations`, `trains`, `netz`, `route`)                                  |
| Spain: VzG lines, station abbreviations                                       | [OpenStreetMap](https://www.openstreetmap.org/) via the [Geofabrik](https://download.geofabrik.de/europe/spain.html) Spain extract (`spain-261117.osm.pbf`)                                                                                                                                         | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), © OpenStreetMap contributors                                                                                                                          | 2026-11-17                                      | `packages/vzg/data/es`, `packages/stations/data/es/abbr.toml`                                 |
| Germany: planned timetable (stations, trains, departure plans, Bildfahrplan)  | DELFI e.V., [Deutschlandweite Sollfahrplandaten (GTFS)](https://www.opendata-oepnv.de/ht/de/organisation/delfi/startseite) on opendata-oepnv.de (`…_fahrplaene_gesamtdeutschland_gtfs.zip`, login needed to download); rail-only extract via `vp run gtfs:rail`                                     | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), attribution "DELFI e.V. (opendata-oepnv.de)"                                                                                                           | 2026-11-24                                      | `packages/*/data/de`                                                                          |
| API test fixtures                                                             | ÖBB HAFAS (recorded responses)                                                                                                                                                                                                                                                                      | no licence stated; test data only, not shipped                                                                                                                                                                    | 2026-11-13                                      | `packages/hafas/fixtures`                                                                     |

How each file is built (GTFS files, OSM keys/tags, HAFAS lookups → scripts → TOML): [docs/data-flow.md](docs/data-flow.md).

The build date and source are also stored in the files themselves (`source`, `created`, `day`, `begin`/`end`). Not covered by the ÖBB GTFS: WESTbahn, GKB, Raaberbahn and other operators (see PLAN.md for data.mobilitaetsverbuende.at).

### Loaded live by the browser

| Data                                                                  | Source                                                                                  | Licence / terms                                                                                                                              |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Realtime, routing, station boards, train runs, positions, disruptions | ÖBB HAFAS `fahrplan.oebb.at/bin/mgate.exe` via the same-origin proxy `/api/mgate`       | unofficial API, used politely (client cache, small request bodies, honest User-Agent); no licence stated                                     |
| Base map (radar, train run)                                           | [OpenFreeMap](https://openfreemap.org/) vector tiles (OpenMapTiles schema)              | data © OpenStreetMap contributors (ODbL), © OpenMapTiles; attribution shown on the map                                                       |
| Station map                                                           | [OpenStreetMap](https://www.openstreetmap.org/) raster tiles (`tile.openstreetmap.org`) | © OpenStreetMap contributors (ODbL), [tile usage policy](https://operations.osmfoundation.org/policies/tiles/); attribution shown on the map |
| Railway overlay                                                       | [OpenRailwayMap](https://www.openrailwaymap.org/) tiles (`a.tiles.openrailwaymap.org`)  | cartography CC BY-SA 2.0, data © OpenStreetMap contributors (ODbL); attribution shown on the map                                             |

Links only (no data loaded): ÖBB Fahrplanbilder (oebb.at), [DinoData](https://dinodata.toolforge.org/) / Wikidata items, [Netzgrafik-Editor](https://openrailassociation.github.io/netzgrafik-editor-frontend/) (the NGE export is generated from the GTFS data above, CC BY 4.0).
