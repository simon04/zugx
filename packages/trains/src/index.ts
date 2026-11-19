// Train index ("Zugindex") types and helpers. Pure module, safe for the browser.
import { LONG_DISTANCE_CATEGORIES } from "@zugx/gtfs/categories";

export {
  CATEGORY_ORDER,
  LONG_DISTANCE_CATEGORIES,
  NIGHT_CATEGORIES,
  compareCategories,
  parseTrainName,
} from "@zugx/gtfs/categories";

/**
 * A stop of the main route: HAFAS station id, planned time "HH:MM" (departure for `from`, arrival
 * for `to`) and, if the time is after midnight of the service day, the day offset (1 = next day).
 */
export type StopRef = [id: string, time: string] | [id: string, time: string, dayOffset: number];

export interface TrainEntry {
  /** operator slug, e.g. "oebb", "montafonerbahn", "cat" */
  op: string;
  /** category, e.g. "RJX" */
  cat: string;
  /** train number, e.g. "260" */
  nr: string;
  /** train name, e.g. "Transalpin" (long-distance trains only, from HAFAS) */
  name?: string;
  /** first stop of the main route (most frequent stop pattern) */
  from: StopRef;
  /** last stop of the main route */
  to: StopRef;
  /** key intermediate stops (major hubs) of the main route, in route order, max 6 */
  via: string[];
  /** all intermediate stops of the main route, in route order (superset of `via`) */
  stops: string[];
  /**
   * running days: base64 bitset over the timetable year, bit i = day `begin + i`;
   * bit i is `(byte[i >> 3] >> (7 - (i & 7))) & 1` (MSB first, like HAFAS sDaysB)
   */
  days: string;
  /** number of running days */
  n: number;
  /** first / last running day (ISO) */
  first: string;
  last: string;
  /** number of different stop patterns over the year (omitted if 1) */
  var?: number;
}

export interface TrainIndex {
  /** timetable year, e.g. 2026 */
  year: number;
  /** first / last day of the timetable year (ISO), e.g. "2025-12-14" / "2026-12-12" */
  begin: string;
  end: string;
  source: string;
  /** names of all station ids referenced in this file */
  stations: Record<string, string>;
  /** sorted by category, then number */
  trains: TrainEntry[];
}

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeDays(dayIndexes: Iterable<number>, length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 8));
  for (const i of dayIndexes) {
    if (i < 0 || i >= length) continue;
    bytes[i >> 3]! |= 0x80 >> (i & 7);
  }
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Day indexes (0 = `begin`) set in a running-days bitset. */
export function dayIndexes(base64: string): number[] {
  const bytes = decodeBase64(base64);
  const out: number[] = [];
  for (let i = 0; i < bytes.length * 8; i++) if ((bytes[i >> 3]! >> (7 - (i & 7))) & 1) out.push(i);
  return out;
}

const isoAdd = (begin: string, days: number) =>
  Temporal.PlainDate.from(begin).add({ days }).toString();

/** Decode a running-days bitset into ISO dates. */
export function decodeDays(base64: string, begin: string): Set<string> {
  return new Set(dayIndexes(base64).map((i) => isoAdd(begin, i)));
}

/** Does the train run on `isoDate` (service day, "YYYY-MM-DD")? */
export function runsOn(entry: Pick<TrainEntry, "days">, isoDate: string, begin: string): boolean {
  let i: number;
  try {
    i = Temporal.PlainDate.from(begin).until(isoDate).days;
  } catch {
    return false; // not a date
  }
  if (i < 0) return false;
  const bytes = decodeBase64(entry.days);
  if (i >= bytes.length * 8) return false;
  return ((bytes[i >> 3]! >> (7 - (i & 7))) & 1) === 1;
}

const longDistance = new Set(LONG_DISTANCE_CATEGORIES);

/** Is this a long-distance / night train (i.e. part of the default index)? */
export const isLongDistance = (e: { cat: string }) => longDistance.has(e.cat);

/** a stop of a run: station id, arrival and departure in minutes after midnight of the start day */
export type RunStop = [id: string, arr: number, dep: number];
/** a train's stops with times on a set of days (runs-<year>/<nn>.toml, Country.trainRuns) */
export interface TrainRun {
  /** running days, base64 bitset from the file's `begin` (like TrainEntry.days) */
  days: string;
  stops: RunStop[];
}
/** a runs file: the trains whose numbers end in its two digits */
export interface RunsFile {
  year: number;
  begin: string;
  end: string;
  source: string;
  /** names of stations outside the country's station index */
  stations: Record<string, string>;
  trains: Record<string, TrainRun[]>;
}
/** the runs file of a train number: its last two digits ("19799" → "99", "7" → "07") */
export const runsBucket = (nr: string) => nr.replace(/\D/g, "").padStart(2, "0").slice(-2);
