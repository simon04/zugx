// The countries zugx builds data for (packages/gtfs/countries.toml) and the paths per country.
// Every data script works on one country, chosen with the environment variable COUNTRY (default
// "at", which keeps the original paths, so the Austrian data stays byte-identical).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fromToml } from "@zugx/toml";
import { CACHE_DIR, REPO_ROOT } from "./feed.ts";

export interface Country {
  id: string;
  /** name per app language (UI, data headers) */
  name: { de: string; en: string; it: string; sl: string; es: string };
  /** UIC country code: station ids (HAFAS/UIC) of this country start with it, e.g. "81" */
  uic: string;
  timezone: string;
  /** GTFS feeds (URLs or paths), merged; overridable with GTFS_ZIP */
  feeds: string[];
  /** Geofabrik extract name; the newest `.cache/<osm>-YYMMDD.osm.pbf` is used */
  osm: string;
  /** pattern of the national railway line numbers in OSM (`route=tracks` ref), e.g. "101 01" */
  lineRef: string;
  /**
   * keep sidings and yard tracks that a line relation (`route=tracks`) lists (where
   * through-station tracks are mapped as sidings); off for Austria, whose relations also list real
   * sidings. Tracks under construction listed by a relation are kept in every country.
   */
  osmLineMembers?: boolean;
  /**
   * stations HAFAS doesn't know: id = this prefix + their GTFS stop id, if the stop id is a
   * national station code that HAFAS numbers the same way (Spain: "71" + ADIF code, Gualba 79105
   * → 7179105) and the station lies inside the country. Without it they are left out.
   */
  localStationPrefix?: string;
  /** reference day of the timetable sheets (a regular Tuesday; default: netz DEFAULT_DAY) */
  day?: string;
  /** licence of the timetable data, for the data files and the attribution */
  licence: { name: string; url: string; source: string; page: string };
  /** SQL run on the country's database after the import (feed quirks → the expected shape) */
  fixups?: string[];
}

export const COUNTRIES: Record<string, Country> = Object.fromEntries(
  Object.entries(
    fromToml<Record<string, Omit<Country, "id">>>(
      readFileSync(join(import.meta.dirname, "..", "countries.toml"), "utf8"),
    ),
  ).map(([id, c]) => [id, { id, ...c }]),
);

/** the country of this run (COUNTRY, default "at") */
export function currentCountry(env = process.env): Country {
  const id = (env.COUNTRY ?? "at").toLowerCase();
  const c = COUNTRIES[id];
  if (!c) throw new Error(`unknown COUNTRY "${id}" (known: ${Object.keys(COUNTRIES).join(", ")})`);
  return c;
}

/**
 * a package's data directory for a country: `packages/<pkg>/data` for Austria (the original
 * layout), `packages/<pkg>/data/<country>` for the others
 */
export function dataDir(pkg: string, c: Country = currentCountry()): string {
  const base = join(REPO_ROOT, "packages", pkg, "data");
  return c.id === "at" ? base : join(base, c.id);
}

/** the country's local SQLite (.cache/zugx.sqlite for Austria, .cache/zugx-<id>.sqlite else) */
export function dbPath(c: Country = currentCountry()): string {
  return join(CACHE_DIR, c.id === "at" ? "zugx.sqlite" : `zugx-${c.id}.sqlite`);
}

/** the newest Geofabrik extract of the country in .cache (`<osm>-YYMMDD.osm.pbf`) */
export function osmPbf(c: Country = currentCountry()): string {
  const re = new RegExp(`^${c.osm}-\\d{6}\\.osm\\.pbf$`);
  const f = existsSync(CACHE_DIR)
    ? readdirSync(CACHE_DIR)
        .filter((n) => re.test(n))
        .sort()
        .at(-1)
    : undefined;
  if (!f)
    throw new Error(
      `no OSM extract for ${c.id}: download https://download.geofabrik.de/europe/${c.osm}-latest.osm.pbf to ${CACHE_DIR}/${c.osm}-YYMMDD.osm.pbf`,
    );
  return join(CACHE_DIR, f);
}

/** the rail extract of the OSM data (vzg:extract; .cache/osm-rail.json for Austria) */
export function osmRailPath(c: Country = currentCountry()): string {
  return join(CACHE_DIR, c.id === "at" ? "osm-rail.json" : `osm-rail-${c.id}.json`);
}

/** source line of the timetable data, e.g. "ÖBB GTFS 2026 (CC BY 4.0)" */
export function sourceLabel(year: number | string, c: Country = currentCountry()): string {
  return `${c.licence.source} ${year} (${c.licence.name})`;
}
