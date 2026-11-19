<script setup lang="ts">
// Station index: every rail station of the timetable, A–Z, with the ÖBB operating-point
// abbreviation (Betriebsstellen-Kürzel, from OSM railway:ref) and the categories stopping there.
// Filter by name or abbreviation ("Kt", "Vb", "Vps"); an exact abbreviation comes first.
// A station opens its departure plan (timetable, GTFS); without one, the live board.
import { computed, shallowRef, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import LineBadge from "../components/LineBadge.vue";
import { useI18n } from "../i18n/index.ts";
import { normalize } from "../lib/normalize.ts";
import { loadStations, type Station } from "../lib/stations.ts";
import { usePageTitle } from "../lib/title.ts";
import { liveMode } from "../lib/live.ts";
import { country, countryOfStation, loadPerCountry } from "../lib/country.ts";

const { t } = useI18n();
/**
 * operating-point abbreviations of all countries (station ids are unique across them), each
 * country on its own: a broken file leaves out only its abbreviations
 */
const abbr = shallowRef<Record<string, string>>({});
void loadPerCountry(
  Object.entries(
    import.meta.glob<Record<string, string>>("../../../../packages/stations/data/**/abbr.toml", {
      import: "default",
    }),
  ),
).then((parts) => (abbr.value = Object.assign({}, ...parts.reverse().map(([, a]) => a))));
/** stations with a departure plan (the files are loaded only when opened) */
const POSTERS = new Set(
  Object.keys(import.meta.glob("../../../../packages/trains/data/**/departures/*.toml")).map(
    (p) => /([^/]+)\.toml$/.exec(p)?.[1],
  ),
);

const list = shallowRef<Station[]>([]);
const all = shallowRef<Station[]>([]);
void loadStations().then((ix) => {
  all.value = ix.map((x) => x.s).sort((a, b) => a.name.localeCompare(b.name, "de"));
});
/** the selected country's stations */
watchEffect(() => {
  list.value = all.value.filter((s) => countryOfStation(s.id) === country.value);
});
const route = useRoute();
const router = useRouter();
/** filter, kept in the address (?q=Kt) */
const q = computed({
  get: () => (typeof route.query.q === "string" ? route.query.q : ""),
  set: (v: string) => void router.replace({ query: v ? { q: v } : {} }),
});

/** "Kitzbühel" instead of "Kitzbühel Bahnhof" */
const short = (n: string) => n.replace(/\s+(Bahnhof|Bahnhst|Bhf)$/, "");
/** lower-case abbreviations that exist */
const known = computed(() => new Set(Object.values(abbr.value).map((a) => a.toLowerCase())));
/**
 * search terms: comma-separated parts; a part of space-separated known abbreviations ("Kt Vb Vps")
 * splits further, anything else stays a name ("St. Veit")
 */
const terms = computed(() =>
  q.value
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => {
      const ws = p.split(/\s+/);
      return ws.length > 1 && ws.every((w) => known.value.has(w.toLowerCase())) ? ws : [p];
    }),
);
/**
 * match quality of a station for one term: 0 exact abbreviation, 1 abbreviation prefix, 2 name
 * starts with it, 3 name contains it
 */
function rankFor(s: Station, term: string, list: boolean): number | undefined {
  const lower = term.toLowerCase();
  const a = abbr.value[s.id]?.toLowerCase();
  if (a === lower) return 0;
  // in a list of several terms, a known abbreviation means just that station
  if (list && known.value.has(lower)) return undefined;
  if (a?.startsWith(lower)) return 1;
  const n = normalize(s.name);
  const t = normalize(term);
  return n.startsWith(t) ? 2 : n.includes(t) ? 3 : undefined;
}
const shown = computed(() => {
  const ts = terms.value;
  if (!ts.length) return list.value;
  // in the order of the terms; per term exact abbreviation first, then prefix, then name
  const hits: { s: Station; key: number }[] = [];
  for (const s of list.value) {
    let key: number | undefined;
    ts.forEach((t, k) => {
      const r = rankFor(s, t, ts.length > 1);
      if (r !== undefined) key = Math.min(key ?? Infinity, k * 4 + r);
    });
    if (key !== undefined) hits.push({ s, key });
  }
  return hits.sort((x, y) => x.key - y.key).map((h) => h.s);
});
const letters = computed(() => {
  const m = new Map<string, Station[]>();
  for (const s of shown.value) {
    const l = q.value.trim() ? "" : (s.name[0] ?? "").toUpperCase();
    m.set(l, [...(m.get(l) ?? []), s]);
  }
  return [...m];
});
/** Live on: the live board; off: the departure plan (timetable), where there is one */
const link = (s: Station) =>
  !liveMode.value && POSTERS.has(s.id) ? `/station/${s.id}/plan` : `/station/${s.id}`;

usePageTitle(() => [t("stations.title")]);
</script>

<template>
  <section>
    <div class="mb-2 flex flex-wrap items-center gap-2">
      <h1 class="m-0 text-xl">{{ $t("stations.title") }}</h1>
      <span class="muted text-sm">{{ $t("stations.count", { n: shown.length }) }}</span>
      <input
        v-model="q"
        type="search"
        class="input ml-auto w-64 text-sm"
        :placeholder="$t('stations.filter')"
        :aria-label="$t('stations.filter')"
      />
    </div>
    <nav v-if="!q.trim()" class="letters mb-2 flex flex-wrap gap-1 text-sm" aria-label="A–Z">
      <a v-for="[l] in letters" :key="l" :href="`#l-${l}`" class="mono">{{ l }}</a>
    </nav>
    <p class="muted mt-0 text-xs">{{ $t("stations.note") }}</p>
    <section v-for="[l, ss] in letters" :key="l" class="mb-3">
      <h2 v-if="l" :id="`l-${l}`" class="m-0 mb-1 text-base">{{ l }}</h2>
      <ul class="cols m-0 list-none p-0">
        <li v-for="s in ss" :key="s.id" class="row">
          <span class="abbr mono" :class="!abbr[s.id] && 'none'">{{ abbr[s.id] ?? "" }}</span>
          <RouterLink :to="link(s)" class="name">{{ short(s.name) }}</RouterLink>
          <span class="cats">
            <LineBadge v-for="c in (s.p ?? []).slice(0, 4)" :key="c" :cat="c" small />
          </span>
        </li>
      </ul>
    </section>
  </section>
</template>

<style scoped>
.cols {
  column-width: 22rem;
  column-gap: 1.5rem;
}
.row {
  display: grid;
  grid-template-columns: 3.75rem 1fr auto;
  gap: 0.5rem;
  align-items: baseline;
  padding: 0.125rem 0;
  break-inside: avoid;
  font-size: 0.875rem;
}
.abbr {
  white-space: nowrap;
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 600;
}
.cats {
  display: inline-flex;
  gap: 0.125rem;
}
.letters a {
  padding: 0 0.25rem;
}
</style>
