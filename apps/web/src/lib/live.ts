// The global Live switch (navbar): realtime (HAFAS) or timetable (GTFS) where a page has both —
// station: live board ⇄ departure plan; Bildfahrplan: realtime overlay. Remembered. Only where
// ÖBB HAFAS has realtime: Austria, and Germany (partly: long-distance trains, Bavaria); with another
// country selected it is off and the button disabled.
import { useLocalStorage } from "@vueuse/core";
import { computed } from "vue";
import { country } from "./country.ts";

const stored = useLocalStorage("zugx:live", true);
const LIVE_COUNTRIES = new Set(["at", "de"]);

/** realtime data exists for the selected country */
export const liveAvailable = computed(() => LIVE_COUNTRIES.has(country.value));

/** Live on (always off where there is no realtime data; the stored choice stays) */
export const liveMode = computed<boolean>({
  get: () => liveAvailable.value && stored.value,
  set: (v) => {
    if (liveAvailable.value) stored.value = v;
  },
});
