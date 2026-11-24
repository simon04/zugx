// Export the routing input of one country (COUNTRY, default at) from its local SQLite
// (vp run db:build): every rail train with its stops and times for the timetable year, committed as
// packages/route/data/trips-<year>.toml (Austria) or data/<country>/trips-<year>.toml — so the
// routing data (route:build) is built from the repository alone, without downloading the feeds.
//
// One stop and one train pattern per line (small diffs on a refresh). A pattern is a train with
// its exact stops and times; the days it runs are a bitset over the timetable year (base64, MSB
// first, day 0 = `begin`, as in the train index). A stop of a pattern: "<stop id> <arr> [<dep>]
// [-p] [-d]" — minutes after midnight of the service day (may pass 1440), dep only if it differs,
// -p no boarding, -d no alighting.
// Run: vp run route:export   (COUNTRY=si …)
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { openZugxDb, RAIL_ROUTE_TYPES, rows, serviceDays } from "@zugx/db/query";
import {
  currentCountry,
  dataDir,
  dayFromIso,
  feedYear,
  sourceLabel,
  timer,
  timetableYear,
} from "@zugx/gtfs";
import { encodeDays } from "@zugx/trains";

/** a stop of the routing input: platform or station (location_type 1) */
export interface RouteStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** the station of a platform */
  parent?: string;
  platform?: string;
  /** a station (parent of platforms) */
  station?: boolean;
}

/** a train pattern: its stops ("<stop id> <arr> [<dep>] [-p] [-d]") and running days */
export interface RouteTrip {
  train: string;
  to?: string;
  days: string;
  stops: string[];
}

export interface RouteInput {
  year: number;
  begin: string;
  end: string;
  source: string;
  stops: RouteStop[];
  trips: RouteTrip[];
}

const minutes = (t: string) => {
  const [h = 0, m = 0, s = 0] = t.split(":").map(Number);
  return h * 60 + m + Math.round(s / 60);
};

/** one stop of a pattern, as written to the file */
export function stopEntry(id: string, arr: number, dep: number, pickup = 0, dropoff = 0): string {
  return `${id} ${arr}${dep !== arr ? ` ${dep}` : ""}${pickup === 1 ? " -p" : ""}${dropoff === 1 ? " -d" : ""}`;
}

/** parse a pattern's stop entry */
export function parseStopEntry(s: string): {
  id: string;
  arr: number;
  dep: number;
  pickup: boolean;
  dropoff: boolean;
} {
  const parts = s.split(" ");
  const id = parts[0]!;
  const nums = parts.slice(1).filter((x) => /^\d+$/.test(x));
  const arr = Number(nums[0]);
  return {
    id,
    arr,
    dep: nums[1] !== undefined ? Number(nums[1]) : arr,
    pickup: !parts.includes("-p"),
    dropoff: !parts.includes("-d"),
  };
}

const q = (s: string) => JSON.stringify(s);

/** the file text: header, then one stop / pattern per line */
export function routeToml(r: RouteInput): string {
  const stop = (s: RouteStop) =>
    `  { id = ${q(s.id)}, name = ${q(s.name)}, lat = ${s.lat}, lon = ${s.lon}${
      s.parent ? `, parent = ${q(s.parent)}` : ""
    }${s.platform ? `, platform = ${q(s.platform)}` : ""}${s.station ? ", station = true" : ""} },`;
  const trip = (t: RouteTrip) =>
    `  { train = ${q(t.train)}${t.to ? `, to = ${q(t.to)}` : ""}, days = ${q(t.days)}, stops = [${t.stops
      .map(q)
      .join(", ")}] },`;
  return [
    "# routing input (rail trains with stops and times) for the timetable search; built by",
    "# packages/route/src/export.ts from the GTFS, read by route:build",
    `year = ${r.year}`,
    `begin = ${q(r.begin)}`,
    `end = ${q(r.end)}`,
    `source = ${q(r.source)}`,
    "stops = [",
    ...r.stops.map(stop),
    "]",
    "trips = [",
    ...r.trips.map(trip),
    "]",
    "",
  ].join("\n");
}

function main() {
  const t = timer();
  const country = currentCountry();
  const db = openZugxDb();
  const services = serviceDays(db);
  const year = Number(process.env.TRAINS_YEAR) || feedYear({ services });
  const tty = timetableYear(year);
  const begin = dayFromIso(tty.begin);
  const skip = (country.routeSkip ?? []).map((c) => `'${c.replaceAll("'", "''")} %'`);
  const named =
    `${RAIL_ROUTE_TYPES} and trim(coalesce(t.trip_short_name, '')) <> ''` +
    skip.map((c) => ` and trim(t.trip_short_name) not like ${c}`).join("");
  const st = rows<{
    trip: string;
    stop: string;
    arr: string | null;
    dep: string | null;
    p: number | null;
    o: number | null;
    train: string;
    to: string | null;
    service: string;
  }>(
    db,
    `select st.trip_id trip, st.stop_id stop, st.arrival_time arr, st.departure_time dep,
            st.pickup_type p, st.drop_off_type o, trim(t.trip_short_name) train,
            t.trip_headsign "to", t.service_id service
       from stop_times st join trips t using (trip_id) join routes r using (route_id)
      where ${named} order by st.trip_id, st.stop_sequence`,
  );
  // trips → patterns (same train, destination, stops and times): their running days merged
  const trips = new Map<string, { train: string; to: string; service: string; stops: string[] }>();
  for (const r of st) {
    let x = trips.get(r.trip);
    if (!x)
      trips.set(r.trip, (x = { train: r.train, to: r.to ?? "", service: r.service, stops: [] }));
    const arr = minutes(r.arr ?? r.dep ?? "0:0");
    const dep = minutes(r.dep ?? r.arr ?? "0:0");
    x.stops.push(stopEntry(r.stop, arr, dep, r.p ?? 0, r.o ?? 0));
  }
  const patterns = new Map<string, { trip: RouteTrip; days: Set<number> }>();
  const used = new Set<string>();
  for (const x of trips.values()) {
    if (x.stops.length < 2) continue;
    const days = (services.get(x.service) ?? [])
      .map((d) => d - begin)
      .filter((i) => i >= 0 && i < tty.days);
    if (!days.length) continue;
    const key = `${x.train}|${x.to}|${x.stops.join(",")}`;
    let p = patterns.get(key);
    if (!p) {
      patterns.set(
        key,
        (p = {
          trip: { train: x.train, ...(x.to ? { to: x.to } : {}), days: "", stops: x.stops },
          days: new Set(),
        }),
      );
      for (const s of x.stops) used.add(s.split(" ")[0]!);
    }
    for (const d of days) p.days.add(d);
  }
  const out = [...patterns.values()].map((p) => ({
    ...p.trip,
    days: encodeDays(p.days, tty.days),
  }));
  const first = (r: RouteTrip) => parseStopEntry(r.stops[0]!).dep;
  out.sort(
    (a, b) =>
      a.train.localeCompare(b.train, "en", { numeric: true }) ||
      first(a) - first(b) ||
      a.stops.join().localeCompare(b.stops.join()),
  );
  // the stops used, and their stations
  const all = rows<{
    id: string;
    name: string;
    lat: number;
    lon: number;
    type: number | null;
    parent: string | null;
    platform: string | null;
  }>(
    db,
    `select stop_id id, stop_name name, stop_lat lat, stop_lon lon, location_type type,
            parent_station parent, platform_code platform from stops`,
  );
  const byId = new Map(all.map((s) => [s.id, s]));
  for (const id of [...used]) {
    const parent = byId.get(id)?.parent;
    if (parent) used.add(parent);
  }
  const stops: RouteStop[] = [...used]
    .flatMap((id) => {
      const s = byId.get(id);
      if (!s) return [];
      return [
        {
          id,
          name: s.name,
          lat: Math.round(s.lat * 1e6) / 1e6,
          lon: Math.round(s.lon * 1e6) / 1e6,
          ...(s.parent ? { parent: s.parent } : {}),
          ...(s.platform ? { platform: s.platform } : {}),
          ...(s.type === 1 ? { station: true } : {}),
        },
      ];
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const dir = dataDir("route", country);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `trips-${year}.toml`);
  const text = routeToml({
    year,
    begin: tty.begin,
    end: tty.end,
    source: sourceLabel(year, country),
    stops,
    trips: out,
  });
  writeFileSync(file, text);
  console.log(
    `route:export ${country.id}: ${trips.size} trips → ${out.length} patterns, ${stops.length} stops, ${(text.length / 1e6).toFixed(1)} MB → ${file} (${t()})`,
  );
}

if (import.meta.main) main();
