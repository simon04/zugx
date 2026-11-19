/** One rail station in Austria, as stored in `@zugx/stations/stations.toml`. */
export interface Station {
  /** HAFAS station id (extId / IBNR), e.g. "8103000" */
  id: string;
  /** HAFAS name, cleaned (no platform suffixes), e.g. "Wien Hbf" */
  name: string;
  lat: number;
  lon: number;
  /** categories of trains stopping here, long-distance → regional, e.g. ["RJX", "RJ", "REX", "S"] */
  p: string[];
  /** importance 1–1000 (log scale of rail departures per year) */
  w: number;
  /** other names (e.g. the open data name), if really different */
  alias?: string[];
  /** not in HAFAS (timetable data only): no live board, journeys, or HAFAS lookups */
  local?: boolean;
}

/** Entry of `data/gtfs-hafas-map.toml`: GTFS station (parent DHID) → HAFAS station. */
export interface GtfsHafasEntry {
  /** HAFAS id, null if no match was found */
  id: string | null;
  /** raw HAFAS name */
  name?: string;
  lat?: number;
  lon?: number;
  /** HAFAS product class bitmask */
  p?: number;
  /** distance GTFS → HAFAS in metres */
  d?: number;
  /** GTFS station name */
  gtfs: string;
  /** ISO date of the last lookup (for retrying unmatched stations) */
  checked?: string;
  /** not in HAFAS: id from the GTFS stop id (Country.localStationPrefix), name from the GTFS */
  local?: boolean;
}

export type GtfsHafasMap = Record<string, GtfsHafasEntry>;
