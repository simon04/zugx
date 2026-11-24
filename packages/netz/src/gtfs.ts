/**
 * GTFS loading: reads a GTFS feed (database records or CSV text), keeps only
 * rail trips that run on one reference day and resolves stops to their parent
 * stations.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Unzip, UnzipInflate } from "fflate";
import { fetchFeeds } from "@zugx/gtfs";
import { csvRecords, textChunks } from "./csv.ts";

export interface Station {
  /** parent station DHID, e.g. `Pat:41:3087` */
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface StopTime {
  /** parent station id */
  st: string;
  /** minutes since midnight of the service day (may exceed 1440), null if unknown */
  arr: number;
  dep: number;
  /** shape_dist_traveled in metres (NaN if absent) */
  dist: number;
  /** a station the train passes without stopping (added by passingPoints, time estimated) */
  pass?: boolean;
}

export interface Trip {
  id: string;
  /** category, e.g. "RJX" */
  cat: string;
  /** train number, e.g. "760" */
  nr: string;
  headsign: string;
  routeId: string;
  /** GTFS service_id (running days via {@link serviceDays}) */
  service: string;
  /** GTFS shape_id (route geometry, {@link loadShapes}) */
  shape?: string;
  stops: StopTime[];
}

export interface Feed {
  stations: Map<string, Station>;
  trips: Trip[];
}

/** Raw GTFS tables as text-chunk iterables (lets tests feed synthetic data). */
export type TableSource = (name: string) => Iterable<string> | undefined;
/** GTFS tables as records (column → value text), e.g. rows of the local SQLite (@zugx/db) */
export interface RecordSource {
  records(name: string): Iterable<Record<string, string>>;
}
export type Source = TableSource | RecordSource;
/** the records of a table from either kind of source */
const table = (src: Source, name: string): Iterable<Record<string, string>> =>
  typeof src === "function" ? csvRecords(src(name) ?? []) : src.records(name);

/**
 * Local path of the GTFS zip with the shapes: the first feed of the country (env GTFS_ZIP or
 * countries.toml; downloaded into .cache if missing).
 */
export async function feedZip(): Promise<string> {
  const [first] = await fetchFeeds(() => {});
  if (!first) throw new Error("no GTFS feed configured");
  return first.path;
}

/** "HH:MM:SS" → minutes since midnight (seconds rounded). */
export function parseGtfsTime(s: string): number {
  const [h, m, sec] = s.split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return NaN;
  return h * 60 + m + Math.round((sec ?? 0) / 60);
}

/** `2026-03-10` → `20260310` */
const gtfsDate = (day: string) => day.replaceAll("-", "");
// GTFS calendar columns, indexed by ISO dayOfWeek - 1 (Monday first)
const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/** Set of service_ids active on `day` (YYYY-MM-DD). */
export function activeServices(src: Source, day: string): Set<string> {
  const d = gtfsDate(day);
  const weekday = WEEKDAYS[Temporal.PlainDate.from(day).dayOfWeek - 1]!;
  const active = new Set<string>();
  for (const r of table(src, "calendar")) {
    if (r[weekday] === "1" && r.start_date! <= d && d <= r.end_date!) active.add(r.service_id!);
  }
  for (const r of table(src, "calendar_dates")) {
    if (r.date !== d) continue;
    if (r.exception_type === "1") active.add(r.service_id!);
    else if (r.exception_type === "2") active.delete(r.service_id!);
  }
  return active;
}

/** Strips the generic " Bahnhof" / " Hauptbahnhof" suffixes used in ÖBB stop names. */
export function shortStationName(name: string): string {
  return name
    .replace(/ Hauptbahnhof$/, " Hbf")
    .replace(/ Bahnhof$/, "")
    .replace(/ Bahnhst$/, "")
    .trim();
}

/** Parent station DHID of a stop DHID: `at:48:817:0:2` → `Pat:48:817`. */
export function parentDhid(stopId: string): string {
  const m = /^([a-z]{2}:[^:]+:[^:]+)/.exec(stopId);
  return m ? `P${m[1]}` : stopId;
}

/** First and last day (YYYY-MM-DD) covered by calendar.txt / calendar_dates.txt. */
export function feedPeriod(src: Source): { begin: string; end: string } {
  let lo = "99999999";
  let hi = "00000000";
  for (const r of table(src, "calendar")) {
    if (r.start_date! < lo) lo = r.start_date!;
    if (r.end_date! > hi) hi = r.end_date!;
  }
  // feeds with calendar_dates only (one service per day, e.g. BDZ): the added days
  for (const r of table(src, "calendar_dates")) {
    if (r.exception_type !== "1") continue;
    if (r.date! < lo) lo = r.date!;
    if (r.date! > hi) hi = r.date!;
  }
  const iso = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return { begin: iso(lo), end: iso(hi) };
}

/**
 * Running days per service_id within [begin, end] (YYYY-MM-DD, inclusive), as day
 * indexes counted from `begin`.
 */
export function serviceDays(src: Source, begin: string, end: string): Map<string, Set<number>> {
  const b = Temporal.PlainDate.from(begin);
  const n = b.until(end).days + 1;
  const days = Array.from({ length: n }, (_, i) => {
    const d = b.add({ days: i });
    return { d: gtfsDate(d.toString()), wd: WEEKDAYS[d.dayOfWeek - 1]! };
  });
  const out = new Map<string, Set<number>>();
  const get = (id: string) => {
    let set = out.get(id);
    if (!set) out.set(id, (set = new Set()));
    return set;
  };
  for (const r of table(src, "calendar")) {
    const set = get(r.service_id!);
    days.forEach(({ d, wd }, i) => {
      if (r[wd] === "1" && r.start_date! <= d && d <= r.end_date!) set.add(i);
    });
  }
  const index = new Map(days.map(({ d }, i) => [d, i]));
  for (const r of table(src, "calendar_dates")) {
    const i = index.get(r.date!);
    if (i === undefined) continue;
    if (r.exception_type === "1") get(r.service_id!).add(i);
    else if (r.exception_type === "2") get(r.service_id!).delete(i);
  }
  return out;
}

/** Loads all rail trips running on `day`, or all rail trips of the feed if `day` is null. */
export function loadFeed(src: Source, day: string | null): Feed {
  const stations = new Map<string, Station>();
  const parentOf = new Map<string, string>();
  const orphans: Station[] = [];
  for (const r of table(src, "stops")) {
    const id = r.stop_id!;
    const st = {
      id,
      name: shortStationName(r.stop_name!),
      lat: Number(r.stop_lat),
      lon: Number(r.stop_lon),
    };
    if (r.location_type === "1") {
      stations.set(id, st);
      parentOf.set(id, id);
    } else if (r.parent_station) {
      parentOf.set(id, r.parent_station);
    } else {
      // some platforms (e.g. Feldkirch, Bludenz) lack parent_station: derive the
      // parent DHID from the stop DHID (`at:48:817:0:2` → `Pat:48:817`); a stop with a
      // station-level DHID (Germany: Hannover Hbf `de:03241:31`) is its own station
      const parent = /^[a-z]{2}:[^:]+:[^:]+$/.test(id) ? id : parentDhid(id);
      parentOf.set(id, parent);
      orphans.push({ ...st, id: parent });
    }
  }
  for (const o of orphans) if (!stations.has(o.id)) stations.set(o.id, o);

  const busRoutes = new Set<string>();
  for (const r of table(src, "routes")) {
    // 2 = rail; 3 = bus (Schienenersatzverkehr), everything else non-rail too
    if (r.route_type !== "2" && !(Number(r.route_type) >= 100 && Number(r.route_type) < 200)) {
      busRoutes.add(r.route_id!);
    }
  }

  const services = day === null ? null : activeServices(src, day);
  const trips = new Map<string, Trip>();
  for (const r of table(src, "trips")) {
    if ((services && !services.has(r.service_id!)) || busRoutes.has(r.route_id!)) continue;
    const short = (r.trip_short_name ?? "").trim();
    if (!short) continue;
    // category and number ("RJX 760"); trains with a bare number (some SŽ / HŽ trains) are left
    // out, as in the trains index
    const m = /^(\S+)\s+(.+)$/.exec(short);
    if (!m) continue;
    trips.set(r.trip_id!, {
      id: r.trip_id!,
      cat: m[1]!,
      nr: m[2]!,
      headsign: shortStationName(r.trip_headsign ?? ""),
      routeId: r.route_id!,
      service: r.service_id!,
      ...(r.shape_id ? { shape: r.shape_id } : {}),
      stops: [],
    });
  }

  const seq = new Map<Trip, number[]>();
  for (const r of table(src, "stop_times")) {
    const trip = trips.get(r.trip_id!);
    if (!trip) continue;
    const arr = parseGtfsTime(r.arrival_time || r.departure_time!);
    const dep = parseGtfsTime(r.departure_time || r.arrival_time!);
    trip.stops.push({
      st: parentOf.get(r.stop_id!) ?? r.stop_id!,
      arr,
      dep,
      dist: r.shape_dist_traveled ? Number(r.shape_dist_traveled) : NaN,
    });
    let s = seq.get(trip);
    if (!s) seq.set(trip, (s = []));
    s.push(Number(r.stop_sequence));
  }
  // stop_times.txt is not guaranteed to be sorted
  for (const [trip, s] of seq) {
    if (s.every((v, i) => i === 0 || v >= s[i - 1]!)) continue;
    const order = s.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
    trip.stops = order.map(([, i]) => trip.stops[i]!);
  }
  return { stations, trips: [...trips.values()].filter((t) => t.stops.length >= 2) };
}

/** Great-circle distance in km. */
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Route geometry of a GTFS shape (points in travel order). */
export interface Shape {
  lat: Float32Array;
  lon: Float32Array;
  /** shape_dist_traveled in metres (NaN if absent) */
  dist: Float32Array;
}

/**
 * Loads the given shapes from `shapes.txt`, streamed (the ÖBB file is ~600 MB uncompressed):
 * env GTFS_DIR (unzipped) or the zip of {@link feedZip}.
 */
export async function loadShapes(ids: Set<string>): Promise<Map<string, Shape>> {
  const pts = new Map<string, { seq: number[]; lat: number[]; lon: number[]; dist: number[] }>();
  let rest = "";
  let header: string[] | undefined;
  const col: Record<string, number> = {};
  const line = (l: string) => {
    if (!l) return;
    const f = l.split(",").map((x) => (x.startsWith('"') ? x.slice(1, -1) : x));
    if (!header) {
      header = f.map((h) => h.replace(/^﻿/, ""));
      header.forEach((h, i) => (col[h] = i));
      return;
    }
    const id = f[col.shape_id!]!;
    if (!ids.has(id)) return;
    let p = pts.get(id);
    if (!p) pts.set(id, (p = { seq: [], lat: [], lon: [], dist: [] }));
    p.seq.push(Number(f[col.shape_pt_sequence!]));
    p.lat.push(Number(f[col.shape_pt_lat!]));
    p.lon.push(Number(f[col.shape_pt_lon!]));
    const d = f[col.shape_dist_traveled!];
    p.dist.push(d ? Number(d) : NaN);
  };
  const text = (chunk: string, final: boolean) => {
    const lines = (rest + chunk).split(/\r?\n/);
    rest = final ? "" : lines.pop()!;
    for (const l of lines) line(l);
  };
  const feed = process.env.GTFS_DIR ? undefined : await feedZip();
  // an unpacked feed (GTFS_DIR, or the country's feed is a directory: the German rail extract)
  const dir = process.env.GTFS_DIR ?? (feed && statSync(feed).isDirectory() ? feed : undefined);
  if (dir) {
    const p = join(dir, "shapes.txt");
    if (existsSync(p)) for (const c of textChunks(readFileSync(p))) text(c, false);
    text("", true);
  } else {
    const zip = readFileSync(feed!);
    await new Promise<void>((resolve, reject) => {
      const decoder = new TextDecoder();
      const uz = new Unzip();
      uz.register(UnzipInflate);
      let found = false;
      uz.onfile = (f) => {
        if (!f.name.endsWith("shapes.txt")) return;
        found = true;
        f.ondata = (err, data, final) => {
          if (err) return reject(err);
          text(decoder.decode(data, { stream: !final }), final);
          if (final) resolve();
        };
        f.start();
      };
      const CHUNK = 1 << 20;
      for (let i = 0; i < zip.length; i += CHUNK)
        uz.push(zip.subarray(i, i + CHUNK), i + CHUNK >= zip.length);
      if (!found) resolve();
    });
  }
  const out = new Map<string, Shape>();
  for (const [id, p] of pts) {
    const order = p.seq.map((_, i) => i).sort((a, b) => p.seq[a]! - p.seq[b]!);
    out.set(id, {
      lat: Float32Array.from(order, (i) => p.lat[i]!),
      lon: Float32Array.from(order, (i) => p.lon[i]!),
      dist: Float32Array.from(order, (i) => p.dist[i]!),
    });
  }
  return out;
}

/**
 * Smallest distance (km) between a point and the part of a shape between two track positions
 * (shape_dist_traveled, metres); the whole shape if the positions are unknown.
 */
export function shapeDistanceKm(
  shape: Shape,
  lat: number,
  lon: number,
  fromM = NaN,
  toM = NaN,
): number {
  const n = shape.lat.length;
  let i0 = 0;
  let i1 = n - 1;
  if (Number.isFinite(fromM) && Number.isFinite(toM)) {
    const [lo, hi] = fromM < toM ? [fromM, toM] : [toM, fromM];
    while (i0 < n - 1 && !(shape.dist[i0 + 1]! >= lo)) i0++;
    while (i1 > 0 && !(shape.dist[i1 - 1]! <= hi)) i1--;
    if (i1 <= i0) [i0, i1] = [0, n - 1];
  }
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  const ky = 110.57;
  let best = Infinity;
  for (let i = i0; i < i1; i++) {
    const ax = (shape.lon[i]! - lon) * kx;
    const ay = (shape.lat[i]! - lat) * ky;
    const bx = (shape.lon[i + 1]! - lon) * kx;
    const by = (shape.lat[i + 1]! - lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  if (i1 === i0) best = Math.hypot((shape.lon[i0]! - lon) * kx, (shape.lat[i0]! - lat) * ky);
  return best;
}

/**
 * Closest point of a shape to a station: distance (km) and position along the shape
 * (shape_dist_traveled, metres; NaN if the shape has no distances).
 */
export function shapeProjection(
  shape: Shape,
  lat: number,
  lon: number,
  /** segments farther than this (km) on one side are skipped quickly */
  near = 5,
): { km: number; alongM: number } {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
  const ky = 110.57;
  let best = Infinity;
  let along = NaN;
  for (let i = 0; i + 1 < shape.lat.length; i++) {
    const ay = (shape.lat[i]! - lat) * ky;
    const by = (shape.lat[i + 1]! - lat) * ky;
    if ((ay > near && by > near) || (ay < -near && by < -near)) continue;
    const ax = (shape.lon[i]! - lon) * kx;
    const bx = (shape.lon[i + 1]! - lon) * kx;
    if ((ax > near && bx > near) || (ax < -near && bx < -near)) continue;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < best) {
      best = d;
      along = shape.dist[i]! + t * (shape.dist[i + 1]! - shape.dist[i]!);
    }
  }
  return { km: best, alongM: along };
}
