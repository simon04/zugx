<script setup lang="ts">
// A train's run in a side panel (desktop) / bottom sheet (phones) over the current page, like the
// radar's: header with badge, direction, current delay and a link to the full train page; joined
// train parts, the stop list and remarks. Refreshes every 30 s. Used by the Bildfahrplan.
import { currentDelay, type Trip } from "@zugx/hafas";
import { computed, ref, shallowRef, watch } from "vue";
import LineBadge from "./LineBadge.vue";
import Remarks from "./Remarks.vue";
import Status from "./Status.vue";
import TrainParts from "./TrainParts.vue";
import TripStops from "./TripStops.vue";
import { api } from "../lib/api.ts";
import { findTrains } from "../lib/find-train.ts";
import { delayColor, fmtSignedDelay } from "../lib/delay.ts";
import { fromLocalInput } from "../lib/format.ts";
import { useKeys } from "../lib/keys.ts";
import { useAutoRefresh } from "../lib/refresh.ts";
import { trainSlug } from "../lib/url.ts";

const props = defineProps<{
  /** "RJX 162" */
  name: string;
  /** service day, YYYY-MM-DD */
  date: string;
}>();
const emit = defineEmits<{ close: [] }>();

const trip = shallowRef<Trip>();
const error = ref<string>();
const now = ref(Date.now());

/** the HAFAS journey of a train name on a day (exact category/operator and number, if any) */
async function findJourney(name: string, date: string): Promise<string | undefined> {
  const when = fromLocalInput(date) || Temporal.Now.instant();
  return (await findTrains(name, when))[0]?.journeyId;
}

let jid: string | undefined;
async function load(background = false) {
  const key = `${props.name}@${props.date}`;
  error.value = undefined;
  try {
    if (!background || !jid) jid = await findJourney(props.name, props.date);
    if (!jid) {
      trip.value = undefined;
      error.value = "notFound";
      return;
    }
    const t = await api(background).trip(jid, true);
    if (key === `${props.name}@${props.date}`) trip.value = t;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}
watch(
  () => [props.name, props.date],
  () => {
    trip.value = undefined;
    jid = undefined;
    void load();
  },
  { immediate: true },
);
useAutoRefresh(() => {
  now.value = Date.now();
  if (trip.value) void load(true);
}, 30_000);
useKeys({ Escape: () => emit("close") });

const delay = computed(() => (trip.value ? currentDelay(trip.value.stopovers) : undefined));
const pageLink = computed(() => ({
  path: `/train/${trainSlug(props.name)}`,
  query: { d: props.date },
}));
</script>

<template>
  <aside
    class="card trip-panel flex flex-col overflow-hidden shadow-xl"
    :aria-label="$t('trip.title')"
  >
    <header class="flex items-start gap-2 border-b border-[var(--line)] p-2">
      <div v-if="trip" class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-1.5">
          <LineBadge :line="trip.line" />
          <strong class="truncate text-sm">→ {{ trip.direction }}</strong>
        </div>
        <div class="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span
            v-if="delay !== undefined"
            class="rounded px-1.5 py-0.5 font-semibold text-black"
            :style="{ background: delayColor(delay) }"
            >{{ fmtSignedDelay(delay) }}</span
          >
          <RouterLink :to="pageLink">{{ $t("radar.openTrip") }} →</RouterLink>
        </div>
      </div>
      <div v-else class="min-w-0 flex-1 text-sm">
        <strong>{{ name }}</strong>
        <span v-if="!error" class="muted ml-2" role="status">{{ $t("common.loading") }}</span>
      </div>
      <button
        class="btn px-2 py-0.5"
        :aria-label="$t('common.close')"
        v-tip="`${$t('common.close')} (Esc)`"
        @click="emit('close')"
      >
        ✕
      </button>
    </header>
    <div class="overflow-y-auto p-2">
      <p v-if="error === 'notFound'" class="muted m-0 text-sm">
        {{ $t("trip.notFound") }}
        <RouterLink :to="pageLink">{{ $t("radar.openTrip") }} →</RouterLink>
      </p>
      <Status v-else :error="error" @retry="load" />
      <template v-if="trip">
        <TrainParts :trip="trip" class="mb-2" />
        <TripStops :trip="trip" :now="now" />
        <Remarks :remarks="trip.remarks" class="mt-3" />
      </template>
    </div>
  </aside>
</template>
