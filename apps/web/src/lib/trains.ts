// Train index per country (packages/trains/data, data/<country>): default file (long-distance +
// night) loaded first, full file (incl. regional + S-Bahn) on demand.
import { categoryRank } from "@zugx/gtfs/categories";
import { isLongDistance, type TrainEntry, type TrainIndex } from "@zugx/trains";
import { country, ofCountry } from "./country.ts";
import { NIGHT, REGIONAL, SUBURBAN } from "./products.ts";

export type { TrainEntry, TrainIndex } from "@zugx/trains";

const files = import.meta.glob<{ default: TrainIndex }>(
  "../../../../packages/trains/data/**/trains-*.toml",
);

/** the years of a country's train index, newest first */
export function yearsOf(c: string = country.value): number[] {
  return [
    ...new Set(
      Object.keys(ofCountry(files, c))
        .map((p) => /trains-(\d{4})/.exec(p)?.[1])
        .filter(Boolean) as string[],
    ),
  ]
    .map(Number)
    .sort((a, b) => b - a);
}

const cache = new Map<string, Promise<TrainIndex | undefined>>();

export function loadTrains(
  year: number,
  full: boolean,
  c: string = country.value,
): Promise<TrainIndex | undefined> {
  const key = `${c}:${year}:${full}`;
  let p = cache.get(key);
  if (!p) {
    const mine = ofCountry(files, c);
    const path = Object.keys(mine).find((f) =>
      f.endsWith(`/trains-${year}${full ? ".full" : ""}.toml`),
    );
    const loader = path ? mine[path] : undefined;
    p = loader ? loader().then((m) => m.default) : Promise.resolve(undefined);
    cache.set(key, p);
  }
  return p;
}

/** Year whose timetable period contains the given ISO date, else the newest year. */
export function yearFor(isoDate: string, c: string = country.value): number | undefined {
  const years = yearsOf(c);
  // timetable year Y runs from mid-December Y-1 to mid-December Y
  const y = Number(isoDate.slice(0, 4));
  const md = isoDate.slice(5);
  const guess = md >= "12-13" ? y + 1 : y;
  return years.includes(guess) ? guess : years[0];
}

// ---------- running days ----------

const bitsCache = new WeakMap<TrainEntry, Uint8Array>();

function bytes(e: TrainEntry): Uint8Array {
  let b = bitsCache.get(e);
  if (!b) {
    const bin = atob(e.days);
    b = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    bitsCache.set(e, b);
  }
  return b;
}

/** bit i (day i after `begin`); MSB-first within each byte, like HAFAS sDaysB */
export function runsOnDay(e: TrainEntry, i: number): boolean {
  const b = bytes(e)[i >> 3];
  return b !== undefined && ((b >> (7 - (i & 7))) & 1) === 1;
}

export const dayIndex = (begin: string, iso: string) =>
  Temporal.PlainDate.from(begin).until(Temporal.PlainDate.from(iso)).days;

export const dayIso = (begin: string, i: number) =>
  Temporal.PlainDate.from(begin).add({ days: i }).toString();

/** weekday, Mo = 0 */
export const weekdayOf = (iso: string) => Temporal.PlainDate.from(iso).dayOfWeek - 1;

export function totalDays(idx: Pick<TrainIndex, "begin" | "end">): number {
  return dayIndex(idx.begin, idx.end) + 1;
}

export interface DaysAnalysis {
  /** weekday (Mo = 0) belongs to the regular pattern */
  on: boolean[];
  /** day indexes within [first, last] where the pattern says yes but the train doesn't run */
  except: number[];
  /** day indexes where the train runs outside its weekday pattern */
  extra: number[];
  firstI: number;
  lastI: number;
}

/** Weekday pattern within the train's own period (first…last running day) plus exceptions. */
export function analyzeDays(e: TrainEntry, idx: Pick<TrainIndex, "begin" | "end">): DaysAnalysis {
  const firstI = Math.max(0, dayIndex(idx.begin, e.first));
  const lastI = Math.min(totalDays(idx) - 1, dayIndex(idx.begin, e.last));
  const beginWd = weekdayOf(idx.begin);
  const wd = (i: number) => (beginWd + i) % 7;
  const per = Array<number>(7).fill(0);
  const possible = Array<number>(7).fill(0);
  for (let i = firstI; i <= lastI; i++) {
    possible[wd(i)]!++;
    if (runsOnDay(e, i)) per[wd(i)]!++;
  }
  // a weekday belongs to the pattern if the train runs on most of its occurrences
  const on = per.map((c, i) => c > 0 && c >= possible[i]! * 0.5);
  const except: number[] = [];
  const extra: number[] = [];
  for (let i = firstI; i <= lastI; i++) {
    const runs = runsOnDay(e, i);
    if (on[wd(i)] && !runs) except.push(i);
    else if (!on[wd(i)] && runs) extra.push(i);
  }
  return { on, except, extra, firstI, lastI };
}

export interface DaysLabels {
  weekdays: string[];
  daily: string;
}

/** Short running-days summary: weekday pattern within the period, with −/+ exception counts. */
export function daysSummary(
  e: TrainEntry,
  idx: Pick<TrainIndex, "begin" | "end">,
  t: DaysLabels,
): string {
  const a = analyzeDays(e, idx);
  if (!a.on.some(Boolean)) return `${e.n}×`;
  let s = a.on.every(Boolean) ? t.daily : weekdayRanges(a.on, t.weekdays);
  if (a.except.length) s += ` −${a.except.length}`;
  if (a.extra.length) s += ` +${a.extra.length}`;
  return s;
}

/** Merge consecutive day indexes into date ranges: "20.12.–4.1., 3.5." */
export function dayRanges(days: number[], begin: string, locale: string, max = 12): string {
  const d = (i: number) =>
    Temporal.PlainDate.from(dayIso(begin, i)).toLocaleString(locale, {
      day: "numeric",
      month: "numeric",
    });
  const ranges: string[] = [];
  for (let k = 0; k < days.length;) {
    let j = k;
    while (j + 1 < days.length && days[j + 1] === days[j]! + 1) j++;
    ranges.push(j > k ? `${d(days[k]!)}–${d(days[j]!)}` : d(days[k]!));
    k = j + 1;
  }
  return ranges.length > max
    ? `${ranges.slice(0, max).join(", ")}, … (+${ranges.length - max})`
    : ranges.join(", ");
}

export interface DaysTooltipLabels extends DaysLabels {
  runs: (pattern: string) => string;
  irregular: string;
  period: (n: number, from: string, to: string) => string;
  except: (list: string) => string;
  extra: (list: string) => string;
  variants: (n: number) => string;
}

/** Multi-line explanation for the running-days column. */
export function daysTooltip(
  e: TrainEntry,
  idx: Pick<TrainIndex, "begin" | "end">,
  locale: string,
  t: DaysTooltipLabels,
): string {
  const a = analyzeDays(e, idx);
  const fd = (iso: string) =>
    Temporal.PlainDate.from(iso).toLocaleString(locale, {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    });
  const lines = [t.period(e.n, fd(e.first), fd(e.last))];
  if (!a.on.some(Boolean)) {
    lines.unshift(t.irregular);
    const all: number[] = [];
    for (let i = a.firstI; i <= a.lastI; i++) if (runsOnDay(e, i)) all.push(i);
    lines.push(dayRanges(all, idx.begin, locale, 20));
  } else {
    lines.unshift(t.runs(a.on.every(Boolean) ? t.daily : weekdayRanges(a.on, t.weekdays)));
    if (a.except.length) lines.push(t.except(dayRanges(a.except, idx.begin, locale)));
    if (a.extra.length) lines.push(t.extra(dayRanges(a.extra, idx.begin, locale)));
  }
  if (e.var && e.var > 1) lines.push(t.variants(e.var));
  return lines.join("\n");
}

function weekdayRanges(on: boolean[], names: string[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < 7) {
    if (!on[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < 7 && on[j + 1]) j++;
    parts.push(
      j - i >= 2 ? `${names[i]}–${names[j]}` : j > i ? `${names[i]}, ${names[j]}` : names[i]!,
    );
    i = j + 1;
  }
  return parts.join(", ");
}

// ---------- groups ----------

export type QuickFilter = "all" | "long" | "regional" | "suburban" | "night";

export function inGroup(cat: string, g: QuickFilter): boolean {
  switch (g) {
    case "all":
      return true;
    case "long":
      return isLongDistance({ cat });
    case "regional":
      return REGIONAL.has(cat);
    case "suburban":
      return SUBURBAN.has(cat);
    case "night":
      return NIGHT.has(cat);
  }
}

/** groups that need the full file (default file has no regional/S-Bahn trains) */
export const needsFull = (g: QuickFilter) => g === "all" || g === "regional" || g === "suburban";

/** sort rank of a category, long-distance → regional (the pipeline's order, incl. other countries') */
export const catRank = (c: string) => categoryRank(c);
