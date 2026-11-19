import "vue"; // load Vue before the DOM stubs below (it probes `document` at load)
import { beforeAll, describe, expect, it, vi } from "vite-plus/test";
import de from "./de.ts";
import en from "./en.ts";
import es from "./es.ts";
import it_ from "./it.ts";
import sl from "./sl.ts";

// the module reads browser globals at load time
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
vi.stubGlobal("navigator", { languages: ["en-GB"], language: "en-GB" });
vi.stubGlobal("document", { documentElement: { lang: "" } });
let i18n: typeof import("./index.ts");
beforeAll(async () => {
  i18n = await import("./index.ts");
});

const shape = (o: unknown, p = ""): string[] =>
  typeof o === "object" && o && !Array.isArray(o)
    ? Object.entries(o).flatMap(([k, v]) => shape(v, `${p}${k}.`))
    : [`${p.slice(0, -1)}:${Array.isArray(o) ? `[${o.length}]` : typeof o}`];

describe("i18n", () => {
  it("de, it, sl and es have exactly the keys of en", () => {
    expect(shape(de)).toEqual(shape(en));
    expect(shape(it_)).toEqual(shape(en));
    expect(shape(sl)).toEqual(shape(en));
    expect(shape(es)).toEqual(shape(en));
  });
  it("interpolates named params, missing params stay visible", () => {
    i18n.setLocale("en");
    expect(i18n.t("journeys.transfer", { min: 7 })).toBe("Transfer 7 min");
    expect(i18n.t("journeys.transfer")).toBe("Transfer {min} min");
    expect(i18n.t("journeys.transfer", { min: undefined })).toBe("Transfer  min");
  });
  it("follows the reactive locale; tm returns raw values", () => {
    i18n.setLocale("de");
    expect(i18n.t("nav.trains")).toBe(de.nav.trains);
    expect(i18n.tm("weekdays")).toEqual(de.weekdays);
    expect(i18n.hafasLang()).toBe("deu");
    i18n.setLocale("en");
    expect(i18n.t("nav.trains")).toBe("Trains");
  });
});
