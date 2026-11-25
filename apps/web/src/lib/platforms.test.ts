import type { Movement, Stopover } from "@zugx/hafas";
import { describe, expect, it } from "vite-plus/test";
import { platformPosition, standingAt, trackNumber, type PlatformEdge } from "./platforms.ts";

// Graz Hbf (OSM platform edges, 2026-11) and two trains HAFAS placed on the same point
const EDGES: PlatformEdge[] = [
  ["1", 47.067726, 15.412594, 190], // Graz Don Bosco, 600 m away: not Graz Hbf's track 1
  ["2", 47.073033, 15.416434, 420],
  ["3", 47.073013, 15.416327, 420],
  ["5", 47.072585, 15.416275, 421],
  ["1", 47.071866, 15.417068, 564],
];
const GRAZ = {
  id: "8100173",
  name: "Graz Hbf",
  type: "station" as const,
  lat: 47.0724,
  lon: 15.416518,
};
const stop = (arr: string | undefined, dep: string | undefined, platform?: string): Stopover => ({
  stop: GRAZ,
  ...(arr ? { arr: { planned: arr, ...(platform ? { platform } : {}) } } : {}),
  ...(dep ? { dep: { planned: dep, ...(platform ? { platform } : {}) } } : {}),
});
const train = (name: string, s: Stopover): Movement => ({
  journeyId: name,
  line: { name, category: "RJX", number: "", cls: 1, product: "highspeed" },
  direction: "",
  lat: 47.072517,
  lon: 15.4165,
  nextStops: [s],
});
const t = (hhmm: string) => Date.parse(`2026-11-25T${hhmm}:00+01:00`);

describe("platforms", () => {
  it("reads the track number of a platform string", () => {
    expect(trackNumber("3")).toBe("3");
    expect(trackNumber("11A-B")).toBe("11");
    expect(trackNumber(" 2 ")).toBe("2");
    expect(trackNumber("-")).toBeUndefined();
    expect(trackNumber(undefined)).toBeUndefined();
  });

  it("finds the stop a train stands at (arrival … departure, first/last stop margins)", () => {
    const s = stop("2026-11-25T21:38:00+01:00", "2026-11-25T21:41:00+01:00", "3");
    expect(standingAt([s], t("21:40"))).toBe(s);
    expect(standingAt([s], t("21:45"))).toBeUndefined();
    const first = stop(undefined, "2026-11-25T21:41:00+01:00", "3");
    expect(standingAt([first], t("21:25"))).toBe(first);
    expect(standingAt([first], t("21:10"))).toBeUndefined();
  });

  it("puts two trains at one point on their own platforms", () => {
    const a = train("RJX 130", stop("2026-11-25T21:38:00+01:00", "2026-11-25T21:41:00+01:00", "3"));
    const b = train("RJX 835", stop("2026-11-25T21:36:00+01:00", "2026-11-25T21:42:00+01:00", "5"));
    const pa = platformPosition(a, t("21:40"), EDGES);
    const pb = platformPosition(b, t("21:40"), EDGES);
    expect(pa).toEqual({ lat: 47.073013, lon: 15.416327, platform: "3" });
    expect(pb).toEqual({ lat: 47.072585, lon: 15.416275, platform: "5" });
  });

  it("takes the station's own track, not one of the same number nearby", () => {
    const a = train("S 1", stop("2026-11-25T21:38:00+01:00", "2026-11-25T21:41:00+01:00", "1"));
    expect(platformPosition(a, t("21:40"), EDGES)?.lat).toBe(47.071866);
  });

  it("leaves moving trains, unknown platforms and trains far from the station alone", () => {
    const s = stop("2026-11-25T21:38:00+01:00", "2026-11-25T21:41:00+01:00", "3");
    expect(platformPosition(train("A", s), t("21:50"), EDGES)).toBeUndefined();
    const s9 = stop("2026-11-25T21:38:00+01:00", "2026-11-25T21:41:00+01:00", "9");
    expect(platformPosition(train("B", s9), t("21:40"), EDGES)).toBeUndefined();
    const far = { ...train("C", s), lat: 47.1, lon: 15.4 };
    expect(platformPosition(far, t("21:40"), EDGES)).toBeUndefined();
  });
});
