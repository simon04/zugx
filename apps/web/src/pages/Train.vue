<script setup lang="ts">
// Train run ("Zuglauf"): by journey id, or friendly /train/RJX-260?d=2026-11-13.
import { useAutoRefresh } from "../lib/refresh.ts";
import type { Stopover, Trip, TripMatch } from "@zugx/hafas";
import { computed, defineAsyncComponent, onMounted, ref, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import LineBadge from "../components/LineBadge.vue";
import Remarks from "../components/Remarks.vue";
import TrainParts from "../components/TrainParts.vue";
import TripStops from "../components/TripStops.vue";
import Status from "../components/Status.vue";
import { api } from "../lib/api.ts";
import { findTrains } from "../lib/find-train.ts";
import { addDays, fromLocalInput, hhmm, ms } from "../lib/format.ts";
import { delayColor, fmtSignedDelay } from "../lib/delay.ts";
import { lineColor } from "../lib/products.ts";
import { isJourneyId, slugToTrain, trainSlug } from "../lib/url.ts";
import DelaySparkline from "../viz/DelaySparkline.vue";
import type { MapLine, MapPoint } from "../viz/MapView.vue";
// MapLibre (~300 KB gzip) only when the map is shown: the page renders without waiting for it
const MapView = defineAsyncComponent(() => import("../viz/MapView.vue"));

const route = useRoute();
const router = useRouter();
const id = computed(() => String(route.params.id));
const date = computed(() => (typeof route.query.d === "string" ? route.query.d : ""));

const trip = shallowRef<Trip>();
const matches = shallowRef<TripMatch[]>([]);
const loading = ref(false);
const error = ref<string>();
const now = ref(Date.now());

async function load(background = false) {
  loading.value = true;
  error.value = undefined;
  try {
    let jid = id.value;
    if (!isJourneyId(jid)) {
      const name = slugToTrain(jid);
      const when = (date.value && fromLocalInput(date.value)) || Temporal.Now.instant();
      matches.value = await findTrains(name, when);
      if (matches.value.length !== 1) {
        trip.value = undefined;
        if (!matches.value.length) error.value = "notFound";
        return;
      }
      jid = matches.value[0]!.journeyId;
    }
    trip.value = await api(background).trip(jid, true);
    document.title = `${trip.value.line.name} → ${trip.value.direction} · zugx`;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

watch([id, date], () => load());
onMounted(() => load());
useAutoRefresh(() => {
  now.value = Date.now();
  if (trip.value) void load(true);
}, 30_000);

const t = (s: Stopover) => ms(s.dep?.actual ?? s.dep?.planned ?? s.arr?.actual ?? s.arr?.planned);
const tArr = (s: Stopover) =>
  ms(s.arr?.actual ?? s.arr?.planned ?? s.dep?.actual ?? s.dep?.planned);

/** index of the last stop the train has departed from (−1 = not started) */
const position = computed(() => {
  const st = trip.value?.stopovers ?? [];
  let last = -1;
  st.forEach((s, i) => {
    if (t(s) <= now.value) last = i;
  });
  return last;
});

const lines = computed<MapLine[]>(() => {
  const tr = trip.value;
  if (!tr) return [];
  const coords =
    tr.polyline ??
    tr.stopovers
      .filter((s) => s.stop.lat)
      .map((s) => [s.stop.lat!, s.stop.lon!] as [number, number]);
  return [{ coords, color: lineColor(tr.line) }];
});
/** delay at a stop: departure, else arrival (undefined = no realtime data) */
const delayOf = (s: Stopover) => (s.cancelled ? undefined : (s.dep?.delay ?? s.arr?.delay));

const points = computed<MapPoint[]>(() =>
  (trip.value?.stopovers ?? [])
    .filter((s) => s.stop.lat)
    .map((s, i) => ({
      lat: s.stop.lat!,
      lon: s.stop.lon!,
      label: `${s.stop.name} ${hhmm(s.arr?.planned ?? s.dep?.planned)}${delayOf(s) === undefined ? "" : ` · ${fmtSignedDelay(delayOf(s)!)}`}`,
      id: s.stop.id,
      // delay colours as on the radar; passed stops slightly smaller via no "big"
      color: delayColor(delayOf(s)),
      stroke: "#fff", // stands out on the (category-coloured) route line
      big: i > position.value,
    })),
);

/** "RJX 162" or, for S-Bahn lines, category + train number ("S 22734") */
const trainName = computed(() => {
  const l = trip.value?.line;
  if (!l) return "";
  return l.trainNumber ? `${l.category.toUpperCase()} ${l.trainNumber}` : l.name;
});

const tripDate = computed(() => {
  const d = trip.value?.date;
  return d ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : "";
});

function goDay(delta: number) {
  if (!trip.value) return;
  void router.push({
    path: `/train/${trainSlug(trainName.value)}`,
    query: { d: addDays(tripDate.value, delta) },
  });
}
</script>

<template>
  <section>
    <Status
      :loading="loading && !trip && !matches.length"
      :error="error && error !== 'notFound' ? error : undefined"
      @retry="load"
    />
    <p v-if="error === 'notFound'" class="muted">
      {{ $t("trip.notFound") }} ({{ slugToTrain(id) }})
    </p>

    <ul v-if="!trip && matches.length > 1" class="m-0 list-none p-0">
      <li v-for="m in matches" :key="m.journeyId" class="my-1">
        <RouterLink
          :to="`/train/${encodeURIComponent(m.journeyId)}`"
          class="flex items-center gap-2 text-[var(--fg)]"
        >
          <LineBadge :line="m.line" />
          <span
            >{{ m.origin?.name }} {{ hhmm(m.dep?.planned) }} → {{ m.destination?.name }}
            {{ hhmm(m.arr?.planned) }}</span
          >
        </RouterLink>
      </li>
    </ul>

    <template v-if="trip">
      <div class="flex flex-wrap items-center gap-2">
        <LineBadge :line="trip.line" />
        <h1 class="m-0 text-xl">→ {{ trip.direction }}</h1>
        <span class="muted text-sm"
          >{{ trip.line.categoryLong
          }}<template v-if="trip.line.operator"> · {{ trip.line.operator }}</template></span
        >
        <span class="ml-auto flex items-center gap-1 text-sm">
          <button
            class="btn"
            :aria-label="$t('bf.prevDay')"
            v-tip="$t('bf.prevDay')"
            @click="goDay(-1)"
          >
            ‹
          </button>
          <span class="mono">{{ tripDate }}</span>
          <button
            class="btn"
            :aria-label="$t('bf.nextDay')"
            v-tip="$t('bf.nextDay')"
            @click="goDay(1)"
          >
            ›
          </button>
          <RouterLink :to="`/trains?q=${encodeURIComponent(trainName)}`" class="btn">{{
            $t("nav.trains")
          }}</RouterLink>
        </span>
      </div>
      <p v-if="trip.runningDays" class="muted my-1 text-xs">
        {{ $t("trip.runningDays") }}: {{ trip.runningDays }}
      </p>
      <Remarks :remarks="trip.remarks" class="my-2" />
      <TrainParts :trip="trip" class="card my-2 p-2" />

      <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div class="card p-3">
          <h2 class="muted m-0 mb-1 text-xs uppercase">{{ $t("trip.delayProfile") }}</h2>
          <DelaySparkline :stops="trip.stopovers" />
          <TripStops :trip="trip" :now="now" class="mt-2" />
        </div>
        <MapView
          :lines="lines"
          :points="points"
          height="560px"
          @click-point="(sid) => router.push(`/station/${sid}`)"
        />
      </div>
    </template>
  </section>
</template>
