// Train categories (Zuggattungen) as found in trip_short_name / HAFAS. Pure module, safe for the browser.

/** Display/sort order, long-distance → regional. Unknown categories sort after these. */
export const CATEGORY_ORDER = [
  "RJX",
  "RJ",
  "ICE",
  "AVE",
  "AVLO",
  "EM",
  "ECE",
  "TGV",
  "EUR",
  "FR",
  "EC",
  "IC",
  "EN",
  "NJ",
  "ES",
  "IR",
  "D",
  "WB",
  "FLX",
  "AVANT",
  "CAT",
  "ATB",
  "SP",
  "ER",
  "CJX",
  "REX",
  "IRE",
  "MEX",
  "FEX",
  "RE",
  "RB",
  "RR",
  "OS",
  "R",
  "REG",
  "S",
  "C",
] as const;

/** Long-distance + night categories: the default train index (everything else is in the full one). */
export const LONG_DISTANCE_CATEGORIES: readonly string[] = [
  "RJX",
  "RJ",
  "ICE",
  "ECE",
  "TGV",
  "FR",
  "EC",
  "IC",
  "EN",
  "NJ",
  "ES",
  "IR",
  "D",
  "WB",
  // Germany: Eurostar (ex Thalys), FlixTrain
  "EUR",
  "FLX",
  // other countries' long-distance trains: Slovenia InterCity Slovenija, Croatia international,
  // Montenegro / Serbia brzi voz, Bulgaria бърз, експресен, международен бърз влак; Spain
  // (Renfe) AVE, AVLO (low-cost AVE), Euromed
  "ICS",
  "AVE",
  "AVLO",
  "EM",
  "INT",
  "B",
  "BV",
  "EV",
  "MBV",
];

export const NIGHT_CATEGORIES: readonly string[] = ["NJ", "EN"];

const rank = new Map<string, number>(CATEGORY_ORDER.map((c, i) => [c, i]));

export function categoryRank(cat: string): number {
  return rank.get(cat) ?? CATEGORY_ORDER.length;
}

/** Sort categories long-distance → regional, unknown ones alphabetically at the end. */
export function compareCategories(a: string, b: string): number {
  return categoryRank(a) - categoryRank(b) || (a < b ? -1 : a > b ? 1 : 0);
}

/** "RJX 260" → { cat: "RJX", nr: "260" }; undefined if it doesn't look like a train name. */
export function parseTrainName(s: string): { cat: string; nr: string } | undefined {
  // any letters (also "SŽ", "HŽ": operator instead of category where a feed has none)
  const m = /^\s*(\p{L}{1,5})\s*(\d{1,6}[A-Za-z]?)\s*$/u.exec(s);
  if (!m) return undefined;
  return { cat: m[1]!.toUpperCase(), nr: m[2]! };
}
