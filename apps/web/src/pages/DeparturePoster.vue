<script setup lang="ts">
// Departure plan: every train leaving the station on the chosen day, from the open data GTFS
// (timetable, not live) — grouped by hour in columns like the posters in the stations, in zugx's
// own style: train badges, stations linked to their plans. Data: packages/trains/data/departures
// (one file per station, loaded on demand; built by `vp run departures:build`).
import { computed, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "../i18n/index.ts";
import { addDays, daysBetween, viennaDate } from "../lib/format.ts";
import LineBadge from "../components/LineBadge.vue";
import { trainSlug } from "../lib/url.ts";
import { useKeys } from "../lib/keys.ts";
import { usePageTitle } from "../lib/title.ts";
import { loadStations, stationById } from "../lib/stations.ts";

/** [minutes after midnight of the service day, category, number, destination id, following stop ids, days index, platform] */
type Row = [number, string, string, string, string[], number, string];
interface Departures {
  id: string;
  name: string;
  begin: string;
  end: string;
  source: string;
  days: string[];
  deps: Row[];
  names: Record<string, string>;
}

const files = import.meta.glob<{ default: Departures }>(
  "../../../../packages/trains/data/**/departures/*.toml",
);
const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const id = computed(() => String(route.params.id));
const data = shallowRef<Departures>();
const missing = shallowRef(false);
watch(
  id,
  async (sid) => {
    const load = Object.entries(files).find(([p]) => p.endsWith(`/${sid}.toml`))?.[1];
    missing.value = !load;
    data.value = load ? (await load()).default : undefined;
  },
  { immediate: true },
);

// ---- date (like the Bildfahrplan: ?d=, ←/→, today) ----
const today = viennaDate();
const date = computed(() => {
  const q = typeof route.query.d === "string" ? route.query.d : "";
  if (/^\d{4}-\d\d-\d\d$/.test(q)) return q;
  const d = data.value;
  return d && (today < d.begin || today > d.end) ? d.begin : today;
});
const setDate = (d: string | undefined) =>
  void router.replace({ query: { ...route.query, d: d === today ? undefined : d } });
useKeys({
  ArrowLeft: () => setDate(addDays(date.value, -1)),
  ArrowRight: () => setDate(addDays(date.value, 1)),
});
const weekday = computed(() =>
  Temporal.PlainDate.from(date.value).toLocaleString(locale.value, { weekday: "short" }),
);

// ---- the day's departures ----
const bits = computed(() =>
  (data.value?.days ?? []).map((b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))),
);
const runs = (di: number, i: number) =>
  ((bits.value[di]?.[i >> 3] ?? 0) >> (7 - (i & 7))) % 2 === 1;
// names as in the search (station index), else the timetable's, without "Bahnhof"/"Bahnhst"
const stationsReady = shallowRef(false);
void loadStations().then(() => (stationsReady.value = true));
const name = (sid: string) => {
  void stationsReady.value;
  const n =
    stationById(sid)?.name ??
    data.value?.names[sid] ??
    (sid === data.value?.id ? data.value.name : sid);
  return n.replace(/\s+(Bahnhof|Bahnhst|Bhf)$/, "");
};
const hours = computed(() => {
  const d = data.value;
  if (!d) return [];
  const i = daysBetween(d.begin, date.value);
  if (i < 0) return [];
  const byHour = new Map<number, Row[]>();
  for (const r of d.deps) {
    if (!runs(r[5], i)) continue;
    const h = Math.floor(r[0] / 60);
    byHour.set(h, [...(byHour.get(h) ?? []), r]);
  }
  return [...byHour].sort((a, b) => a[0] - b[0]);
});
const count = computed(() => hours.value.reduce((n, [, rs]) => n + rs.length, 0));
const hh = (h: number) => String(h % 24).padStart(2, "0");
/** another station: its plan on the same day (stations without one: the live board) */
const stationLink = (sid: string) =>
  stationById(sid)?.local || Object.keys(files).some((p) => p.endsWith(`/${sid}.toml`))
    ? { path: `/station/${sid}/plan`, query: route.query.d ? { d: route.query.d } : {} }
    : `/station/${sid}`;
const mm = (m: number) => String(m % 60).padStart(2, "0");

usePageTitle(() => [t("poster.title"), data.value ? name(data.value.id) : undefined]);
</script>

<template>
  <section>
    <div class="mb-2 flex flex-wrap items-center gap-2">
      <h1 class="m-0 text-xl">
        {{ $t("poster.title") }}
        <template v-if="data">· {{ name(data.id) }}</template>
      </h1>
      <RouterLink
        v-if="stationsReady && !stationById(id)?.local"
        :to="`/station/${id}`"
        class="text-sm"
        >{{ $t("poster.live") }} →</RouterLink
      >
    </div>
    <div class="mb-3 flex flex-wrap items-center gap-1 text-xs">
      <button
        class="btn"
        v-tip="`${$t('bf.prevDay')} (←)`"
        :aria-label="$t('bf.prevDay')"
        @click="setDate(addDays(date, -1))"
      >
        ←
      </button>
      <input
        type="date"
        class="input text-xs"
        :value="date"
        :min="data?.begin"
        :max="data?.end"
        :aria-label="$t('trains.runsOn')"
        @change="setDate(($event.target as HTMLInputElement).value || undefined)"
      />
      <span class="mono muted">{{ weekday }}</span>
      <button
        class="btn"
        v-tip="`${$t('bf.nextDay')} (→)`"
        :aria-label="$t('bf.nextDay')"
        @click="setDate(addDays(date, 1))"
      >
        →
      </button>
      <button v-if="date !== today" class="btn" @click="setDate(undefined)">
        {{ $t("trains.today") }}
      </button>
      <span class="muted ml-1">{{ $t("poster.count", { n: count }) }}</span>
    </div>

    <p v-if="missing" class="muted">{{ $t("poster.noData") }}</p>
    <template v-else-if="data">
      <p v-if="!count" class="muted">{{ $t("poster.none") }}</p>
      <div class="cols">
        <section v-for="[h, rows] in hours" :key="h" class="hour card p-2">
          <h2 class="hour-head m-0">
            <span class="mono">{{ hh(h) }}:00</span>
            <span class="muted plat-head">{{ $t("poster.platform") }}</span>
          </h2>
          <div v-for="(r, k) in rows" :key="k" class="dep">
            <span class="time mono">{{ hh(h) }}:{{ mm(r[0]) }}</span>
            <RouterLink
              class="train"
              :to="{ path: `/train/${trainSlug(`${r[1]} ${r[2]}`)}`, query: { d: date } }"
              ><LineBadge :cat="r[1]" :nr="r[2]" small
            /></RouterLink>
            <span class="dest">
              <RouterLink :to="stationLink(r[3])" class="dest-name">{{ name(r[3]) }}</RouterLink>
              <span v-if="r[4].length" class="via muted">
                {{ $t("poster.via") }}
                <template v-for="(v, n) in r[4]" :key="n"
                  ><template v-if="n"> – </template
                  ><RouterLink :to="stationLink(v)" class="via-link">{{
                    name(v)
                  }}</RouterLink></template
                >
              </span>
            </span>
            <span class="plat mono">{{ r[6] }}</span>
          </div>
        </section>
      </div>
      <p class="muted mt-3 text-xs">
        {{ $t("poster.source", { begin: data.begin, end: data.end, source: data.source }) }}
      </p>
    </template>
  </section>
</template>

<style scoped>
/* hours flow through columns like the posters in the stations */
.cols {
  column-width: 32rem;
  column-gap: 0.75rem;
}
.hour {
  break-inside: avoid-column;
  margin-bottom: 0.75rem;
}
.hour-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 0.125rem;
  border-bottom: 1px solid var(--line);
  font-size: 1rem;
}
.plat-head {
  font-size: 0.6875rem;
  font-weight: 400;
}
.dep {
  display: grid;
  grid-template-columns: 2.75rem auto 1fr 1.75rem;
  gap: 0 0.5rem;
  align-items: baseline;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--line);
  font-size: 0.8125rem;
  line-height: 1.25;
}
.dep:last-child {
  border-bottom: 0;
}
.time {
  font-weight: 600;
}
.dest-name {
  font-weight: 600;
  color: var(--fg);
}
.via {
  margin-left: 0.3em;
  font-size: 0.75rem;
}
.via-link {
  color: inherit;
}
.dest-name:hover,
.via-link:hover {
  color: var(--link);
}
.plat {
  text-align: right;
}
</style>
