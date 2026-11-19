// Trains HAFAS doesn't know (Spain: Cercanías) from the timetable: their stops and times on a day
// from packages/trains/data/<country>/runs-<year>/<nn>.toml (trains:build, Country.trainRuns), as
// a Trip without realtime data, so the train page can show them like any other.
import type { Line, ProductId, Trip } from "@zugx/hafas";
import { runsBucket, runsOn, type RunsFile } from "@zugx/trains";
import { COUNTRIES, countryOfPath } from "./country.ts";
import { LONG_DISTANCE, NIGHT, REGIONAL, SUBURBAN } from "./products.ts";
import { loadStations, stationById } from "./stations.ts";

const files = import.meta.glob<{ default: RunsFile }>(
  "../../../../packages/trains/data/**/runs-*/*.toml",
);

function productOf(cat: string): ProductId {
  if (NIGHT.has(cat)) return "night";
  if (cat === "AVE" || cat === "AVLO") return "highspeed";
  if (LONG_DISTANCE.has(cat)) return "intercity";
  if (SUBURBAN.has(cat)) return "suburban";
  if (REGIONAL.has(cat)) return "regional";
  return "other";
}

/**
 * a train ("C 19799", or the bare number) on `date` (YYYY-MM-DD) from the timetable, undefined if
 * no runs file has it on that day
 */
export async function timetableTrip(name: string, date: string): Promise<Trip | undefined> {
  const [cat, nr] = name.includes(" ") ? (name.split(" ") as [string, string]) : ["", name];
  const bucket = runsBucket(nr);
  const paths = Object.keys(files).filter((p) => p.endsWith(`/${bucket}.toml`));
  if (!paths.length) return undefined;
  const [, ...loaded] = await Promise.all([
    loadStations(),
    ...paths.map(async (p) => ({ p, f: (await files[p]!()).default })),
  ]);
  for (const { p, f } of loaded) {
    const key = Object.keys(f.trains).find(
      (k) => k.endsWith(` ${nr}`) && (!cat || k.split(" ")[0] === cat.toUpperCase()),
    );
    const run = key && f.trains[key]!.find((r) => runsOn(r, date, f.begin));
    if (!key || !run) continue;
    const country = COUNTRIES.find((c) => c.id === countryOfPath(p));
    const midnight = Temporal.PlainDate.from(date).toZonedDateTime({
      timeZone: country?.timezone ?? "Europe/Vienna",
    });
    const at = (min: number) =>
      midnight.add({ minutes: min }).toString({ timeZoneName: "never", smallestUnit: "minute" });
    const [c] = key.split(" ") as [string];
    const line: Line = {
      name: key,
      category: c,
      number: nr,
      cls: 0,
      product: productOf(c),
      operator: f.source.replace(/\s*\(.*$/, "").replace(/\s+\d{4}$/, ""),
    };
    const stopovers = run.stops.map(([id, arr, dep], i) => {
      const s = stationById(id);
      return {
        stop: {
          id,
          name: s?.name ?? f.stations[id] ?? id,
          type: "station" as const,
          ...(s ? { lat: s.lat, lon: s.lon } : {}),
        },
        ...(i > 0 ? { arr: { planned: at(arr) } } : {}),
        ...(i < run.stops.length - 1 ? { dep: { planned: at(dep) } } : {}),
      };
    });
    return {
      journeyId: `timetable:${key}:${date}`,
      date: date.replaceAll("-", ""),
      line,
      direction: stopovers.at(-1)!.stop.name,
      stopovers,
      remarks: [],
    };
  }
  return undefined;
}
