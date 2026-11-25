// Trains standing at a station on their track (radar): HAFAS places every train at a station on
// the station's point, so trains at the same station lie on top of each other. With the platform
// HAFAS gives for the stop ("3", "11A-B") and the OSM platform edges with that track number
// (packages/vzg/data/platforms.toml, scripts/extract-platforms.ts), such a train is moved to the
// middle of its platform edge. Elsewhere (moving, no platform, no mapped edge) nothing changes.
import type { Movement, Stopover } from "@zugx/hafas";
import { COUNTRIES, countryOfStation } from "./country.ts";
import { vzgFile } from "./vzg-data.ts";

/** [track number, lat, lon of the edge's midpoint, length in m] */
export type PlatformEdge = [string, number, number, number];

/** a platform string's track number: "11A-B" → "11", "3" → "3", "Bstg 2" → "2" */
export function trackNumber(platform: string | undefined): string | undefined {
  const p = platform?.trim();
  if (!p || p === "-") return undefined;
  return /\d+/.exec(p)?.[0] ?? p.toUpperCase();
}

/** metres between two points (equirectangular; fine for a few km) */
function metres(a: [number, number], b: [number, number]): number {
  const k = Math.cos(((a[0] + b[0]) / 2) * (Math.PI / 180));
  return Math.hypot(b[0] - a[0], (b[1] - a[1]) * k) * 111_195;
}

const ms = (iso?: string) => (iso ? Date.parse(iso) : NaN);

/**
 * the stop the train is standing at, at time `t` (ms): between arrival and departure (realtime
 * where known, a minute of slack); at its first stop up to 20 min before departure, at its last
 * up to 10 min after arrival
 */
export function standingAt(stops: Stopover[], t: number): Stopover | undefined {
  const MIN = 60_000;
  return stops.find((s) => {
    const arr = ms(s.arr?.actual ?? s.arr?.planned);
    const dep = ms(s.dep?.actual ?? s.dep?.planned);
    const from = Number.isFinite(arr) ? arr - MIN : dep - 20 * MIN;
    const to = Number.isFinite(dep) ? dep + MIN : arr + 10 * MIN;
    return Number.isFinite(from) && Number.isFinite(to) && from <= t && t <= to;
  });
}

/**
 * the position on the train's platform edge, if it is standing at a station with a platform
 * whose edge is mapped: the edge with that number nearest to the station (within 600 m), and
 * HAFAS's position near the station (within 400 m: not a train placed elsewhere)
 */
export function platformPosition(
  m: Movement,
  t: number,
  edges: PlatformEdge[],
): { lat: number; lon: number; platform: string } | undefined {
  const s = standingAt(m.nextStops, t);
  const platform = s?.dep?.platform ?? s?.arr?.platform;
  const nr = trackNumber(platform);
  if (!s || !nr || s.stop.lat === undefined || s.stop.lon === undefined) return undefined;
  const at: [number, number] = [s.stop.lat, s.stop.lon];
  if (metres(at, [m.lat, m.lon]) > 400) return undefined;
  let best: { e: PlatformEdge; d: number } | undefined;
  for (const e of edges) {
    if (e[0] !== nr && trackNumber(e[0]) !== nr) continue;
    const d = metres(at, [e[1], e[2]]);
    if (d <= 600 && (!best || d < best.d)) best = { e, d };
  }
  return best ? { lat: best.e[1], lon: best.e[2], platform: platform! } : undefined;
}

const cache = new Map<string, Promise<PlatformEdge[]>>();
/** a country's platform edges (loaded once; empty if it has none) */
export function platformEdges(c: string): Promise<PlatformEdge[]> {
  let p = cache.get(c);
  if (!p) {
    p = vzgFile<{ edges?: PlatformEdge[] }>("platforms", c)
      .then((f) => f?.edges ?? [])
      .catch(() => []);
    cache.set(c, p);
  }
  return p;
}

/** the countries of the stops the trains stand at (whose platform edges are needed) */
export function countriesOf(ms: Movement[]): string[] {
  const out = new Set<string>();
  for (const m of ms)
    for (const s of m.nextStops) {
      const c = s.stop.id ? countryOfStation(s.stop.id) : undefined;
      if (c && COUNTRIES.some((x) => x.id === c)) out.add(c);
    }
  return [...out];
}
