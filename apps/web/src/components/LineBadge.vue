<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "../i18n/index.ts";
import { categoryBadgeColor, lineBadgeColor } from "../lib/products.ts";
import { lineFor } from "../lib/lines.ts";
import type { Line } from "@zugx/hafas";

const props = defineProps<{ line?: Line; cat?: string; nr?: string; small?: boolean }>();
/**
 * regional trains: line and train number ("S 2 | 22734", "REX 1 | 22332") — from live data, or
 * the line looked up from the timetable where only category and train number are known
 */
const NO_TRAIN_NR = new Set(["bus", "tram", "subway", "ferry", "cable", "ondemand"]);
const parts = computed((): { label: string; nr?: string } => {
  const l = props.line;
  // buses, trams, metro: their trip numbers are internal, the line is enough
  if (l && NO_TRAIN_NR.has(l.product)) return { label: l.name };
  if (l?.trainNumber) return { label: l.name, nr: l.trainNumber };
  const cat = l?.category ?? props.cat ?? "";
  const nr = l ? l.number : (props.nr ?? "");
  const line = /^\d{3,}$/.test(nr) ? lineFor(cat, nr) : undefined;
  if (line) return { label: line, nr };
  return { label: l?.name ?? `${cat} ${nr}`.trim() };
});
const label = computed(() => parts.value.label);
const trainNr = computed(() => parts.value.nr);
const { t } = useI18n();
const title = computed(() => {
  const l = props.line;
  if (!l) return undefined;
  const parts = [
    l.categoryLong,
    l.trainNumber && `${t("trip.trainNumber")} ${l.trainNumber}`,
    l.operator,
  ];
  return parts.filter(Boolean).join(" · ") || undefined;
});
const color = computed(() =>
  props.line ? lineBadgeColor(props.line) : categoryBadgeColor(props.cat ?? "", props.nr),
);
</script>

<template>
  <span
    class="mono inline-block whitespace-nowrap rounded px-1.5 font-semibold text-white"
    :class="small ? 'text-[0.6875rem] leading-4' : 'text-xs leading-5'"
    :style="{ background: color }"
    v-tip="title"
    >{{ label }}<span v-if="trainNr" class="nr">{{ trainNr }}</span></span
  >
</template>

<style scoped>
/* train number of a line (S 2, REX 1): lighter, after a thin gap */
.nr {
  margin-left: 0.4em;
  padding-left: 0.4em;
  border-left: 1px solid rgb(255 255 255 / 0.45);
  font-weight: 400;
}
</style>
