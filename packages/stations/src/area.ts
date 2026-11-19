// Is a point inside a country? From the country's boundary in the VzG data
// (packages/vzg/data[/<country>]/boundaries.toml, from OSM, simplified): for stops HAFAS doesn't
// know, whose country can't be read from a HAFAS id.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { dataDir, type Country } from "@zugx/gtfs";
import { decodePolyline } from "@zugx/hafas";
import { readToml } from "@zugx/toml";

interface Boundaries {
  areas: { code: string; rings: string[] }[];
}

/** even-odd rule over all rings (outer rings and holes alike) */
function inRings(rings: [number, number][][], lat: number, lon: number): boolean {
  let inside = false;
  for (const r of rings)
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [yi, xi] = r[i]!;
      const [yj, xj] = r[j]!;
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
        inside = !inside;
    }
  return inside;
}

/** a test for points inside the country, undefined if its boundary hasn't been extracted */
export function countryArea(c: Country): ((lat: number, lon: number) => boolean) | undefined {
  const file = join(dataDir("vzg", c), "boundaries.toml");
  if (!existsSync(file)) return undefined;
  const area = readToml<Boundaries>(file, { areas: [] }).areas.find(
    (a) => a.code === c.id.toUpperCase(),
  );
  if (!area) return undefined;
  const rings = area.rings.map((r) => decodePolyline(r));
  return (lat, lon) => inRings(rings, lat, lon);
}
