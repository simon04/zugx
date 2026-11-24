// Regional line per train from the timetable ("S 4017" → "S 1"), for the GTFS-based views, which
// only know category and train number (packages/trains/data[/<country>]/lines-<year>.toml, loaded on
// first use; the newest file of every country, each on its own: a train number may exist in several
// countries — the selected country's line wins; a country whose file fails is left out).
import { shallowRef } from "vue";
import { loadPerCountry } from "./country.ts";

const files = import.meta.glob<{ default: Record<string, string> }>(
  "../../../../packages/trains/data/**/lines-*.toml",
);
/** per country, the selected one first */
const maps = shallowRef<Record<string, string>[]>();
let loading: Promise<void> | undefined;
/** categories with lines (Spain: C Cercanías/Rodalies, lines C1, R2N …; Germany: RE 1, RB 54, MEX 13) */
const LINE_CATS = new Set(["S", "R", "REX", "CJX", "C", "RE", "RB", "IRE", "MEX", "FEX"]);

function load() {
  loading ??= (async () => {
    const newest = new Map<string, string>();
    for (const p of Object.keys(files).sort()) newest.set(p.replace(/lines-\d+\.toml$/, ""), p);
    const loaded = await loadPerCountry(
      [...newest.values()].map((p) => [p, async () => (await files[p]!()).default] as const),
    );
    maps.value = loaded.map(([, m]) => m);
  })();
  return loading;
}

/** the line of a regional train ("S", "4017" → "S 1"), undefined if unknown (or still loading) */
export function lineFor(cat: string, nr: string): string | undefined {
  if (!LINE_CATS.has(cat.toUpperCase())) return undefined;
  if (!maps.value) {
    void load();
    return undefined;
  }
  const key = `${cat.toUpperCase()} ${nr}`;
  for (const m of maps.value) if (m[key]) return m[key];
  return undefined;
}
