/**
 * Platform edges with their track number from the OSM PBF → packages/vzg/data[/<country>]/
 * platforms.toml (ODbL), for placing trains standing at a station on their track (radar).
 *
 *   COUNTRY=si vpx packages/vzg/scripts/extract-platforms.ts [.cache/<extract>-YYMMDD.osm.pbf]
 *
 * `railway=platform_edge` ways with a `ref` (the passengers' track number, "3", as HAFAS gives
 * it): their midpoint along the way and length. Two passes (ways, then their nodes' coordinates).
 * Platforms as areas with "2;3" (both sides) are not used: which side is which track is unknown.
 */
import { join } from "node:path";
import { dataDir, osmPbf } from "@zugx/gtfs/country";
import { writeToml } from "@zugx/toml";
import { distKm } from "../src/lines.ts";
import { readPbf } from "../src/pbf.ts";

const input = process.argv[2] ?? osmPbf();
const out = join(dataDir("vzg"), "platforms.toml");
const t0 = Date.now();
const lap = () => `${((Date.now() - t0) / 1000).toFixed(1)} s`;

const edges: { ref: string; nodes: number[] }[] = [];
readPbf(input, {
  way: (w) => {
    const ref = w.tags.ref?.trim();
    if (w.tags.railway === "platform_edge" && ref) edges.push({ ref, nodes: w.refs });
  },
});
const needed = new Set(edges.flatMap((e) => e.nodes));
const coords = new Map<number, [number, number]>();
readPbf(input, {
  node: (n) => {
    if (needed.has(n.id)) coords.set(n.id, [n.lat, n.lon]);
  },
});

/** the point halfway along a polyline, and its length in metres */
function midpoint(pts: [number, number][]): { at: [number, number]; len: number } {
  const seg = pts.slice(1).map((p, i) => distKm(pts[i]!, p));
  const len = seg.reduce((a, b) => a + b, 0);
  let rest = len / 2;
  for (let i = 0; i < seg.length; i++) {
    if (rest <= seg[i]! || i === seg.length - 1) {
      const f = seg[i]! ? Math.min(1, rest / seg[i]!) : 0;
      const [a, b] = [pts[i]!, pts[i + 1]!];
      return { at: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], len: len * 1000 };
    }
    rest -= seg[i]!;
  }
  return { at: pts[0]!, len: 0 };
}

const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const rows = edges
  .flatMap((e) => {
    const pts = e.nodes.map((n) => coords.get(n)).filter((c): c is [number, number] => !!c);
    if (pts.length < 2) return [];
    const { at, len } = midpoint(pts);
    return [[e.ref, r6(at[0]), r6(at[1]), Math.round(len)] as [string, number, number, number]];
  })
  .sort((a, b) => a[1] - b[1] || a[2] - b[2]);
writeToml(out, {
  source: `OpenStreetMap (${input.split("/").pop()}), © OpenStreetMap contributors, ODbL 1.0`,
  /** [track number, lat, lon of the edge's midpoint, length in m] */
  edges: rows,
});
console.log(`${rows.length} platform edges → ${out} (${lap()})`);
