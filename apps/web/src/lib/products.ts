// Product colours & categories (dense, ÖBB-ish palette). All colours keep ≥ 4.5:1 contrast with
// white badge text (WCAG AA).
import type { Line, ProductId } from "@zugx/hafas";
import { scheme } from "./theme.ts";
import type en from "../i18n/en.ts";

export const LONG_DISTANCE = new Set([
  "RJX",
  "RJ",
  "ICE",
  "EC",
  "IC",
  "NJ",
  "EN",
  "D",
  "WB",
  "TGV",
  "ECE",
  "IR",
  "ES",
  "FR",
  "EX",
  "SC",
  // Spain (Renfe): AVE, AVLO (low-cost AVE), Euromed
  "AVE",
  "AVLO",
  "EM",
]);
export const REGIONAL = new Set([
  ...["CJX", "REX", "R", "RB", "RE", "ER", "Os", "SB"],
  // Slovenia (LP local, LPV, RG regional, MV/MO international regional), Bulgaria (PV)
  ...["LP", "LPV", "RG", "MV", "MO", "PV"],
  // Spain: Avant (high-speed medium distance), Regional
  ...["AVANT", "REG"],
]);
/** S-Bahn and suburban trains (Bulgaria: KPV крайградски, Spain: C Cercanías/Rodalies) */
export const SUBURBAN = new Set(["S", "KPV", "C"]);
export const NIGHT = new Set(["NJ", "EN"]);

/** private long-distance operators (WESTbahn, RegioJet, Leo Express): orange */
const PRIVATE_LD = "#b35800";
const PRIVATE_LD_CATS = new Set(["WB", "RGJ", "LEO"]);
const PRIVATE_LD_OPERATORS = /westbahn|regiojet|leo express|flixtrain/i;

// Colours by offer level, as common among Austrian timetable planners (FBS): RJX ≠ RJ (two levels
// of the long-distance offer), IR + CJX violet, REX green (≠ R), private long-distance orange.
// Tuned for mutual distinguishability (OKLab ΔE, also under protan/deutan simulation) within the
// ≥ 4.5:1 white-text limit — see PLAN.md "Category colours".
const CAT_COLORS: Record<string, string> = {
  RJX: "#b8157a",
  RJ: "#d0102a",
  ICE: "#4b4f55",
  EC: "#7d1a14",
  IC: "#7d1a14",
  NJ: "#26296b",
  EN: "#26296b",
  D: "#7d1a14",
  IR: "#8448b8",
  CJX: "#8448b8",
  REX: "#2a7a2e",
  R: "#5a7590",
  S: "#1659c9",
  WB: PRIVATE_LD,
  RGJ: PRIVATE_LD,
  LEO: PRIVATE_LD,
  // Spain, by offer level like the Austrian ones: AVE top (RJ), AVLO second (RJX), Euromed and
  // Intercity long-distance (EC/IC), Avant fast regional (IR/CJX), Regional (R), Cercanías (S)
  AVE: "#d0102a",
  AVLO: "#b8157a",
  EM: "#7d1a14",
  AVANT: "#8448b8",
  REG: "#5a7590",
  C: "#1659c9",
};

const PRODUCT_COLORS: Record<ProductId, string> = {
  highspeed: "#d0102a",
  night: "#26296b",
  replacement: "#795548",
  intercity: "#7d1a14",
  interregional: "#8448b8",
  regional: "#2773d1",
  suburban: "#1659c9",
  bus: "#6b6b6b",
  ferry: "#1b808e",
  subway: "#a3529a",
  tram: "#d4433a",
  cable: "#6b6b6b",
  ondemand: "#6b6b6b",
  other: "#6b6b6b",
};

/**
 * the same categories as lines/text on the dark surface: the badge colours are too dark there
 * (they are tuned for white text); lighter steps, again checked for mutual distance and ≥ 3:1
 * against the dark background
 */
const DARK: Record<string, string> = {
  "#d0102a": "#ff4b5c", // RJ
  "#b8157a": "#e862b6", // RJX
  "#7d1a14": "#c4553c", // EC/IC/D
  "#4b4f55": "#d0d4d8", // ICE
  "#26296b": "#aab0ff", // NJ/EN
  "#8448b8": "#b07fea", // IR/CJX
  "#2a7a2e": "#4fb052", // REX
  "#5a7590": "#7f9cc0", // R
  "#1659c9": "#2f7ff0", // S
  "#b35800": "#f0902a", // private long-distance
  "#795548": "#a58670", // rail replacement
  "#6b6b6b": "#7a7a7a", // bus, other
  "#2773d1": "#5a9ae8", // other regional (RE, RB …)
};
/** a badge colour as line/text colour for the current scheme */
const onSurface = (hex: string) => (scheme.value === "dark" ? (DARK[hex] ?? hex) : hex);

/** colour of a train as a line, dot or text (depends on light/dark) */
export function lineColor(line?: Pick<Line, "category" | "product" | "operator">): string {
  if (!line) return "var(--muted)";
  return onSurface(lineBadgeColor(line));
}

/**
 * the category whose colour a train gets: Slovenian trains carry no category in the GTFS ("SŽ
 * 4205"); by number, below 1000 are the long-distance trains (IC, EC, ICS), the others regional and
 * suburban — the category alone (legend, filters) counts as the latter, the majority
 */
function colorCategory(cat: string, nr?: string): string {
  if (cat === "SŽ") return nr && /^\d+$/.test(nr) && Number(nr) < 1000 ? "IC" : "S";
  return cat;
}

/** colour of a category (and train number, see colorCategory) as a line or text (light/dark) */
export function categoryColor(cat: string, nr?: string): string {
  return onSurface(categoryBadgeColor(cat, nr));
}

/** background of a badge with white text (the same in light and dark) */
export function lineBadgeColor(line: Pick<Line, "category" | "product" | "operator">): string {
  const longDistance = ["highspeed", "intercity", "interregional", "night"].includes(line.product);
  if (
    PRIVATE_LD_CATS.has(line.category) ||
    (longDistance && PRIVATE_LD_OPERATORS.test(line.operator ?? ""))
  )
    return PRIVATE_LD;
  return CAT_COLORS[line.category] ?? PRODUCT_COLORS[line.product] ?? "#6b6b6b";
}

/** background of a category badge with white text (the same in light and dark) */
export function categoryBadgeColor(cat: string, nr?: string): string {
  cat = colorCategory(cat, nr);
  return (
    CAT_COLORS[cat] ?? (SUBURBAN.has(cat) ? "#1659c9" : REGIONAL.has(cat) ? "#2773d1" : "#6b6b6b")
  );
}

/** product filter groups for UI chips → HAFAS class bitmask */
/** product filter groups; ids are message keys under `products` */
export const PRODUCT_GROUPS: { id: keyof (typeof en)["products"]; cls: number }[] = [
  { id: "highspeed", cls: 1 },
  { id: "intercity", cls: 4 },
  { id: "interregional", cls: 8 | 4096 },
  { id: "regional", cls: 16 },
  { id: "suburban", cls: 32 },
  { id: "replacement", cls: 2 },
  { id: "bus", cls: 64 },
  { id: "subway", cls: 256 },
  { id: "tram", cls: 512 },
  { id: "other", cls: 128 | 1024 | 2048 },
];
export const ALL_CLS = PRODUCT_GROUPS.reduce((a, g) => a | g.cls, 0);

/** default for station boards: trains only */
export const RAIL_CLS = 1 | 2 | 4 | 8 | 16 | 32 | 4096;
