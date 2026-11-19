// Build data/lines-<year>.toml: the regional line of each train ("S 4017" = "S 1",
// "REX 22332" = "REX 1"), from the GTFS route_short_name (S1, REX1, RX50 …). Live data (HAFAS)
// has both line and train number; the timetable views (Abfahrtsplan, Bildfahrplan, Kursbuch) only
// the train number — this fills in the line. Trains in several lines over the year: the most
// frequent. One train per line (diffable). Reads the local SQLite (vp run db:build).
// Run: vp run lines:build
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { currentCountry, dataDir, feedYear, parseTrainName, timer } from "@zugx/gtfs";
import { openZugxDb, RAIL_ROUTE_TYPES, rows, serviceDays } from "@zugx/db/query";

const COUNTRY = currentCountry();
const DATA = dataDir("trains", COUNTRY);

/** route_short_name → line for a category: "S1" → "S 1", "RX50" for REX → "REX 50" */
export function lineOf(cat: string, routeShort: string): string | undefined {
  // Spain: Cercanías/Rodalies trains ("C 19799") run in lines named as Renfe writes them (C1, C4a,
  // R2N, RG1, T1)
  if (cat === "C")
    return /^[A-Z]{1,2}\d+[A-Za-z]{0,2}$/.test(routeShort.trim()) ? routeShort.trim() : undefined;
  const m = /^([A-Z]+)(\d+)$/.exec(routeShort.trim());
  if (!m) return undefined;
  const rc = m[1] === "RX" ? "REX" : m[1];
  return rc === cat ? `${cat} ${m[2]}` : undefined;
}

function main() {
  const t = timer();
  const db = openZugxDb();
  const year = Number(process.env.TRAINS_YEAR) || feedYear({ services: serviceDays(db) });
  // trips per train and route short name (rail, with a train name)
  const trips = rows<{ name: string; route: string; n: number }>(
    db,
    // in file order (rowid) of each group's first trip: ties go to the line seen first
    `select trim(t.trip_short_name) name, r.route_short_name route, count(*) n
       from trips t join routes r using (route_id)
      where ${RAIL_ROUTE_TYPES} and trim(coalesce(t.trip_short_name, '')) <> ''
      group by 1, 2
      order by min(t.rowid)`,
  );
  // train → line → number of trips
  const votes = new Map<string, Map<string, number>>();
  for (const { name, route, n } of trips) {
    const tn = parseTrainName(name);
    const line = tn && route ? lineOf(tn.cat, route) : undefined;
    if (!tn || !line) continue;
    const key = `${tn.cat} ${tn.nr}`;
    const m = votes.get(key) ?? new Map<string, number>();
    m.set(line, (m.get(line) ?? 0) + n);
    votes.set(key, m);
  }
  const out = [...votes]
    .map(([k, m]) => [k, [...m].sort((a, b) => b[1] - a[1])[0]![0]] as const)
    .sort((a, b) => a[0].localeCompare(b[0], "en", { numeric: true }));
  const file = join(DATA, `lines-${year}.toml`);
  if (!out.length) {
    console.log(`lines: ${COUNTRY.id}: no regional lines in the route names — nothing written`);
    return;
  }
  writeFileSync(
    file,
    `# regional line per train, from the ${COUNTRY.licence.source} route_short_name (${COUNTRY.licence.name}); built by packages/trains/src/lines.ts\n${out
      .map(([k, l]) => `${JSON.stringify(k)} = ${JSON.stringify(l)}`)
      .join("\n")}\n`,
  );
  console.log(`lines: ${out.length} trains with a line → ${file} (${t()})`);
}

if (import.meta.main) main();
