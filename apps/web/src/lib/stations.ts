// Local station index of all countries: lazy-loaded, content-hashed chunks
// (packages/stations/data/stations.toml, data/<country>/stations.toml).
import { loadPerCountry } from "./country.ts";
import { normalize, searchKeys, tokenPrefixMatch } from "./normalize.ts";

export interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** categories served, e.g. ["RJX","RJ","S"] */
  p?: string[];
  /** weight 1–1000 */
  w?: number;
  alias?: string[];
  /** not in HAFAS (timetable data only): no live board */
  local?: boolean;
}

interface Indexed {
  s: Station;
  keys: string[][];
  names: string[];
}

const STATION_FILES = import.meta.glob<{ default: { stations: Station[] } }>(
  "../../../../packages/stations/data/**/stations.toml",
);

let index: Indexed[] | undefined;
let byId = new Map<string, Station>();
let loading: Promise<Indexed[]> | undefined;

export function loadStations(): Promise<Indexed[]> {
  loading ??= (async () => {
    // each country on its own: one that fails to load is left out, the others still work
    const parts = await loadPerCountry(Object.entries(STATION_FILES));
    // a station listed by two countries (none so far): the selected country's; broken entries
    // (no id, no position) are skipped
    byId = new Map();
    for (const [, p] of parts)
      for (const s of p.default.stations ?? [])
        if (s?.id && Number.isFinite(s.lat) && !byId.has(s.id)) byId.set(s.id, s);
    const list = [...byId.values()];
    index = list.map((s) => {
      const names = [s.name, ...(s.alias ?? [])];
      return {
        s,
        names: names.map(normalize),
        keys: names.flatMap(searchKeys).map((k) => k.split(" ")),
      };
    });
    return index;
  })();
  return loading;
}

export const stationById = (id: string) => byId.get(id);
export const stationsLoaded = () => index !== undefined;

/** Search the local index; returns best matches ranked by match quality and weight. */
export function searchStations(query: string, limit = 10): Station[] {
  if (!index) return [];
  const q = normalize(query);
  if (!q) return [];
  const qt = q.split(" ");
  const hits: { s: Station; score: number }[] = [];
  for (const it of index) {
    if (!it.keys.some((k) => tokenPrefixMatch(qt, k))) continue;
    let score = (it.s.w ?? 1) / 1000;
    if (it.names.some((n) => n === q)) score += 3;
    else if (it.names.some((n) => n.startsWith(q))) score += 2;
    else if (it.keys.some((k) => k[0]?.startsWith(qt[0] ?? ""))) score += 1;
    hits.push({ s: it.s, score });
  }
  hits.sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name));
  return hits.slice(0, limit).map((h) => h.s);
}

/** Nearest stations to a coordinate (haversine), for "near me". */
export function nearestStations(
  lat: number,
  lon: number,
  limit = 5,
): (Station & { dist: number })[] {
  if (!index) return [];
  return index
    .map(({ s }) => ({ ...s, dist: haversine(lat, lon, s.lat, s.lon) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limit);
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** test hook */
export function _setStations(list: Station[]) {
  loading = undefined;
  byId = new Map(list.map((s) => [s.id, s]));
  index = list.map((s) => {
    const names = [s.name, ...(s.alias ?? [])];
    return {
      s,
      names: names.map(normalize),
      keys: names.flatMap(searchKeys).map((k) => k.split(" ")),
    };
  });
}
