// Build the timetable-routing data for the browser (minotor, RAPTOR): one timetable per day and a
// stops index, from the committed routing input of every country (packages/route/data,
// data/<country>; route:export), merged — no feed download, no database needed.
//
// minotor names a leg by its GTFS route; the ÖBB routes are timetable sheets ("A10-1"), so a
// routing GTFS is written first in which every train is its own route ("RJX 162", rail and
// replacement buses only) — legs then carry the train. Output (not committed; served as static
// files): apps/web/public/route/stops.bin, <YYYY-MM-DD>.bin for the next DAYS days, and
// stations.json (HAFAS station id → GTFS parent station, to start a query from the app's ids).
// Border stations are in both feeds under different ids: the straight-line transfers join them.
// Run: vp run route:build   (DAYS=7)
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { GtfsParser, standardGtfsProfile, StraightLineTransferGenerator } from "minotor/parser";
import { COUNTRIES, dataDir, timer, type Country } from "@zugx/gtfs";
import { fromToml, readToml } from "@zugx/toml";
import { parseStopEntry, type RouteInput } from "./export.ts";

const root = join(import.meta.dirname, "..", "..", "..");
const OUT = join(root, "apps", "web", "public", "route");
const GTFS = join(root, ".cache", "route-gtfs.zip");
const DAYS = Number(process.env.DAYS) || 7;

/** a CSV table: header + rows, values quoted where needed */
function csv(header: string[], data: (string | number | null | undefined)[][]): Uint8Array {
  const q = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return strToU8([header.join(","), ...data.map((r) => r.map(q).join(","))].join("\n") + "\n");
}

type Row = (string | number | null | undefined)[];

/** the window of days the timetables are built for (and a day before: trips past midnight) */
function windowDays(): string[] {
  const today = Temporal.Now.plainDateISO("Europe/Vienna");
  return Array.from({ length: DAYS + 1 }, (_, i) => today.add({ days: i - 1 }).toString());
}

/**
 * one country's part of the routing GTFS, from its committed routing input
 * (packages/route/data[/<country>]/trips-<year>.toml, export.ts): every train pattern a trip with
 * its own service running on its days within the window; ids of the other countries than Austria
 * prefixed with the country ("si:1122804"), so the feeds can't collide
 */
function countryTables(c: Country, days: string[]) {
  type Id = string | number | null | undefined;
  const p = (v: Id): Id =>
    c.id === "at" || v === null || v === undefined || v === "" ? v : `${c.id}:${v}`;
  const dir = dataDir("route", c);
  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => /^trips-\d{4}\.toml$/.test(f))
    : [];
  const out = {
    trips: [] as Row[],
    names: [] as string[],
    stopTimes: [] as Row[],
    stops: new Map<string, Row>(),
    dates: [] as Row[],
    hafas: [] as (readonly [string, string])[],
  };
  for (const f of files) {
    const r = fromToml<RouteInput>(readFileSync(join(dir, f), "utf8"));
    const begin = Temporal.PlainDate.from(r.begin);
    /** the window's days as indexes into this file's running days */
    const idx = days
      .map((d) => ({ d: d.replaceAll("-", ""), i: begin.until(d).days }))
      .filter((x) => x.i >= 0);
    for (const s of r.stops)
      out.stops.set(String(p(s.id)), [
        p(s.id),
        s.name,
        s.lat,
        s.lon,
        s.station ? 1 : 0,
        p(s.parent),
        s.platform,
      ]);
    r.trips.forEach((t, k) => {
      const bits = Uint8Array.from(atob(t.days), (ch) => ch.charCodeAt(0));
      const on = idx.filter(({ i }) => ((bits[i >> 3] ?? 0) >> (7 - (i & 7))) & 1);
      if (!on.length) return;
      const id = p(`${r.year}-${k}`);
      out.trips.push([t.train, id, id, t.to]);
      out.names.push(t.train);
      for (const { d } of on) out.dates.push([id, d, 1]);
      const hhmm = (m: number) =>
        `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;
      t.stops.forEach((e, seq) => {
        const s = parseStopEntry(e);
        out.stopTimes.push([
          id,
          hhmm(s.arr),
          hhmm(s.dep),
          p(s.id),
          seq,
          s.pickup ? 0 : 1,
          s.dropoff ? 0 : 1,
        ]);
      });
    });
  }
  /** HAFAS station id → (prefixed) GTFS station id */
  out.hafas = Object.entries(
    readToml<Record<string, { id?: string }>>(
      join(dataDir("stations", c), "gtfs-hafas-map.toml"),
      {},
    ),
  ).flatMap(([gid, e]) => (e.id ? [[e.id, String(p(gid))] as const] : []));
  return { ...out, stops: [...out.stops.values()], files: files.length };
}

/** the routing GTFS of all countries with a routing input, each train a route */
function writeRoutingGtfs() {
  const days = windowDays();
  const countries = Object.values(COUNTRIES);
  // each country on its own: one whose input fails to read is left out of the search (with a
  // warning) instead of failing the build — and with it the deploy — for every country
  const parts = countries.flatMap((c) => {
    try {
      return [{ ...countryTables(c, days), country: c }];
    } catch (e) {
      console.warn(`route: ${c.id}: routing input not usable, left out —`, e);
      return [];
    }
  });
  const all = <K extends "trips" | "stopTimes" | "stops" | "dates">(k: K) =>
    parts.flatMap((t) => t[k]);
  const trains = new Set(parts.flatMap((t) => t.names));
  const files: Record<string, Uint8Array> = {
    "agency.txt": csv(
      ["agency_id", "agency_name", "agency_url", "agency_timezone"],
      [
        [
          "zugx",
          parts.map((t) => t.country.licence.source).join(", "),
          "https://zugx.legner.me",
          "Europe/Vienna",
        ],
      ],
    ),
    "routes.txt": csv(
      ["route_id", "agency_id", "route_short_name", "route_type"],
      [...trains].map((name) => [name, "zugx", name, 2]),
    ),
    "trips.txt": csv(["route_id", "service_id", "trip_id", "trip_headsign"], all("trips")),
    "stop_times.txt": csv(
      [
        "trip_id",
        "arrival_time",
        "departure_time",
        "stop_id",
        "stop_sequence",
        "pickup_type",
        "drop_off_type",
      ],
      all("stopTimes"),
    ),
    "stops.txt": csv(
      [
        "stop_id",
        "stop_name",
        "stop_lat",
        "stop_lon",
        "location_type",
        "parent_station",
        "platform_code",
      ],
      all("stops"),
    ),
    "calendar_dates.txt": csv(["service_id", "date", "exception_type"], all("dates")),
  };
  mkdirSync(join(root, ".cache"), { recursive: true });
  writeFileSync(GTFS, zipSync(files));
  // a HAFAS id mapped in several feeds (border stations): the station of its own country's feed
  // (UIC prefix: Ljubljana 79… → the Slovenian feed, which has all its trains), else the first
  const hafas: Record<string, string> = {};
  for (const t of parts)
    for (const [h, g] of t.hafas) if (!(h in hafas) || h.startsWith(t.country.uic)) hafas[h] = g;
  return {
    countries: parts.filter((t) => t.files).map((t) => t.country.id),
    trains: trains.size,
    trips: parts.reduce((n, t) => n + t.trips.length, 0),
    hafas,
  };
}

async function main() {
  const t = timer();
  const g = writeRoutingGtfs();
  console.log(
    `route: routing GTFS (${g.countries.join(", ")}) with ${g.trains} trains, ${g.trips} trips (${t()})`,
  );
  mkdirSync(OUT, { recursive: true });
  for (const f of readdirSync(OUT)) if (f.endsWith(".bin")) rmSync(join(OUT, f));
  // walking between platforms of the same station is in the stop hierarchy; nearby stations
  // (e.g. Wien Hbf ↔ Wien Hbf (Autoreisezug)) get straight-line transfers up to 300 m
  const parser = new GtfsParser(
    GTFS,
    standardGtfsProfile,
    new StraightLineTransferGenerator({ maxDistanceMeters: 300 }),
  );
  const stops = await parser.parseStops();
  writeFileSync(join(OUT, "stops.bin"), stops.serialize());
  writeFileSync(join(OUT, "stations.json"), JSON.stringify(g.hafas));
  const today = Temporal.Now.plainDateISO("Europe/Vienna");
  for (let i = 0; i < DAYS; i++) {
    const day = today.add({ days: i }).toString();
    const tt = await parser.parseTimetable(new Date(`${day}T12:00:00Z`));
    const bin = tt.serialize();
    writeFileSync(join(OUT, `${day}.bin`), bin);
    console.log(`route: ${day}: ${(bin.length / 1024 / 1024).toFixed(1)} MB (${t()})`);
  }
  console.log(`route: ${DAYS} days → ${OUT} (${t()})`);
}

if (import.meta.main) await main();
