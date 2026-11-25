<script setup lang="ts">
// Placeholder of the train-run panel while its code loads (TripPanel is loaded on first use): the
// panel opens at once, so a tap visibly worked even on a slow connection. Train from ?train=.
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { slugToTrain } from "../lib/url.ts";

const route = useRoute();
const router = useRouter();
const name = computed(() =>
  typeof route.query.train === "string" ? slugToTrain(route.query.train) : "",
);
const close = () => {
  const { train: _, ...q } = route.query;
  void router.replace({ query: q });
};
</script>

<template>
  <aside
    class="card trip-panel flex flex-col overflow-hidden shadow-xl"
    :aria-label="$t('trip.title')"
  >
    <header class="flex items-start gap-2 border-b border-[var(--line)] p-2">
      <div class="min-w-0 flex-1 text-sm">
        <strong>{{ name }}</strong>
        <span class="muted ml-2 animate-pulse" role="status">{{ $t("common.loading") }}</span>
      </div>
      <button class="btn px-2 py-0.5" :aria-label="$t('common.close')" @click="close">✕</button>
    </header>
  </aside>
</template>
