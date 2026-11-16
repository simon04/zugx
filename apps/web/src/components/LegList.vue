<script setup lang="ts">
// Vertical leg list for one journey: legs, transfers, collapsible stopovers.
import type { Journey, Leg } from "@zugx/hafas";
import { ref } from "vue";
import { fmtDuration, ms } from "../lib/format.ts";
import EventTime from "./EventTime.vue";
import LineBadge from "./LineBadge.vue";
import { trainSlug } from "../lib/url.ts";
import Platform from "./Platform.vue";
import Remarks from "./Remarks.vue";

const props = defineProps<{ journey: Journey }>();
const emit = defineEmits<{ missed: [leg: Leg, index: number] }>();
const openStops = ref(new Set<number>());

function toggle(i: number) {
  const s = new Set(openStops.value);
  if (s.has(i)) s.delete(i);
  else s.add(i);
  openStops.value = s;
}

function transferBefore(i: number): number | undefined {
  const legs = props.journey.legs;
  const cur = legs[i];
  if (!cur || cur.kind !== "journey") return undefined;
  for (let k = i - 1; k >= 0; k--) {
    const p = legs[k]!;
    if (p.kind === "journey") {
      return Math.round(
        (ms(cur.dep.actual ?? cur.dep.planned) - ms(p.arr.actual ?? p.arr.planned)) / 60_000,
      );
    }
  }
  return undefined;
}
</script>

<template>
  <ol class="m-0 list-none p-0">
    <li v-for="(l, i) in journey.legs" :key="i" class="relative">
      <div v-if="transferBefore(i) !== undefined" class="muted my-1 pl-24 text-xs">
        <span
          :class="
            (transferBefore(i) ?? 99) < 0
              ? 'text-[var(--bad)]'
              : (transferBefore(i) ?? 99) < 5
                ? 'text-[var(--warn)]'
                : ''
          "
        >
          ⇄ {{ $t("journeys.transfer", { min: transferBefore(i) }) }}
          <template v-if="(transferBefore(i) ?? 99) < 5"> · {{ $t("journeys.tight") }}</template>
        </span>
        <button class="btn ml-2 py-0 text-[0.6875rem]" @click="emit('missed', l, i)">
          {{ $t("journeys.missed") }}
        </button>
      </div>
      <div v-if="l.kind !== 'journey'" class="muted my-1 pl-24 text-xs">
        🚶 {{ $t("journeys.walk", { min: l.duration ?? 0 }) }} · {{ l.origin.name }}
        <template v-if="l.destination.id !== l.origin.id"> → {{ l.destination.name }}</template>
      </div>
      <div
        v-else
        class="grid grid-cols-[5.5rem_1fr_auto] gap-x-2 border-l-4 py-1 pl-2"
        :style="{ borderColor: 'var(--line)' }"
      >
        <EventTime :ev="l.dep" show-actual />
        <RouterLink :to="`/station/${l.origin.id}`" class="font-medium text-[var(--fg)]">{{
          l.origin.name
        }}</RouterLink>
        <span class="text-right text-xs"><Platform :ev="l.dep" /></span>

        <span />
        <div class="py-1">
          <RouterLink
            v-if="l.journeyId"
            :to="`/train/${encodeURIComponent(l.journeyId)}`"
            class="no-underline"
          >
            <LineBadge :line="l.line" />
          </RouterLink>
          <!-- timetable search (Live off): no HAFAS journey id, the train page by name and day -->
          <RouterLink
            v-else-if="l.line"
            :to="{
              path: `/train/${trainSlug(l.line.name)}`,
              query: { d: l.dep.planned.slice(0, 10) },
            }"
            class="no-underline"
          >
            <LineBadge :line="l.line" />
          </RouterLink>
          <span v-if="l.direction" class="ml-2 text-sm">→ {{ l.direction }}</span>
          <span class="muted ml-2 text-xs">{{
            fmtDuration(Math.round((ms(l.arr.planned) - ms(l.dep.planned)) / 60000))
          }}</span>
          <span v-if="l.line?.operator" class="muted ml-2 text-xs hide-sm">{{
            l.line.operator
          }}</span>
          <button
            v-if="(l.stopovers?.length ?? 0) > 2"
            class="btn ml-2 py-0 text-[0.6875rem]"
            @click="toggle(i)"
          >
            {{ $t("journeys.stops", { n: (l.stopovers?.length ?? 2) - 2 }) }}
            {{ openStops.has(i) ? "▴" : "▾" }}
          </button>
          <ol v-if="openStops.has(i)" class="m-0 mt-1 list-none p-0 text-xs">
            <li
              v-for="(s, k) in l.stopovers?.slice(1, -1)"
              :key="k"
              class="flex gap-2"
              :class="s.cancelled && 'line-through muted'"
            >
              <EventTime :ev="s.dep ?? s.arr" class="w-14" />
              <RouterLink :to="`/station/${s.stop.id}`" class="text-[var(--fg)]">{{
                s.stop.name
              }}</RouterLink>
              <span class="ml-auto"><Platform :ev="s.dep ?? s.arr" /></span>
            </li>
          </ol>
          <Remarks :remarks="l.remarks" compact />
        </div>
        <span />

        <EventTime :ev="l.arr" show-actual />
        <RouterLink :to="`/station/${l.destination.id}`" class="font-medium text-[var(--fg)]">{{
          l.destination.name
        }}</RouterLink>
        <span class="text-right text-xs"><Platform :ev="l.arr" /></span>
      </div>
    </li>
  </ol>
</template>
