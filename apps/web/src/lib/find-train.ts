// A train name ("RJX 162", "162") → its HAFAS journeys on a day. Some feeds name trains otherwise
// than HAFAS does: search the number and keep the trains of the right operator.
// - Feeds without a train category name trains by operator ("SŽ 4205", see
//   packages/gtfs/countries.toml); HAFAS has the category ("R 4205").
// - Renfe's product names (AVLO, AVANT, IC, REG) differ from HAFAS's (AVL, ARC, IR); "IC 190" is
//   a Hungarian IC there. Applied to Spanish-only categories always, to shared ones (AVE, EM, IC)
//   when Spain is the selected country.
import type { TripMatch } from "@zugx/hafas";
import { api } from "./api.ts";
import { country } from "./country.ts";

const RENFE = /^renfe/i;
/** categories used as operator / own product names → HAFAS operator names */
const OPERATORS: Record<string, RegExp> = {
  SŽ: /^(SŽ|Slovenske [žz]eleznice)/i,
  HŽ: /^(HŽ|Hrvatske [žz]eljeznice)/i,
  AVLO: RENFE,
  AVANT: RENFE,
  REG: RENFE,
  C: RENFE,
};
const BY_COUNTRY: Record<string, Record<string, RegExp>> = {
  es: { AVE: RENFE, EM: RENFE, IC: RENFE },
};

/** the exact matches (number, and category or operator); else all HAFAS found for the name */
export async function findTrains(name: string, when: Temporal.Instant): Promise<TripMatch[]> {
  const [cat, nr] = name.includes(" ") ? (name.split(" ") as [string, string]) : ["", name];
  const c = cat.toUpperCase();
  const op = OPERATORS[c] ?? BY_COUNTRY[country.value]?.[c];
  const found = await api().tripsByName(op ? nr : name, when);
  const exact = found.filter(
    (m) =>
      (m.line.trainNumber ?? m.line.number) === nr &&
      (!cat || (op ? op.test(m.line.operator ?? "") : m.line.category.toUpperCase() === c)),
  );
  // by operator: other operators' trains of that number aren't candidates
  return exact.length || op ? exact : found;
}
