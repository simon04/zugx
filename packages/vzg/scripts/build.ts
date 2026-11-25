/**
 * Step 2: VzG data per line (Streckennummer) and track from the OSM extract →
 * packages/vzg/data/<ref>.toml (e.g. 101-01.toml) + data/index.toml. ODbL (see data/LICENSE.md).
 *
 *   COUNTRY=si vpx packages/vzg/scripts/build.ts [.cache/osm-rail-si.json]
 */
import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { currentCountry, dataDir, osmRailPath } from "@zugx/gtfs/country";
import { writeToml } from "@zugx/toml";
import { connections } from "../src/connections.ts";
import { decodePolyline, encodePolyline, simplify } from "../src/geo.ts";
import { buildLines } from "../src/lines.ts";
import type { RailExtract, VzgIndexEntry } from "../src/types.ts";

// the country's rail extract (COUNTRY, default at) → packages/vzg/data (Austria) or data/<country>
const input = process.argv[2] ?? osmRailPath();
const out = dataDir("vzg");
const t0 = Date.now();
const ex = JSON.parse(readFileSync(input, "utf8")) as RailExtract;
const lineRef = new RegExp(currentCountry().lineRef);
const lines = buildLines(ex, lineRef);
// connecting lines at the stations (after all lines are built)
for (const [l, c] of connections(lines)) l.connections = c;
mkdirSync(out, { recursive: true });
// old line files (lines may disappear); index, geometry and network are rewritten below,
// boundaries.toml and platforms.toml come from their own scripts (extract-boundaries.ts,
// extract-platforms.ts) and stay
const OWN = new Set(["boundaries.toml", "platforms.toml"]);
for (const f of readdirSync(out)) if (f.endsWith(".toml") && !OWN.has(f)) rmSync(join(out, f));
// the network map's pieces go to their own file, not into the line files
const network = lines.flatMap((l) => {
  const pieces = l.tracks[0]?.net;
  for (const t of l.tracks) delete t.net;
  return pieces?.length
    ? [
        {
          id: l.id,
          ...(l.ref ? { ref: l.ref } : {}),
          ...(l.name ? { name: l.name } : {}),
          ...(l.operator ? { operator: l.operator } : {}),
          pieces,
          // whole-km posts in path order (traffic density per km section)
          ...((l.tracks[0]?.geo?.posts.length ?? 0) > 1
            ? {
                posts: {
                  km: l.tracks[0]!.geo!.posts.map((p) => p[0]),
                  line: encodePolyline(l.tracks[0]!.geo!.posts.map((p) => [p[1], p[2]])),
                },
              }
            : {}),
        },
      ]
    : [];
});
const index: VzgIndexEntry[] = [];
for (const l of lines) {
  const file = `${l.id}.toml`;
  writeToml(join(out, file), l);
  const t = l.tracks;
  const covered = (tr: (typeof t)[number]) =>
    tr.speeds.filter((s) => s[2] !== null || s[3] !== null).reduce((a, s) => a + s[1] - s[0], 0) /
    Math.max(0.001, tr.kmTo - tr.kmFrom);
  index.push({
    id: l.id,
    ...(l.ref ? { ref: l.ref } : {}),
    oebb: lineRef.test(l.ref ?? ""),
    ...(l.operator ? { operator: l.operator } : {}),
    ...(l.gauge ? { gauge: l.gauge } : {}),
    ...(l.wikidata ? { wikidata: l.wikidata } : {}),
    ...(l.name ? { name: l.name } : {}),
    ...(l.from ? { from: l.from } : {}),
    ...(l.to ? { to: l.to } : {}),
    file,
    tracks: t.map((tr) => tr.track),
    kmFrom: Math.min(...t.map((tr) => tr.kmFrom)),
    kmTo: Math.max(...t.map((tr) => tr.kmTo)),
    length: Math.max(...t.map((tr) => tr.length)),
    speedCoverage: Math.round(Math.min(...t.map(covered)) * 100) / 100,
    stations: Math.max(
      ...t.map(
        (tr) =>
          new Set(
            tr.points
              .filter((p) => p.kind === "station" || p.kind === "halt" || p.kind === "stop")
              .map((p) => p.label),
          ).size,
      ),
    ),
    signals: Math.max(...t.map((tr) => tr.points.filter((p) => p.kind === "signal").length)),
    names: [
      ...new Set(
        t.flatMap((tr) =>
          tr.points
            .filter(
              (p) => (p.kind === "station" || p.kind === "halt" || p.kind === "stop") && p.label,
            )
            .map((p) => p.label!),
        ),
      ),
    ],
  });
}
// all lines' geometry, coarser (~40 m), for the context network on the line maps
writeToml(join(out, "geometry.toml"), {
  lines: lines.flatMap((l) => {
    const g = l.tracks[0]?.geo;
    if (!g) return [];
    const pts = g.segments.flatMap((s) => decodePolyline(s.line));
    return [
      { id: l.id, ...(l.ref ? { ref: l.ref } : {}), line: encodePolyline(simplify(pts, 40)) },
    ];
  }),
});
writeToml(join(out, "network.toml"), { lines: network });
writeToml(join(out, "index.toml"), {
  source: `OpenStreetMap (${ex.source}), © OpenStreetMap contributors, ODbL 1.0`,
  created: ex.created,
  ...(ex.osmDate ? { osmDate: ex.osmDate } : {}),
  lines: index,
});
console.log(`${lines.length} lines → ${out} (${Date.now() - t0} ms)`);
