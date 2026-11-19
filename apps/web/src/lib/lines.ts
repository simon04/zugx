// Regional line per train from the timetable ("S 4017" → "S 1"), for the GTFS-based views, which
// only know category and train number (packages/trains/data[/<country>]/lines-<year>.toml, loaded on
// first use; the newest file of every country, merged: the categories with lines differ per country).
import { shallowRef } from "vue";

const files = import.meta.glob<{ default: Record<string, string> }>(
  "../../../../packages/trains/data/**/lines-*.toml",
);
const map = shallowRef<Record<string, string>>();
let loading: Promise<void> | undefined;
/** categories with lines (Spain: C Cercanías/Rodalies, lines C1, R2N …) */
const LINE_CATS = new Set(["S", "R", "REX", "CJX", "C"]);

function load() {
  loading ??= (async () => {
    const newest = new Map<string, string>();
    for (const p of Object.keys(files).sort()) newest.set(p.replace(/lines-\d+\.toml$/, ""), p);
    const maps = await Promise.all(
      [...newest.values()].map(async (p) => (await files[p]!()).default),
    );
    map.value = Object.assign({}, ...maps);
  })();
  return loading;
}

/** the line of a regional train ("S", "4017" → "S 1"), undefined if unknown (or still loading) */
export function lineFor(cat: string, nr: string): string | undefined {
  if (!LINE_CATS.has(cat.toUpperCase())) return undefined;
  if (!map.value) {
    void load();
    return undefined;
  }
  return map.value[`${cat.toUpperCase()} ${nr}`];
}
