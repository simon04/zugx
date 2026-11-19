// Build data/stations.toml: the rail stations of a country (COUNTRY, default at → data/,
// else data/<country>/) from its GTFS, mapped to HAFAS ids (ÖBB HAFAS knows the stations of the
// neighbouring countries too; their ids are UIC codes).
// Reads the local SQLite (vp run db:build).
// Run: vp run stations:build   (REMAP=1 to redo all HAFAS lookups)
import { readToml, sortKeys, writeToml } from "@zugx/toml";
import { join } from "node:path";
import {
  compareCategories,
  LONG_DISTANCE_CATEGORIES,
  mapPool,
  parseTrainName,
  politeClient,
  isFinalHafasError,
  timer,
  currentCountry,
  dataDir,
  type Country,
} from "@zugx/gtfs";
import { openZugxDb, RAIL_ROUTE_TYPES, rows, serviceDays, type Db } from "@zugx/db/query";
import type { Location } from "@zugx/hafas";
import type { GtfsHafasEntry, GtfsHafasMap, Station } from "./index.ts";
import { countryArea } from "./area.ts";
import {
  cleanGtfsName,
  cleanHafasName,
  withDiacritics,
  dhidCountry,
  normalizeName,
  scoreCandidates,
  type Scored,
} from "./match.ts";

const COUNTRY = currentCountry();
const DATA = dataDir("stations", COUNTRY);
export const MAP_PATH = join(DATA, "gtfs-hafas-map.toml");
const STATIONS_PATH = join(DATA, "stations.toml");
/** retry unmatched stations after this many days */
const RETRY_DAYS = 14;

export interface GroupStats {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** rail departures over the whole feed */
  deps: number;
  /** long-distance departures (counted extra for the weight) */
  ldDeps: number;
  cats: Set<string>;
}

/**
 * Aggregate rail usage per GTFS station group (parent station), from the local SQLite: rail trips
 * in file order, their stop times in stop_sequence order (as the former streaming reader).
 */
export function railGroups(db: Db): Map<string, GroupStats> {
  const stops = new Map(
    rows<{ id: string; name: string; lat: number; lon: number; parent: string | null }>(
      db,
      "select stop_id id, stop_name name, stop_lat lat, stop_lon lon, parent_station parent from stops",
    ).map((s) => [s.id, s]),
  );
  const services = serviceDays(db);
  const trips = rows<{ id: string; name: string; service: string }>(
    db,
    `select t.trip_id id, trim(coalesce(t.trip_short_name, '')) name, t.service_id service
       from trips t join routes r using (route_id) where ${RAIL_ROUTE_TYPES} order by t.rowid`,
  );
  type St = { trip: string; stopId: string; pickup: number; dropoff: number };
  const stopTimes = new Map<string, St[]>();
  for (const r of rows<St>(
    db,
    `select st.trip_id trip, st.stop_id stopId, coalesce(st.pickup_type, 0) pickup,
            coalesce(st.drop_off_type, 0) dropoff
       from stop_times st join trips t using (trip_id) join routes r using (route_id)
      where ${RAIL_ROUTE_TYPES} order by st.trip_id, st.stop_sequence`,
  )) {
    const list = stopTimes.get(r.trip) ?? [];
    list.push(r);
    stopTimes.set(r.trip, list);
  }
  const group = (id: string) => stops.get(id)?.parent || id;

  const groups = new Map<string, GroupStats & { n: number; sLat: number; sLon: number }>();
  for (const trip of trips) {
    const sts = stopTimes.get(trip.id);
    if (!sts) continue;
    const days = services.get(trip.service)?.length ?? 0;
    const cat = parseTrainName(trip.name)?.cat;
    const ld = LONG_DISTANCE_CATEGORIES.includes(cat ?? "");
    for (const [i, st] of sts.entries()) {
      if (st.pickup === 1 && st.dropoff === 1) continue;
      const gid = group(st.stopId);
      let s = groups.get(gid);
      if (!s) {
        const parent = stops.get(gid);
        s = {
          id: gid,
          name: parent?.name ?? stops.get(st.stopId)?.name ?? gid,
          lat: 0,
          lon: 0,
          deps: 0,
          ldDeps: 0,
          cats: new Set(),
          n: 0,
          sLat: 0,
          sLon: 0,
        };
        groups.set(gid, s);
      }
      const stop = stops.get(st.stopId);
      if (stop && Number.isFinite(stop.lat) && stop.lat !== 0) {
        s.n++;
        s.sLat += stop.lat;
        s.sLon += stop.lon;
      }
      if (cat) s.cats.add(cat);
      if (i < sts.length - 1 && st.pickup !== 1) {
        s.deps += days;
        if (ld) s.ldDeps += days;
      }
    }
  }
  // coordinates: centroid of the rail platforms actually used (the parent may include bus stops)
  for (const s of groups.values()) {
    if (s.n) {
      s.lat = s.sLat / s.n;
      s.lon = s.sLon / s.n;
    } else {
      const p = stops.get(s.id);
      s.lat = p?.lat ?? 0;
      s.lon = p?.lon ?? 0;
    }
  }
  return groups;
}

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

/** Find the HAFAS station for a GTFS station group. */
export async function lookup(
  client: ReturnType<typeof politeClient>["client"],
  s: GroupStats,
): Promise<Scored | undefined> {
  const accept = (c: Scored | undefined) =>
    c && ((c.dist <= 600 && (c.sim >= 0.3 || c.dist <= 150)) || (c.dist <= 2000 && c.sim >= 0.75))
      ? c
      : undefined;
  let near: Location[] = [];
  try {
    near = await client.nearby(s.lat, s.lon, 600, 30);
  } catch (e) {
    if (!isFinalHafasError(e)) throw e;
  }
  const geo = accept(scoreCandidates(s, near)[0]);
  if (geo && geo.sim >= 0.5) return geo;
  // weak or no geo match: also try by name
  let byName: Location[] = [];
  try {
    byName = await client.locations(cleanGtfsName(s.name), 10);
  } catch (e) {
    if (!isFinalHafasError(e)) throw e;
  }
  return accept(scoreCandidates(s, [...near, ...byName])[0]) ?? geo;
}

export async function updateMap(
  groups: Iterable<GroupStats>,
  log: (msg: string) => void = console.log,
): Promise<GtfsHafasMap> {
  const old = readToml<GtfsHafasMap>(MAP_PATH, {});
  const todayDate = Temporal.Now.plainDateISO("Europe/Vienna");
  const today = todayDate.toString();
  const retryBefore = todayDate.subtract({ days: RETRY_DAYS }).toString();
  const map: GtfsHafasMap = {};
  const todo: GroupStats[] = [];
  for (const s of groups) {
    const e = old[s.id];
    // matched: kept; unmatched and local (not in HAFAS): looked up again after RETRY_DAYS
    const fresh = e && ((!!e.id && !e.local) || (e.checked ?? "") >= retryBefore);
    if (e && fresh && !process.env.REMAP) map[s.id] = { ...e, gtfs: s.name };
    else todo.push(s);
  }
  log(`map: ${Object.keys(map).length} cached, ${todo.length} to look up`);
  if (!todo.length) return map;
  const t = timer();
  const polite = politeClient({ log });
  let done = 0;
  await mapPool(todo, 3, async (s) => {
    const best = await lookup(polite.client, s);
    const entry: GtfsHafasEntry = best
      ? {
          id: best.loc.id,
          name: best.loc.name,
          lat: round6(best.loc.lat!),
          lon: round6(best.loc.lon!),
          p: best.loc.products ?? 0,
          d: Math.round(best.dist),
          gtfs: s.name,
        }
      : { id: null, gtfs: s.name, checked: today };
    map[s.id] = entry;
    if (!best)
      log(`map: no match for ${s.id} "${s.name}" (${s.lat.toFixed(5)}, ${s.lon.toFixed(5)})`);
    if (++done % 50 === 0) {
      log(`map: ${done}/${todo.length} (${polite.count} requests, ${t()})`);
      writeToml(MAP_PATH, sortKeys(map));
    }
  });
  log(`map: looked up ${todo.length} stations with ${polite.count} requests in ${t()}`);
  writeToml(MAP_PATH, sortKeys(map));
  return map;
}

/**
 * a station group of this run's country: by its DHID ("at:…") where the feed has them, else by
 * the UIC country code of its HAFAS id (e.g. 79… for Slovenia)
 */
export function inCountry(gid: string, e?: GtfsHafasEntry, c: Country = COUNTRY): boolean {
  const d = dhidCountry(gid);
  return d ? d === c.id : !!e?.id?.startsWith(c.uic);
}

export function buildStations(groups: Map<string, GroupStats>, map: GtfsHafasMap): Station[] {
  const byId = new Map<
    string,
    { e: GtfsHafasEntry; deps: number; ldDeps: number; cats: Set<string>; gtfsNames: Set<string> }
  >();
  for (const s of groups.values()) {
    const e = map[s.id];
    if (!inCountry(s.id, e)) continue;
    if (!e?.id) continue;
    let x = byId.get(e.id);
    if (!x) byId.set(e.id, (x = { e, deps: 0, ldDeps: 0, cats: new Set(), gtfsNames: new Set() }));
    x.deps += s.deps;
    x.ldDeps += s.ldDeps;
    for (const c of s.cats) x.cats.add(c);
    x.gtfsNames.add(s.name);
  }
  // weight: departures, long-distance ones counted 5×; log scale, cubed to spread the top end
  const score = (x: { deps: number; ldDeps: number }) => x.deps + 4 * x.ldDeps;
  const maxLog = Math.log1p(Math.max(1, ...[...byId.values()].map(score)));
  const out: Station[] = [];
  for (const [id, x] of byId) {
    const name = x.e.local
      ? cleanGtfsName(x.e.gtfs)
      : withDiacritics(cleanHafasName(x.e.name ?? ""), x.gtfsNames);
    // aliases: GTFS names that the client search wouldn't find via the HAFAS name anyway
    const words = new Set(normalizeName(name).split(" "));
    const alias = new Set<string>();
    for (const n of x.gtfsNames) {
      const a = cleanGtfsName(n);
      if (
        !normalizeName(a)
          .split(" ")
          .every((w) => words.has(w))
      )
        alias.add(a);
    }
    const st: Station = {
      id,
      name,
      lat: x.e.lat!,
      lon: x.e.lon!,
      p: [...x.cats].sort(compareCategories),
      w: Math.max(1, Math.round(1000 * (Math.log1p(score(x)) / maxLog) ** 3)),
    };
    if (alias.size) st.alias = [...alias].sort();
    if (x.e.local) st.local = true;
    out.push(st);
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * stations HAFAS doesn't know, inside the country: an id from the GTFS stop id
 * (Country.localStationPrefix), name and position from the GTFS
 */
export function addLocalStations(
  groups: Iterable<GroupStats>,
  map: GtfsHafasMap,
  c: Country = COUNTRY,
): number {
  const prefix = c.localStationPrefix;
  const inside = prefix ? countryArea(c) : undefined;
  if (!prefix || !inside) return 0;
  let n = 0;
  for (const s of groups) {
    const e = map[s.id];
    if (e?.id && !e.local) continue;
    if (!/^\d{5}$/.test(s.id) || !s.lat || !inside(s.lat, s.lon)) continue;
    map[s.id] = {
      id: prefix + s.id,
      name: s.name,
      lat: round6(s.lat),
      lon: round6(s.lon),
      gtfs: s.name,
      checked: e?.checked ?? Temporal.Now.plainDateISO("Europe/Vienna").toString(),
      local: true,
    };
    n++;
  }
  return n;
}

async function main() {
  const total = timer();
  const groups = railGroups(openZugxDb());
  console.log(`stations: ${COUNTRY.id}: ${groups.size} rail station groups`);
  const map = await updateMap(groups.values());
  const local = addLocalStations(groups.values(), map);
  if (local) {
    writeToml(MAP_PATH, sortKeys(map));
    console.log(
      `stations: ${local} stations not in HAFAS, ids from the GTFS (${COUNTRY.localStationPrefix} + stop id)`,
    );
  }
  const unmapped = [...groups.values()].filter((s) => !map[s.id]?.id);
  const far = [...groups.values()].filter((s) => (map[s.id]?.d ?? 0) > 400);
  for (const s of unmapped) console.log(`unmapped: ${s.id} "${s.name}" (${s.deps} deps)`);
  for (const s of far)
    console.log(
      `far match: ${s.id} "${s.name}" → ${map[s.id]!.id} "${map[s.id]!.name}" ${map[s.id]!.d} m`,
    );
  const stations = buildStations(groups, map);
  const text = writeToml(STATIONS_PATH, { stations });
  console.log(
    `stations: mapped ${groups.size - unmapped.length}/${groups.size} groups ` +
      `(${unmapped.length} unmapped); ` +
      `wrote ${stations.length} stations, ${(text.length / 1024).toFixed(0)} KiB → ${STATIONS_PATH} in ${total()}`,
  );
}

if (import.meta.main) await main();
