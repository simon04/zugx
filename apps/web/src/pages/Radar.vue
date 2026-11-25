<script setup lang="ts">
// Live train positions (HAFAS JourneyGeoPos) for the visible map area; with ?ago=<min> as they
// were up to 3 hours ago (HAFAS answers past times; its realtime fades after about an hour).
import { useAutoRefresh } from "../lib/refresh.ts";
import { groupMovements, type Line, type Movement, type Trip } from "@zugx/hafas";
import type { Map as MlMap } from "maplibre-gl";
import { useDebounceFn, useLocalStorage, useMediaQuery } from "@vueuse/core";
import { viennaNow } from "../lib/format.ts";
import { computed, ref, shallowRef, watch } from "vue";
import { useI18n } from "../i18n/index.ts";
import { useRoute, useRouter } from "vue-router";
import LineBadge from "../components/LineBadge.vue";
import Remarks from "../components/Remarks.vue";
import TrainParts from "../components/TrainParts.vue";
import TripStops from "../components/TripStops.vue";
import { useKeys } from "../lib/keys.ts";
import Status from "../components/Status.vue";
import { api } from "../lib/api.ts";
import { lineBadgeColor, lineColor, PRODUCT_GROUPS, RAIL_CLS } from "../lib/products.ts";
import {
  classColor,
  DELAY_CLASSES,
  delayClass,
  delayColor,
  fmtSignedDelay,
  delayPalette,
  NO_DATA,
} from "../lib/delay.ts";
import MapView, { type MapLine, type MapPoint } from "../viz/MapView.vue";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const movements = shallowRef<Movement[]>([]);
const error = ref<string>();
const loading = ref(false);
const products = ref(RAIL_CLS);
let map: MlMap | undefined;

// ---- look back: minutes before now (0 = live), in steps of 5, ?ago= in the URL (linkable)
const MAX_AGO = 180;
const ago = computed<number>({
  get: () => {
    const n = Number(route.query.ago);
    return Number.isFinite(n) ? Math.min(MAX_AGO, Math.max(0, Math.round(n / 5) * 5)) : 0;
  },
  set: (v) => {
    const { ago: _, ...q } = route.query;
    void router.replace({ query: v > 0 ? { ...q, ago: String(v) } : q });
  },
});
/** the slider's value while dragging (the URL and the query follow, debounced) */
const agoInput = ref(ago.value);
watch(ago, (v) => (agoInput.value = v));
const commitAgo = useDebounceFn(() => (ago.value = agoInput.value), 300);
watch(agoInput, () => void commitAgo());
watch(ago, () => void refresh());
/** the shown time ("14:35"), Vienna */
const agoClock = computed(() => {
  void now.value;
  return viennaNow().subtract({ minutes: agoInput.value }).toPlainTime().toString().slice(0, 5);
});

async function refresh(background = false) {
  if (!map) return;
  const b = map.getBounds();
  loading.value = true;
  try {
    movements.value = await api(background).radar(
      { north: b.getNorth(), south: b.getSouth(), west: b.getWest(), east: b.getEast() },
      {
        results: 1000,
        products: products.value,
        ...(ago.value ? { when: Temporal.Now.instant().subtract({ minutes: ago.value }) } : {}),
      },
    );
    error.value = undefined;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

function onReady(m: MlMap) {
  map = m;
  void refresh();
}
const onMove = useDebounceFn(() => void refresh(), 400);
useAutoRefresh(() => void refresh(true), 15_000);

// ---- selected train: its run in a side panel on the radar (like vonatinfo), ?trip=<journey id>.
// Opening pushes a history entry, so "back" closes the panel.
const selectedId = computed(() =>
  typeof route.query.trip === "string" ? route.query.trip : undefined,
);
const selected = shallowRef<Trip>();
const selError = ref<string>();
const now = ref(Date.now());
/** the time shown: now, or `ago` minutes before (the train panel's position follows it) */
const shownNow = computed(() => now.value - ago.value * 60_000);
async function loadSelected(background = false) {
  const jid = selectedId.value;
  if (!jid) {
    selected.value = undefined;
    return;
  }
  selError.value = undefined;
  try {
    const trip = await api(background).trip(jid, true);
    if (selectedId.value === jid) selected.value = trip;
  } catch (e) {
    selError.value = e instanceof Error ? e.message : String(e);
  }
}
watch(
  selectedId,
  (jid, old) => {
    if (jid !== old) selected.value = undefined;
    void loadSelected();
  },
  { immediate: true },
);
useAutoRefresh(() => {
  now.value = Date.now();
  if (selectedId.value) void loadSelected(true);
}, 30_000);
const select = (jid: string) => void router.push({ query: { ...route.query, trip: jid } });
const closePanel = () => {
  const { trip: _, ...q } = route.query;
  void router.replace({ query: q });
};
useKeys({ Escape: () => selectedId.value && closePanel() });
const selectedMovement = computed(() =>
  movements.value.find((m) => m.journeyId === selectedId.value),
);
/** the coupled parts of the selected train set (one badge each; a click switches the run shown) */
const selectedParts = computed(
  () => groups.value.find((g) => g.some((p) => p.journeyId === selectedId.value)) ?? [],
);
const switchPart = (jid: string) => void router.replace({ query: { ...route.query, trip: jid } });
/** the selected train's route on the map (polyline, else the stops) */
const routeLines = computed<MapLine[]>(() => {
  const tr = selected.value;
  if (!tr) return [];
  const coords =
    tr.polyline ??
    tr.stopovers
      .filter((s) => s.stop.lat)
      .map((s) => [s.stop.lat!, s.stop.lon!] as [number, number]);
  return [{ coords, color: lineColor(tr.line) }];
});

// colour by delay (scale like MÁV's vonatinfo) or by train category
const mode = useLocalStorage<"delay" | "category">("zugx:radar-mode", "delay");

/** coupled train parts at the same position as one train set, likely operational part first */
const groups = computed(() => groupMovements(movements.value));
/** desktop: controls and legend open; phones: collapsed (more map) */
const wide = useMediaQuery("(min-width: 641px)");
const shownGroups = computed(
  () => PRODUCT_GROUPS.slice(0, 7).filter((g) => products.value & g.cls).length,
);

const counts = computed(() => {
  const c: Record<string, number> = Object.fromEntries(
    [...DELAY_CLASSES.map((d) => d.id), "nodata"].map((id) => [id, 0]),
  );
  for (const [m] of groups.value) {
    const cls = delayClass(m!.delay);
    c[cls]!++;
  }
  return c;
});

/** "RJX 162", "S 2 (22734)" — always show the train number */
/** " · +7′", " · −2′" (early), " · ±0′", or " · no realtime data" */
/** category legend: categories in view, most frequent first (max. 10) */
const catCounts = computed(() => {
  const m = new Map<string, { cat: string; n: number; color: string }>();
  for (const [mv] of groups.value) {
    if (!mv) continue;
    const cat = mv.line.category.toUpperCase() || "?";
    const e = m.get(cat) ?? { cat, n: 0, color: lineColor(mv.line) };
    e.n++;
    m.set(cat, e);
  }
  return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 10);
});

/**
 * donut of the delay classes (trains with realtime data only): one arc per class, a 2px gap
 * between arcs; centre: share ≤ 5′ (the Austrian punctuality definition)
 */
const DONUT = { r: 42, w: 14, gap: 2 };
const donut = computed(() => {
  const total = DELAY_CLASSES.reduce((n, c) => n + (counts.value[c.id] ?? 0), 0);
  const C = 2 * Math.PI * DONUT.r;
  let at = 0;
  const arcs = DELAY_CLASSES.flatMap((c) => {
    const n = counts.value[c.id] ?? 0;
    if (!n) return [];
    const len = (n / total) * C;
    const arc = {
      id: c.id,
      n,
      pct: Math.round((n / total) * 100),
      dash: `${Math.max(0.5, len - DONUT.gap)} ${C}`,
      offset: -at,
    };
    at += len;
    return [arc];
  });
  const punctual = (counts.value.ontime ?? 0) + (counts.value.d1 ?? 0) + (counts.value.d3 ?? 0);
  return { total, arcs, punctual: total ? Math.round((punctual / total) * 100) : undefined };
});

const fmtDelay = (d?: number) =>
  ` · ${d === undefined ? t("radar.delay.nodata") : d > 0 ? `+${d}′` : d < 0 ? `−${-d}′` : "±0′"}`;

const points = computed<MapPoint[]>(() =>
  groups.value.map((parts) => {
    const m = parts[0]!;
    return {
      lat: m.lat,
      lon: m.lon,
      id: m.journeyId,
      color: mode.value === "delay" ? delayColor(m.delay) : lineColor(m.line),
      // train as a line badge, as in the journey search; coupled parts "NJ 466 / EN 40462"
      badge: {
        text: parts
          .map((p) =>
            p.line.trainNumber && p.line.product !== "bus"
              ? `${p.line.name} · ${p.line.trainNumber}`
              : p.line.name,
          )
          .join(" / "),
        color: lineBadgeColor(m.line),
      },
      label: `→ ${m.direction}${fmtDelay(m.delay)}`,
      bearing: m.bearing,
      big: parts.some((p) => p.journeyId === selectedId.value),
    };
  }),
);

function toggle(cls: number) {
  products.value = products.value ^ cls || RAIL_CLS;
  void refresh();
}
</script>

<template>
  <section>
    <div class="mb-2 flex flex-wrap items-center gap-2" :class="!wide && 'sr-only'">
      <h1 class="m-0 text-xl">{{ $t("radar.title") }}</h1>
      <span class="muted text-sm">{{ $t("radar.trains", { n: groups.length }) }}</span>
      <span v-if="loading" class="muted animate-pulse text-xs">●</span>
      <span id="radar-bar" class="contents" />
    </div>
    <!-- colour mode and train filter: compact dropdowns — in the bar on desktop (open), on the map
         on phones (closed, more map) -->
    <Teleport defer :to="wide ? '#radar-bar' : '#radar-map-ctl'">
      <details class="ctl" :open="wide">
        <summary class="btn chip py-0.5 text-xs">
          {{ $t("radar.colour") }}:
          <b>{{ mode === "delay" ? $t("radar.byDelay") : $t("radar.byCategory") }}</b>
        </summary>
        <span class="ctl-body" role="radiogroup" :aria-label="$t('radar.colour')">
          <button
            class="btn chip py-0.5 text-xs"
            role="radio"
            :aria-checked="mode === 'delay'"
            :class="mode === 'delay' && 'btn-on'"
            @click="mode = 'delay'"
          >
            {{ $t("radar.byDelay") }}
          </button>
          <button
            class="btn chip py-0.5 text-xs"
            role="radio"
            :aria-checked="mode === 'category'"
            :class="mode === 'category' && 'btn-on'"
            @click="mode = 'category'"
          >
            {{ $t("radar.byCategory") }}
          </button>
        </span>
      </details>
      <details class="ctl" :open="wide || ago > 0">
        <summary class="btn chip py-0.5 text-xs" :class="ago > 0 && 'btn-on'">
          {{ $t("radar.time") }}:
          <b>{{ agoInput ? `−${agoInput}′ (${agoClock})` : $t("radar.live") }}</b>
        </summary>
        <span class="ctl-body items-center">
          <input
            v-model.number="agoInput"
            class="ago"
            type="range"
            min="0"
            :max="MAX_AGO"
            step="5"
            dir="rtl"
            :aria-label="$t('radar.agoLabel')"
            :aria-valuetext="agoInput ? `−${agoInput}′ (${agoClock})` : $t('radar.live')"
            v-tip="$t('radar.agoTip')"
          />
          <button v-if="agoInput" class="btn chip py-0.5 text-xs" @click="agoInput = 0">
            {{ $t("radar.backToLive") }}
          </button>
        </span>
      </details>
      <details class="ctl" :open="wide">
        <summary class="btn chip py-0.5 text-xs">
          {{ $t("radar.trainsFilter") }}
          <b>{{ shownGroups }}/{{ PRODUCT_GROUPS.slice(0, 7).length }}</b>
        </summary>
        <span class="ctl-body chips">
          <button
            v-for="g in PRODUCT_GROUPS.slice(0, 7)"
            :key="g.id"
            class="btn chip py-0.5 text-xs"
            :class="products & g.cls ? 'btn-on' : 'muted line-through'"
            @click="toggle(g.cls)"
          >
            {{ $t(`products.${g.id}`) }}
          </button>
        </span>
      </details>
    </Teleport>
    <Status :error="error" @retry="refresh" />
    <div class="relative">
      <div
        id="radar-map-ctl"
        class="map-ctl absolute top-2 right-12 left-2 z-10 flex flex-wrap items-start gap-1"
      />
      <div
        v-if="loading && !movements.length"
        class="card absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 px-4 py-2 text-sm shadow"
        role="status"
      >
        <span class="inline-block animate-spin">⟳</span> {{ $t("radar.loading") }}
      </div>
      <MapView
        :points="points"
        :lines="routeLines"
        :fit="false"
        height="calc(100vh - 170px)"
        @ready="onReady"
        @moveend="onMove"
        @click-point="select"
      />
      <!-- train run of the clicked train: side panel (desktop) / bottom sheet (phones) -->
      <aside
        v-if="selectedId"
        class="card radar-panel absolute z-20 flex flex-col overflow-hidden shadow-xl"
        :aria-label="$t('trip.title')"
      >
        <header class="flex items-start gap-2 border-b border-[var(--line)] p-2">
          <div v-if="selected" class="min-w-0 flex-1">
            <div
              v-if="selectedParts.length > 1"
              class="mb-1 flex flex-wrap items-center gap-1"
              role="group"
              :aria-label="$t('radar.parts')"
            >
              <template v-for="(p, k) in selectedParts" :key="p.journeyId"
                ><span v-if="k" class="muted">/</span
                ><button
                  class="part"
                  :class="p.journeyId === selectedId && 'part-on'"
                  :aria-pressed="p.journeyId === selectedId"
                  v-tip="$t('radar.partTip', { train: p.line.name })"
                  @click="switchPart(p.journeyId)"
                >
                  <LineBadge :line="p.line" small /></button
              ></template>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <LineBadge :line="selected.line" />
              <strong class="truncate text-sm">→ {{ selected.direction }}</strong>
            </div>
            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span
                v-if="selectedMovement?.delay !== undefined"
                class="rounded px-1.5 py-0.5 font-semibold text-black"
                :style="{ background: delayColor(selectedMovement.delay) }"
                >{{ fmtSignedDelay(selectedMovement.delay) }}</span
              >
              <RouterLink :to="`/train/${encodeURIComponent(selectedId)}`"
                >{{ $t("radar.openTrip") }} →</RouterLink
              >
            </div>
          </div>
          <span v-else class="muted flex-1 text-sm" role="status">{{ $t("common.loading") }}</span>
          <button
            class="btn px-2 py-0.5"
            :aria-label="$t('common.close')"
            v-tip="`${$t('common.close')} (Esc)`"
            @click="closePanel"
          >
            ✕
          </button>
        </header>
        <div class="overflow-y-auto p-2">
          <Status :error="selError" @retry="loadSelected" />
          <template v-if="selected">
            <TrainParts :trip="selected" class="mb-2" />
            <TripStops :trip="selected" :now="shownNow" />
            <Remarks :remarks="selected.remarks" class="mt-3" />
          </template>
        </div>
      </aside>
      <details
        class="legend card absolute bottom-8 left-2 z-10 p-2 text-xs shadow"
        role="group"
        :aria-label="$t('radar.legend')"
        :open="wide"
      >
        <summary class="cursor-pointer">{{ $t("radar.legend") }}</summary>
        <svg
          v-if="mode === 'delay' && donut.total"
          class="donut mx-auto mb-1"
          viewBox="0 0 100 100"
          role="img"
          :aria-label="$t('radar.donutLabel', { pct: donut.punctual, n: donut.total })"
        >
          <g transform="rotate(-90 50 50)">
            <circle
              v-for="a in donut.arcs"
              :key="a.id"
              cx="50"
              cy="50"
              :r="DONUT.r"
              fill="none"
              :stroke="classColor(a.id)"
              :stroke-width="DONUT.w"
              :stroke-dasharray="a.dash"
              :stroke-dashoffset="a.offset"
              data-tip-at="pointer"
              v-tip="{
                title: $t(`radar.delay.${a.id}`),
                lines: [$t('radar.donutTip', { n: a.n, pct: a.pct })],
              }"
            />
          </g>
          <text x="50" y="50" text-anchor="middle" class="donut-pct">{{ donut.punctual }} %</text>
          <text x="50" y="63" text-anchor="middle" class="donut-sub">≤ 5′</text>
        </svg>
        <ul v-if="mode === 'delay'" class="m-0 list-none p-0">
          <li v-for="c in DELAY_CLASSES" :key="c.id" class="flex items-center gap-1.5">
            <span
              class="inline-block h-2.5 w-2.5 rounded-full border border-black"
              :style="{ background: classColor(c.id) }"
            />
            {{ $t(`radar.delay.${c.id}`) }}
            <span class="muted ml-auto pl-2 mono">{{ counts[c.id] }}</span>
          </li>
          <li class="flex items-center gap-1.5">
            <span
              class="inline-block h-2.5 w-2.5 rounded-full border border-black"
              :style="{ background: NO_DATA }"
            />
            {{ $t("radar.delay.nodata") }}
            <span class="muted ml-auto pl-2 mono">{{ counts.nodata }}</span>
          </li>
        </ul>
        <div
          v-if="mode === 'delay'"
          class="mt-1 flex gap-1"
          role="radiogroup"
          :aria-label="$t('radar.palette')"
        >
          <button
            class="btn chip py-0 text-xs"
            role="radio"
            :aria-checked="delayPalette === 'blue'"
            :class="delayPalette === 'blue' && 'btn-on'"
            v-tip="$t('radar.paletteBlueTip')"
            @click="delayPalette = 'blue'"
          >
            {{ $t("radar.paletteBlue") }}
          </button>
          <button
            class="btn chip py-0 text-xs"
            role="radio"
            :aria-checked="delayPalette === 'green'"
            :class="delayPalette === 'green' && 'btn-on'"
            @click="delayPalette = 'green'"
          >
            {{ $t("radar.paletteGreen") }}
          </button>
        </div>
        <ul v-else class="m-0 list-none p-0">
          <li v-for="c in catCounts" :key="c.cat" class="flex items-center gap-1.5">
            <span
              class="inline-block h-2.5 w-2.5 rounded-full border border-black"
              :style="{ background: c.color }"
            />
            {{ c.cat }}
            <span class="muted ml-auto pl-2 mono">{{ c.n }}</span>
          </li>
        </ul>
      </details>
    </div>
    <p class="muted mt-1 text-xs">
      {{ ago > 0 ? `${$t("radar.hint")} ${$t("radar.agoHint")}` : $t("radar.hint") }}
    </p>
  </section>
</template>

<style scoped>
/* compact dropdown controls: summary as a chip, body inline next to it */
/* on the map (phones): chips with a background, open bodies as a card */
.map-ctl .ctl > summary {
  background: var(--bg2);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
}
.map-ctl .ctl[open] {
  flex-direction: column;
  align-items: flex-start;
}
.map-ctl .ctl-body {
  padding: 0.25rem;
  border-radius: 0.375rem;
  background: var(--bg2);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
}
.ctl {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
.ctl > summary {
  list-style: none;
  cursor: pointer;
}
.ctl > summary::-webkit-details-marker {
  display: none;
}
.ctl > summary::after {
  content: " ▾";
}
.ctl[open] > summary::after {
  content: " ▴";
}
.ctl-body {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.legend > summary {
  font-weight: 600;
}
.legend[open] > summary {
  margin-bottom: 0.25rem;
}
/* look-back slider: now at the right end, older to the left (dir=rtl) */
.ago {
  width: 9rem;
  accent-color: var(--accent);
}
/* delay donut in the legend: desktop only (on phones the legend stays small) */
.donut {
  display: block;
  width: 7.5rem;
  height: 7.5rem;
}
.donut circle {
  cursor: default;
}
.donut circle:hover {
  stroke-width: 18;
}
.donut-pct {
  fill: var(--fg);
  font-size: 16px;
  font-weight: 600;
}
.donut-sub {
  fill: var(--muted);
  font-size: 9px;
}
@media (max-width: 640px) {
  .donut {
    display: none;
  }
}
/* coupled train parts: the shown one full, the others faded */
.part {
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  opacity: 0.5;
}
.part:hover,
.part-on {
  opacity: 1;
}
.part-on {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  border-radius: 0.25rem;
}
.radar-panel {
  top: 0.5rem;
  right: 0.5rem;
  bottom: 0.5rem;
  width: min(26rem, calc(100% - 1rem));
}
/* phones: bottom sheet over the lower part of the map */
@media (max-width: 640px) {
  .radar-panel {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: auto;
    max-height: 55%;
    border-radius: 0.5rem 0.5rem 0 0;
  }
}
</style>
