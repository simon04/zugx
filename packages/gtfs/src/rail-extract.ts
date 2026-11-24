// Rail-only extract of a large all-modes GTFS feed (Germany: DELFI, 4.9 GB unpacked, mostly bus):
// keeps the rail routes (route_type 2 and 100–117), their trips, stop times, shapes, services and
// agencies, and the stops they use with their parent stations. Writes plain CSV files into a
// directory, which db:build imports like a zip. Streams the zip twice (trips.txt comes after
// stop_times.txt), never unpacking it.
// Run: vp run gtfs:rail -- <feed.zip> <out dir>   (Germany: … .cache/de-rail)
import { createWriteStream, mkdirSync, rmSync, type WriteStream } from "node:fs";
import { join, resolve } from "node:path";
import { CsvParser } from "./csv.ts";
import { timer } from "./util.ts";
import { streamZip, type EntrySink } from "./zip.ts";

const isRail = (type: string) => type === "2" || (Number(type) >= 100 && Number(type) <= 117);

/** CSV field, quoted when needed */
const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);

/** a record's field by column name */
type Row = (col: string) => string;

/** a sink parsing one CSV entry: `onRow` gets each record (fields by column name, and raw) */
function csvSink(onRow: (r: Row, raw: string[]) => void, onEnd?: () => void) {
  let header: string[] | undefined;
  let idx = new Map<string, number>();
  let raw: string[] = [];
  const get: Row = (col) => raw[idx.get(col) ?? -1] ?? "";
  const parser = new CsvParser((row) => {
    if (!header) {
      header = row;
      idx = new Map(row.map((h, i) => [h, i]));
      return;
    }
    raw = row;
    onRow(get, row);
  });
  const dec = new TextDecoder();
  const sink: EntrySink & { header: () => string[] | undefined } = {
    data: (chunk) => parser.push(dec.decode(chunk, { stream: true })),
    end: () => {
      parser.push(dec.decode());
      parser.end();
      onEnd?.();
    },
    header: () => header,
  };
  return sink;
}

/** a sink copying the rows `keep` accepts into out/<name> */
function filterSink(out: string, name: string, keep: (r: Row) => boolean) {
  let w: WriteStream | undefined;
  let n = 0;
  let headerWritten = false;
  const sink = csvSink(
    (r, raw) => {
      w ??= createWriteStream(join(out, name));
      if (!headerWritten) {
        w.write(sink.header()!.map(cell).join(",") + "\n");
        headerWritten = true;
      }
      if (!keep(r)) return;
      w.write(raw.map(cell).join(",") + "\n");
      n++;
    },
    () => {
      w?.end();
      console.log(`rail: ${name}: ${n} rows`);
    },
  );
  return sink;
}

async function main() {
  const [zipArg, outArg] = process.argv.slice(2).filter((a) => a !== "--");
  if (!zipArg || !outArg) throw new Error("usage: gtfs:rail <feed.zip> <out dir>");
  const zip = resolve(zipArg);
  const out = resolve(outArg);
  const t = timer();
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  // pass 1: rail routes and their trips
  const routes = new Set<string>();
  const agencies = new Set<string>();
  const trips = new Set<string>();
  const services = new Set<string>();
  const shapes = new Set<string>();
  const routeRows: string[][] = [];
  let routeHeader: string[] = [];
  const routeSink = csvSink((r, raw) => {
    if (!isRail(r("route_type"))) return;
    routes.add(r("route_id"));
    agencies.add(r("agency_id"));
    routeRows.push(raw);
  });
  const tripSink = filterSink(out, "trips.txt", (r) => {
    if (!routes.has(r("route_id"))) return false;
    trips.add(r("trip_id"));
    services.add(r("service_id"));
    if (r("shape_id")) shapes.add(r("shape_id"));
    return true;
  });
  // routes.txt precedes trips.txt in the DELFI zip; trips are kept only once routes are known
  await streamZip(zip, (name) => {
    if (name === "routes.txt") return routeSink;
    if (name === "trips.txt") return tripSink;
    return undefined;
  });
  routeHeader = routeSink.header() ?? [];
  const rw = createWriteStream(join(out, "routes.txt"));
  rw.write(routeHeader.map(cell).join(",") + "\n");
  for (const r of routeRows) rw.write(r.map(cell).join(",") + "\n");
  rw.end();
  console.log(
    `rail: ${routes.size} routes, ${trips.size} trips, ${services.size} services (${t()})`,
  );

  // pass 2: everything that hangs off them; stops are buffered to add the parents of used ones
  const usedStops = new Set<string>();
  const stopRows = new Map<string, { parent: string; raw: string[] }>();
  const stopSink = csvSink((r, raw) =>
    stopRows.set(r("stop_id"), { parent: r("parent_station"), raw }),
  );
  const keepService = (r: Row) => services.has(r("service_id"));
  const sinks: Record<string, EntrySink> = {
    "agency.txt": filterSink(out, "agency.txt", (r) => agencies.has(r("agency_id"))),
    "calendar.txt": filterSink(out, "calendar.txt", keepService),
    "calendar_dates.txt": filterSink(out, "calendar_dates.txt", keepService),
    "feed_info.txt": filterSink(out, "feed_info.txt", () => true),
    "shapes.txt": filterSink(out, "shapes.txt", (r) => shapes.has(r("shape_id"))),
    "stop_times.txt": filterSink(out, "stop_times.txt", (r) => {
      if (!trips.has(r("trip_id"))) return false;
      usedStops.add(r("stop_id"));
      return true;
    }),
    "stops.txt": stopSink,
  };
  await streamZip(zip, (name) => sinks[name]);
  const keep = new Set<string>();
  for (const id of usedStops) {
    for (let s: string | undefined = id; s && !keep.has(s); s = stopRows.get(s)?.parent)
      keep.add(s);
  }
  const sw = createWriteStream(join(out, "stops.txt"));
  sw.write((stopSink.header() ?? []).map(cell).join(",") + "\n");
  for (const [id, { raw }] of stopRows) if (keep.has(id)) sw.write(raw.map(cell).join(",") + "\n");
  sw.end();
  console.log(`rail: stops.txt: ${keep.size} of ${stopRows.size} stops; done in ${t()}`);
}

await main();
