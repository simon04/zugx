import { describe, expect, it } from "vite-plus/test";
import type { TrainIndex } from "@zugx/trains";
import { fromLocalInput, toLocalInput, viennaDate, viennaMinutes } from "./format.ts";
import { normalize, searchKeys } from "./normalize.ts";
import { categoryBadgeColor } from "./products.ts";
import countriesToml from "@zugx/gtfs/countries.toml";
import { COUNTRIES, completeCountry, loadPerCountry } from "./country.ts";
import { _setStations, searchStations } from "./stations.ts";
import { dayIndex, daysSummary, runsOnDay, type TrainEntry } from "./trains.ts";
import { b64url, unb64url } from "./url.ts";

describe("normalize", () => {
  it("strips diacritics and punctuation", () => {
    expect(normalize("St. Pölten Hbf")).toBe("st polten hbf");
    expect(normalize("Linz/Donau Hbf")).toBe("linz donau hbf");
  });
  it("adds synonyms and digraphs", () => {
    const keys = searchKeys("Mödling Bahnhof");
    expect(keys).toContain("moedling bahnhof");
    expect(keys).toContain("modling bf");
  });
});

describe("station search", () => {
  _setStations([
    {
      id: "8103000",
      name: "Wien Hbf",
      lat: 48.18,
      lon: 16.37,
      w: 1000,
      alias: ["Wien Hauptbahnhof"],
    },
    { id: "8100516", name: "Wiener Neustadt Hbf", lat: 47.81, lon: 16.23, w: 600 },
    { id: "8100008", name: "St.Pölten Hbf", lat: 48.2, lon: 15.62, w: 800 },
    { id: "8100013", name: "Linz/Donau Hbf", lat: 48.29, lon: 14.29, w: 900 },
  ]);
  it("ranks by match and weight", () => {
    expect(searchStations("wien")[0]?.id).toBe("8103000");
    expect(searchStations("wr neu")[0]?.id).toBe("8100516");
    expect(searchStations("wiener neu")[0]?.id).toBe("8100516");
  });
  it("handles synonyms and umlauts", () => {
    expect(searchStations("sankt poelten")[0]?.id).toBe("8100008");
    expect(searchStations("linz hauptbahnhof")[0]?.id).toBe("8100013");
    expect(searchStations("wien hauptb")[0]?.id).toBe("8103000");
  });
});

describe("time inputs", () => {
  it("round-trips Vienna local time", () => {
    const d = fromLocalInput("2026-07-01T08:30")!;
    expect(d.toInstant().toString()).toBe("2026-07-01T06:30:00Z");
    expect(toLocalInput(d)).toBe("2026-07-01T08:30");
    expect(fromLocalInput("2026-01-10T08:30")!.toInstant().toString()).toBe("2026-01-10T07:30:00Z");
    expect(fromLocalInput("2026-02-30T08:30")).toBeUndefined();
    expect(fromLocalInput("garbage")).toBeUndefined();
  });
});

describe("Vienna wall-clock (independent of the browser time zone)", () => {
  it("date and minutes", () => {
    // 2026-12-31 23:30 UTC = 2027-01-01 00:30 CET
    const d = Temporal.Instant.from("2026-12-31T23:30:00Z");
    expect(viennaDate(d)).toBe("2027-01-01");
    expect(viennaMinutes(d)).toBe(30);
    // summer time: 06:15 UTC = 08:15 CEST
    expect(viennaMinutes(Temporal.Instant.from("2026-07-01T06:15:00Z"))).toBe(8 * 60 + 15);
  });
});

describe("url", () => {
  it("base64url round-trip", () => {
    const s = "¶HKI¶T$A=1@O=Wien Hbf@L=8103000@$202611131224";
    expect(unb64url(b64url(s))).toBe(s);
    expect(b64url(s)).not.toMatch(/[+/=]/);
  });
});

describe("train running days", () => {
  const idx = { begin: "2025-12-14", end: "2026-12-12" };
  const bits = (pred: (i: number) => boolean) => {
    const n = dayIndex(idx.begin, idx.end) + 1;
    const b = new Uint8Array(Math.ceil(n / 8));
    let count = 0;
    for (let i = 0; i < n; i++)
      if (pred(i)) {
        b[i >> 3]! |= 1 << (7 - (i & 7));
        count++;
      }
    return { days: btoa(String.fromCharCode(...b)), n: count };
  };
  const entry = (pred: (i: number) => boolean): TrainEntry => ({
    via: [],
    stops: [],
    op: "oebb",
    cat: "RJ",
    nr: "1",
    from: ["1", "08:00"],
    to: ["2", "09:00"],
    first: idx.begin,
    last: idx.end,
    ...bits(pred),
  });
  const t = {
    weekdays: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
    daily: "daily",
    except: (n: number) => `(-${n})`,
  };
  it("daily", () =>
    expect(
      daysSummary(
        entry(() => true),
        idx,
        t,
      ),
    ).toBe("daily"));
  it("weekdays (2025-12-14 is a Sunday)", () => {
    const e = entry((i) => i % 7 >= 1 && i % 7 <= 5);
    expect(runsOnDay(e, 0)).toBe(false);
    expect(runsOnDay(e, 1)).toBe(true);
    expect(daysSummary(e, idx, t)).toBe("Mo–Fr");
  });
  it("weekends with exceptions", () => {
    const e = entry((i) => (i % 7 === 0 || i % 7 === 6) && i !== 7);
    expect(daysSummary(e, idx, t)).toBe("Sa, Su −1");
  });
});

describe("running days tooltip", () => {
  it("explains pattern, period and exceptions with real data", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { daysTooltip, daysSummary } = await import("./trains.ts");
    const { fromToml } = await import("@zugx/toml");
    const idx = fromToml<TrainIndex>(
      readFileSync(
        join(import.meta.dirname, "../../../../packages/trains/data/trains-2026.toml"),
        "utf8",
      ),
    );
    const labels = {
      weekdays: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
      daily: "täglich",
      runs: (p: string) => `Verkehrt ${p}`,
      irregular: "Unregelmäßig",
      period: (n: number, a: string, b: string) => `${n} Tage, ${a} – ${b}`,
      except: (l: string) => `Nicht am: ${l}`,
      extra: (l: string) => `Auch am: ${l}`,
      variants: (n: number) => `${n} Varianten`,
    };
    const ec164 = idx.trains.find((x: TrainEntry) => x.cat === "EC" && x.nr === "164");
    const tip = daysTooltip(ec164!, idx, "de-AT", labels);
    expect(tip).toMatch(/^Verkehrt täglich\n\d+ Tage, 14\.12\.2025 – 12\.12\.2026\nNicht am: /);
    expect(daysSummary(ec164!, idx, labels)).toMatch(/^täglich −\d+$/);
  });
});

describe("Slovenian train colours (no category in the GTFS)", () => {
  it("colours SŽ trains below 1000 like IC, the others like S", () => {
    expect(categoryBadgeColor("SŽ", "640")).toBe(categoryBadgeColor("IC"));
    expect(categoryBadgeColor("SŽ", "2502")).toBe(categoryBadgeColor("S"));
    expect(categoryBadgeColor("SŽ")).toBe(categoryBadgeColor("S"));
  });
});

describe("countries are independent", () => {
  it("every country in countries.toml is complete (else it's left out of the app)", () => {
    for (const [id, c] of Object.entries(countriesToml as Record<string, object>))
      expect(completeCountry(c), id).toBe(true);
    expect(COUNTRIES.length).toBe(Object.keys(countriesToml).length);
  });
  it("a country whose file fails to load is left out, the others load", async () => {
    const warn = console.warn;
    console.warn = () => {};
    try {
      const got = await loadPerCountry([
        ["/packages/x/data/stations.toml", async () => "at"],
        ["/packages/x/data/si/stations.toml", async () => Promise.reject(new Error("broken"))],
        ["/packages/x/data/es/stations.toml", async () => "es"],
      ]);
      expect(got.map(([c]) => c).sort()).toEqual(["at", "es"]);
    } finally {
      console.warn = warn;
    }
  });
});
