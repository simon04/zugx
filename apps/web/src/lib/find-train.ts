// A train name ("RJX 162", "162") → its HAFAS journeys on a day. Feeds without a train category
// name trains by operator ("SŽ 4205", see packages/gtfs/countries.toml); HAFAS has the category
// ("R 4205") and knows nothing by "SŽ 4205": search the number, keep that operator's trains.
import type { TripMatch } from "@zugx/hafas";
import { api } from "./api.ts";

/** operator abbreviations used as category → HAFAS operator names */
const OPERATORS: Record<string, RegExp> = {
  SŽ: /^(SŽ|Slovenske [žz]eleznice)/i,
  HŽ: /^(HŽ|Hrvatske [žz]eljeznice)/i,
};

/** the exact matches (number, and category or operator); else all HAFAS found for the name */
export async function findTrains(name: string, when: Temporal.Instant): Promise<TripMatch[]> {
  const [cat, nr] = name.includes(" ") ? (name.split(" ") as [string, string]) : ["", name];
  const op = OPERATORS[cat.toUpperCase()];
  const found = await api().tripsByName(op ? nr : name, when);
  const exact = found.filter(
    (m) =>
      (m.line.trainNumber ?? m.line.number) === nr &&
      (!cat ||
        (op
          ? op.test(m.line.operator ?? "")
          : m.line.category.toUpperCase() === cat.toUpperCase())),
  );
  // by operator: other operators' trains of that number aren't candidates
  return exact.length || op ? exact : found;
}
