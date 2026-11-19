<script setup lang="ts">
import { useAutoRefresh } from "../lib/refresh.ts";
import type { BoardEntry } from "@zugx/hafas";
import { useLocalStorage } from "@vueuse/core";
import { computed, defineAsyncComponent, onMounted, ref, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import EventTime from "../components/EventTime.vue";
import LineBadge from "../components/LineBadge.vue";
import Platform from "../components/Platform.vue";
import Remarks from "../components/Remarks.vue";
import SortHeader from "../components/SortHeader.vue";
import Status from "../components/Status.vue";
import { api } from "../lib/api.ts";
import { useAsync } from "../lib/async.ts";
import { fromLocalInput, hhmm, instant, ms, toLocalInput } from "../lib/format.ts";
import { useKeys } from "../lib/keys.ts";
import { PRODUCT_GROUPS, RAIL_CLS } from "../lib/products.ts";
import { catRank } from "../lib/trains.ts";
import { loadStations, stationById } from "../lib/stations.ts";
import { addRecent, isFavourite, toggleFavourite } from "../lib/store.ts";
import { stationWikidata } from "../lib/wikidata.ts";
// MapLibre (~300 KB gzip) only when the map is shown: the page renders without waiting for it
const MapView = defineAsyncComponent(() => import("../viz/MapView.vue"));

const route = useRoute();
const router = useRouter();

const id = computed(() => String(route.params.id));
const arrivals = computed(() => route.query.arr !== undefined);
const t = computed(() => (typeof route.query.t === "string" ? route.query.t : ""));
const products = computed(() =>
  typeof route.query.p === "string" ? Number(route.query.p) : RAIL_CLS,
);
const name = ref("");
const sel = ref(-1);
const expanded = ref<string>();
const auto = ref(true);

/** true while a periodic auto-refresh request is started (low fetch priority) */
let background = false;
const board = useAsync<BoardEntry[]>(() =>
  api(background).board(id.value, {
    arrivals: arrivals.value,
    when: (t.value && fromLocalInput(t.value)) || Temporal.Now.instant(),
    duration: 90,
    results: 60,
    products: products.value,
  }),
);

// minimap open by default on wide screens, collapsed on phones; the choice is remembered
const mapOpen = useLocalStorage("zugx:station-map", matchMedia("(min-width: 1280px)").matches, {
  serializer: { read: (v) => v === "1", write: (v) => (v ? "1" : "0") },
});
function onMapToggle(e: Event) {
  mapOpen.value = (e.target as HTMLDetailsElement).open;
}

/** station coordinates for the minimap (local index, else HAFAS) */
const coords = ref<[number, number]>();

async function resolveName() {
  await loadStations();
  const local = stationById(id.value);
  // a station HAFAS doesn't know (timetable data only): no live board, its departure plan instead
  if (local?.local)
    return void router.replace({ path: `/station/${id.value}/plan`, query: route.query });
  name.value = local?.name ?? "";
  coords.value = local ? [local.lat, local.lon] : undefined;
  if (!name.value || !coords.value) {
    const r = await api()
      .locations(id.value, 1)
      .catch(() => []);
    name.value ||= r[0]?.name ?? id.value;
    if (!coords.value && r[0]?.lat !== undefined) coords.value = [r[0].lat, r[0].lon!];
  }
  addRecent({ id: id.value, name: name.value });
  document.title = `${name.value} · zugx`;
}

/** departures loaded with "Earlier" / "Later", kept around the current window */
const before = shallowRef<BoardEntry[]>([]);
const after = shallowRef<BoardEntry[]>([]);
const paging = ref(false);
const pageError = ref<string>();
const entryKey = (e: BoardEntry) => e.journeyId + e.when.planned;

/** all loaded departures in time order, without duplicates (windows may overlap) */
const entries = computed(() => {
  const seen = new Set<string>();
  return [...before.value, ...(board.data.value ?? []), ...after.value].filter((e) => {
    const k = entryKey(e);
    return !seen.has(k) && !!seen.add(k);
  });
});

/** Load the next (dir 1) or previous (dir -1) departures and add them, keeping the shown ones. */
async function more(dir: 1 | -1) {
  const list = entries.value;
  const edge = dir > 0 ? list.at(-1) : list[0];
  if (!edge) return;
  const edgeMs = ms(edge.when.planned);
  paging.value = true;
  pageError.value = undefined;
  try {
    const r = await api().board(id.value, {
      arrivals: arrivals.value,
      when:
        dir > 0 ? instant(edge.when.planned) : instant(edge.when.planned).subtract({ hours: 1 }),
      duration: dir > 0 ? 90 : 60,
      results: 60,
      products: products.value,
    });
    const have = new Set(list.map(entryKey));
    const fresh = r.filter(
      (e) =>
        !have.has(entryKey(e)) &&
        (dir > 0 ? ms(e.when.planned) >= edgeMs : ms(e.when.planned) <= edgeMs),
    );
    if (dir > 0) after.value = [...after.value, ...fresh];
    else {
      before.value = [...fresh, ...before.value];
      if (sel.value >= 0) sel.value += fresh.length;
    }
  } catch (e) {
    pageError.value = e instanceof Error ? e.message : String(e);
  } finally {
    paging.value = false;
  }
}

watch([id, arrivals, t, products], () => {
  sel.value = -1;
  before.value = [];
  after.value = [];
  void board.run();
});
watch(id, resolveName);
onMounted(() => {
  void board.run();
  void resolveName();
});

useAutoRefresh(
  () => {
    background = true; // low fetch priority
    void board.run();
    background = false;
  },
  30_000,
  () => auto.value && !t.value,
);

function setQuery(q: Record<string, string | undefined>) {
  const next = { ...route.query, ...q };
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
  void router.replace({ query: next });
}

function toggleProduct(cls: number) {
  const p = products.value ^ cls;
  setQuery({ p: p === RAIL_CLS ? undefined : String(p || RAIL_CLS) });
}

// sortable columns, state in the URL (?sort=line&desc=1); default: by time
type SortKey = "time" | "line" | "direction" | "platform";
const SORT_KEYS: SortKey[] = ["time", "line", "direction", "platform"];
const sort = computed<SortKey>(() =>
  SORT_KEYS.includes(route.query.sort as SortKey) ? (route.query.sort as SortKey) : "time",
);
const desc = computed(() => route.query.desc === "1");
function sortBy(k: SortKey) {
  const d = sort.value === k ? !desc.value : false;
  setQuery({ sort: k === "time" && !d ? undefined : k, desc: d ? "1" : undefined });
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const sortValue = (e: BoardEntry, k: SortKey): string => {
  switch (k) {
    case "time":
      return e.when.actual ?? e.when.planned;
    case "line":
      return `${String(catRank(e.line.category.toUpperCase())).padStart(2, "0")} ${e.line.name}`;
    case "direction":
      return e.direction;
    case "platform":
      return e.when.platform ?? "\uffff"; // no platform last
  }
};

const rows = computed(() => {
  const list = [...entries.value];
  if (sort.value === "time" && !desc.value) return list; // HAFAS order
  const dir = desc.value ? -1 : 1;
  return list.sort(
    (a, b) =>
      dir * collator.compare(sortValue(a, sort.value), sortValue(b, sort.value)) ||
      collator.compare(a.when.planned, b.when.planned),
  );
});

function open(e?: BoardEntry) {
  if (e) void router.push(`/train/${encodeURIComponent(e.journeyId)}`);
}

useKeys({
  j: () => (sel.value = Math.min(rows.value.length - 1, sel.value + 1)),
  k: () => (sel.value = Math.max(0, sel.value - 1)),
  Enter: () => open(rows.value[sel.value]),
  h: () => void more(-1),
  l: () => void more(1),
  a: () => setQuery({ arr: arrivals.value ? undefined : "" }),
  f: () => toggleFavourite({ id: id.value, name: name.value }),
});

watch(sel, (i) =>
  document.querySelector(`[data-row="${i}"]`)?.scrollIntoView({ block: "nearest" }),
);
</script>

<template>
  <section>
    <div class="flex flex-wrap items-center gap-2">
      <h1 class="m-0 text-xl">{{ name || id }}</h1>
      <button
        class="btn border-0 text-lg"
        :class="isFavourite(id) ? 'text-[var(--warn)]' : 'muted'"
        v-tip="$t('search.favourites') + ' (f)'"
        :aria-label="$t('search.favourites') + ' (f)'"
        @click="toggleFavourite({ id, name })"
      >
        ★
      </button>
      <span class="muted mono text-xs">{{ id }}</span>
      <!-- Wikidata item of the station, looked up by its IBNR (P954 = HAFAS id) -->
      <a
        :href="stationWikidata(id)"
        target="_blank"
        rel="noopener"
        class="text-xs"
        v-tip="$t('board.wikidataTip')"
        >Wikidata ↗</a
      >
      <!-- the printed-style departure poster of the timetable (GTFS) -->
      <RouterLink :to="`/station/${id}/plan`" class="text-xs" v-tip="$t('poster.linkTip')">{{
        $t("poster.link")
      }}</RouterLink>
      <div class="ml-auto flex gap-1">
        <button class="btn" :class="!arrivals && 'btn-on'" @click="setQuery({ arr: undefined })">
          {{ $t("board.departures") }}
        </button>
        <button class="btn" :class="arrivals && 'btn-on'" @click="setQuery({ arr: '' })">
          {{ $t("board.arrivals") }} <span class="kbd">a</span>
        </button>
      </div>
    </div>

    <div class="my-2 flex flex-wrap items-center gap-1 text-xs">
      <span class="chips flex flex-wrap gap-1">
        <button
          v-for="g in PRODUCT_GROUPS"
          :key="g.id"
          class="btn chip py-0.5 text-xs"
          :class="products & g.cls ? 'btn-on' : 'muted line-through'"
          @click="toggleProduct(g.cls)"
        >
          {{ $t(`products.${g.id}`) }}
        </button>
      </span>
      <span class="ml-auto flex flex-wrap items-center gap-1">
        <button class="btn" :disabled="paging || !entries.length" @click="more(-1)">
          ‹ {{ $t("board.earlier") }} <span class="kbd">h</span>
        </button>
        <input
          type="datetime-local"
          class="input text-xs"
          :aria-label="$t('board.time')"
          :value="t || toLocalInput()"
          @change="setQuery({ t: ($event.target as HTMLInputElement).value || undefined })"
        />
        <button v-if="t" class="btn" @click="setQuery({ t: undefined })">
          {{ $t("search.now") }}
        </button>
        <button class="btn" :disabled="paging || !entries.length" @click="more(1)">
          {{ $t("board.later") }} <span class="kbd">l</span> ›
        </button>
        <label class="ml-2 flex items-center gap-1 muted" v-tip="$t('board.autoRefresh')">
          <input v-model="auto" type="checkbox" /> ⟳ 30s
        </label>
      </span>
    </div>

    <Status
      :loading="board.loading.value && !rows.length"
      :error="board.error.value ?? pageError"
      @retry="board.run"
    />

    <div class="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div class="min-w-0">
        <table v-if="rows.length" class="dense">
          <caption class="sr-only">
            {{ arrivals ? $t("board.arrivals") : $t("board.departures") }}
            {{ name }}
          </caption>
          <thead>
            <tr>
              <SortHeader :active="sort === 'time'" :desc="desc" @sort="sortBy('time')">
                {{ $t("board.time") }}
              </SortHeader>
              <SortHeader :active="sort === 'line'" :desc="desc" @sort="sortBy('line')">
                {{ $t("board.line") }}
              </SortHeader>
              <SortHeader :active="sort === 'direction'" :desc="desc" @sort="sortBy('direction')">
                {{ arrivals ? $t("board.from") : $t("board.direction") }}
              </SortHeader>
              <SortHeader
                class="text-right"
                :active="sort === 'platform'"
                :desc="desc"
                @sort="sortBy('platform')"
              >
                {{ $t("board.platform") }}
              </SortHeader>
            </tr>
          </thead>
          <tbody>
            <template v-for="(e, i) in rows" :key="e.journeyId + e.when.planned">
              <tr
                :data-row="i"
                class="cursor-pointer"
                :class="[i === sel && 'sel', e.cancelled && 'opacity-60']"
                @click="expanded = expanded === e.journeyId ? undefined : e.journeyId"
                @dblclick="open(e)"
              >
                <td class="w-20"><EventTime :ev="e.when" show-actual /></td>
                <td class="w-28"><LineBadge :line="e.line" /></td>
                <td>
                  <RouterLink
                    :to="`/train/${encodeURIComponent(e.journeyId)}`"
                    class="text-[var(--fg)]"
                    @click.stop
                    >{{ e.direction }}</RouterLink
                  >
                  <span v-if="e.cancelled" class="ml-2 text-xs text-[var(--bad)]">{{
                    $t("board.cancelled")
                  }}</span>
                  <span
                    v-if="e.remarks.some((r) => r.kind === 'warning')"
                    class="ml-1 text-[var(--warn)]"
                    v-tip="'!'"
                    >⚠</span
                  >
                  <span
                    v-if="e.line.operator && e.line.operator !== 'ÖBB'"
                    class="muted ml-2 text-xs hide-sm"
                    >{{ e.line.operator }}</span
                  >
                </td>
                <td class="w-12 text-right"><Platform :ev="e.when" /></td>
              </tr>
              <tr v-if="expanded === e.journeyId">
                <td colspan="4" class="bg-[var(--bg2)]">
                  <Remarks :remarks="e.remarks" />
                  <RouterLink :to="`/train/${encodeURIComponent(e.journeyId)}`" class="text-xs"
                    >{{ $t("trip.title") }} →</RouterLink
                  >
                </td>
              </tr>
            </template>
          </tbody>
        </table>
        <p v-else-if="!board.loading.value && !board.error.value" class="muted">
          {{ $t("board.empty") }}
        </p>
        <p v-if="rows.length" class="muted mt-2 text-xs">
          {{ hhmm(rows[0]?.when.planned) }} – {{ hhmm(rows.at(-1)?.when.planned) }} ·
          {{ rows.length }} <span class="keys-only">·</span> <span class="kbd">j</span>/<span
            class="kbd"
            >k</span
          > <span class="kbd">↵</span>
        </p>
      </div>
      <!-- station plan: OSM Carto at high zoom shows building, platforms (numbers), entrances, lifts -->
      <details
        v-if="coords"
        :key="id"
        class="xl:sticky xl:top-2 xl:order-last"
        :open="mapOpen"
        @toggle="onMapToggle"
      >
        <summary class="muted cursor-pointer py-1 text-xs select-none">
          {{ $t("board.stationMap") }}
        </summary>
        <!-- loaded only once the panel is opened -->
        <MapView
          v-if="mapOpen"
          :center="coords"
          :zoom="17"
          base="osm"
          :fit="false"
          height="380px"
        />
      </details>
    </div>
  </section>
</template>
