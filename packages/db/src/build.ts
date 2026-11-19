// Build the country's SQLite (COUNTRY, default at → .cache/zugx.sqlite): import its GTFS feeds
// (country.ts; GTFS_ZIP overrides) with node-gtfs into its standard tables, then run the country's
// SQL fix-ups, then interpolate stop times the feed leaves empty (interpolate.ts). Skipped: shapes (≈ 95 % of the ÖBB feed; not needed for the
// exports yet), pathways and levels (station walkways; the ÖBB pathways fail node-gtfs's checks,
// traversal_time 0). Run: vp run db:build
import { rmSync } from "node:fs";
import { importGtfs } from "gtfs";
import { currentCountry, fetchFeeds, timer } from "@zugx/gtfs";
import { DB_PATH } from "./index.ts";
import { interpolateStopTimes } from "./interpolate.ts";
import { openZugxDb } from "./query.ts";

async function main() {
  const t = timer();
  const feeds = await fetchFeeds();
  rmSync(DB_PATH, { force: true });
  await importGtfs({
    sqlitePath: DB_PATH,
    agencies: feeds.map((f) => ({ path: f.path, exclude: ["shapes", "pathways", "levels"] })),
    // several feeds of one country may share rows (Renfe: AV/LD/MD and Cercanías list the same
    // stations under the same ADIF ids): the first feed's row is kept
    ignoreDuplicates: feeds.length > 1,
    verbose: true,
  });
  const country = currentCountry();
  const db = openZugxDb(DB_PATH);
  for (const sql of country.fixups ?? []) {
    const r = db.prepare(sql).run();
    console.log(`db: fix-up: ${r.changes} rows — ${sql.replace(/\s+/g, " ").slice(0, 80)}…`);
  }
  const filled = interpolateStopTimes(db);
  if (filled) console.log(`db: ${filled} stop times without a time interpolated`);
  console.log(`db: ${country.id}: ${feeds.length} feed(s) → ${DB_PATH} (${t()})`);
}

if (import.meta.main) await main();
