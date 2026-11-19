// The country selector (navbar): whose overviews are shown — train index, Bildfahrplan sheets,
// VzG lines and network map. Lookups (station search, departure plans, journeys) cover all
// countries. Remembered; ?land=si in a link selects it. Countries: packages/gtfs/countries.toml.
import { useLocalStorage } from "@vueuse/core";
import { computed } from "vue";
import countriesToml from "@zugx/gtfs/countries.toml";

export interface CountryInfo {
  id: string;
  name: { de: string; en: string; it: string; sl: string; es: string };
  /** UIC country code: its HAFAS station ids start with it ("81", "79") */
  uic: string;
  /** time zone of its timetable */
  timezone: string;
  /** licence of its timetable data (attribution) */
  licence: { name: string; url: string; source: string; page: string };
}

export const COUNTRIES: CountryInfo[] = Object.entries(
  countriesToml as Record<string, Omit<CountryInfo, "id">>,
).map(([id, c]) => ({ id, name: c.name, uic: c.uic, timezone: c.timezone, licence: c.licence }));

export const DEFAULT_COUNTRY = "at";
const known = (id: unknown): id is string => COUNTRIES.some((c) => c.id === id);
const stored = useLocalStorage("zugx:land", DEFAULT_COUNTRY);

/** the selected country's id ("at", "si") */
export const country = computed<string>({
  get: () => (known(stored.value) ? stored.value : DEFAULT_COUNTRY),
  set: (v) => {
    if (known(v)) stored.value = v;
  },
});

/**
 * the country of a data file: `packages/<pkg>/data/<country>/…`, Austria's directly in `data/`
 * (the original layout)
 */
export function countryOfPath(path: string): string {
  const m = /\/data\/([a-z]{2})\//.exec(path);
  return m && known(m[1]) ? m[1] : DEFAULT_COUNTRY;
}

/** the country of a HAFAS station id (UIC prefix), undefined for stations abroad */
export const countryOfStation = (hafasId: string): string | undefined =>
  COUNTRIES.find((c) => hafasId.startsWith(c.uic))?.id;

/** the entries of an import.meta.glob result that belong to a country */
export function ofCountry<T>(files: Record<string, T>, c: string): Record<string, T> {
  return Object.fromEntries(Object.entries(files).filter(([p]) => countryOfPath(p) === c));
}

/**
 * load one file per country, each on its own: a country whose file fails to load (a broken data
 * chunk, a subtle bug) is left out with a warning instead of failing the others. Returns the
 * country id with each loaded value, the selected country first.
 */
export async function loadPerCountry<T>(
  entries: (readonly [path: string, load: () => Promise<T>])[],
): Promise<[country: string, value: T][]> {
  const settled = await Promise.allSettled(
    entries.map(async ([p, load]) => [countryOfPath(p), await load()] as [string, T]),
  );
  const out: [string, T][] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") out.push(r.value);
    else console.warn(`zugx: ${entries[i]![0]} not loaded, left out:`, r.reason);
  });
  return out.sort((a, b) => Number(b[0] === country.value) - Number(a[0] === country.value));
}
