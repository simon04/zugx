<script setup lang="ts">
// Timetable below the Bildfahrplan in the layout of the printed ÖBB Kursbuch (Fahrplanbild):
// stations as rows (with "an"/"ab" rows at the major stations and the ends), a column per train
// with category and number, "von" above and "nach" below; "|" where it passes without stopping.
// One table for the whole window, scrolling horizontally (station and an/ab columns stay put).
import type { CorridorTrain } from "@zugx/netz";
import { computed, ref, useTemplateRef, watch } from "vue";
import { useRoute } from "vue-router";
import { categoryColor } from "../lib/products.ts";
import { trainSlug } from "../lib/url.ts";
import { tableRuns, type TableRun, type TableStation } from "../lib/bf-table.ts";
import { trainKey, type LiveRun } from "../lib/bf-live.ts";
import { lineFor } from "../lib/lines.ts";

const props = defineProps<{
  stations: TableStation[];
  trains: CorridorTrain[];
  dir: 1 | -1;
  t0: number;
  t1: number;
  date: string;
  hover?: CorridorTrain;
  /** scroll the hovered train's column into view (table in its own window, hover from the chart) */
  follow?: boolean;
  /** other sheets branching off at a station (by name): linked after the name */
  sheets?: Record<string, { id: string; name: string }[]>;
  /**
   * print layout (Kursbuch PDF): columns split into pages of `perPage` trains, each page with
   * `title` as its head (and "continued"), no sticky columns
   */
  perPage?: number;
  title?: string;
  /** realtime (Echtzeit on): delay and expected time per train and station */
  live?: Map<string, LiveRun>;
}>();
/** stations with a departure plan (timetable, not live): the station name links to it */
const POSTERS = new Set(
  Object.keys(import.meta.glob("../../../../packages/trains/data/**/departures/*.toml")).map(
    (p) => /([^/]+)\.toml$/.exec(p)?.[1],
  ),
);
const stationLink = (k: number) => {
  const h = props.stations[k]?.hafasId;
  if (!h) return undefined;
  return POSTERS.has(h)
    ? { path: `/station/${h}/plan`, query: { d: props.date } }
    : `/station/${h}`;
};
/** date and time window carry over to another sheet (not its station range or options) */
const route = useRoute();
const viewQuery = computed(() =>
  Object.fromEntries(
    ["d", "from", "h"].flatMap((k) => (route.query[k] ? [[k, route.query[k]]] : [])),
  ),
);
const emit = defineEmits<{ hover: [t: CorridorTrain | undefined] }>();

const runs = computed(() => tableRuns(props.stations, props.trains, props.dir, props.t0, props.t1));

/** realtime of a cell (the row's arrival or departure), if known */
function liveAt(r: TableRun, row: { k: number; kind?: "an" | "ab" }) {
  const run = props.live?.get(trainKey(r.t.cat, r.t.nr));
  const ci = props.stations[row.k]?.i;
  const p = run?.pts.find((x) => x.i === ci);
  if (!p) return undefined;
  const e = row.kind === "an" ? (p.arr ?? p.dep) : (p.dep ?? p.arr);
  if (e?.rt === undefined) return undefined;
  const delay = Math.round(e.rt - e.plan);
  return {
    delay,
    rt: e.rt,
    text: delay > 0 ? `+${delay}` : delay < 0 ? `−${-delay}` : "±0",
    cls: delay >= 5 ? "late" : delay >= 1 ? "slight" : "ontime",
  };
}

/** Kursbuch time: hour and minutes separated by a thin space, e.g. "5 03" */
const time = (min: number | null) =>
  min === null
    ? ""
    : `${Math.floor(min / 60) % 24} ${String(Math.round(min) % 60).padStart(2, "0")}`;

interface Row {
  k: number;
  name?: string;
  /** "an" / "ab" / none */
  kind?: "an" | "ab";
  major: boolean;
  /** alternating grey bands, switching at every major station (as in the book) */
  band: boolean;
}
const rows = computed<Row[]>(() => {
  const last = props.stations.length - 1;
  const out: Row[] = [];
  let band = false;
  props.stations.forEach((s, k) => {
    if (s.major && k > 0) band = !band;
    const base = { k, major: s.major, band };
    if (k === 0) out.push({ ...base, name: s.name, kind: "ab" });
    else if (k === last) out.push({ ...base, name: s.name, kind: "an" });
    else if (s.major) {
      out.push({ ...base, name: s.name, kind: "an", band: !band });
      out.push({ ...base, name: s.name, kind: "ab" });
    } else out.push({ ...base, name: s.name });
  });
  return out;
});
function cell(r: TableRun, row: Row): string {
  const x = r.at[row.k];
  if (!x) return "";
  if (x.pass) return "|";
  // the train starts here: no arrival; ends here: no departure
  if (row.kind === "an") return row.k === r.firstK ? "" : time(x.a ?? x.d);
  if (row.kind === "ab") return row.k === r.lastK ? "" : time(x.d ?? x.a);
  return time(x.d ?? x.a);
}

const root = useTemplateRef<HTMLElement>("root");
/** one block: all trains in one table (kept as a list for the template) */
const blocks = computed(() => {
  const per = props.perPage;
  if (!per) return [runs.value];
  // pages of even size (no last page with a lonely train or two)
  const n = runs.value.length;
  const size = Math.ceil(n / Math.ceil(n / per));
  const out: TableRun[][] = [];
  for (let i = 0; i < n; i += size) out.push(runs.value.slice(i, i + size));
  return out;
});
const anyFrom = computed(() => runs.value.some((r) => r.from));

// hover: one listener per table, the column from data-c
const inside = ref(false);
function onOver(e: MouseEvent, block: TableRun[]) {
  const c = (e.target as HTMLElement).closest<HTMLElement>("[data-c]")?.dataset.c;
  const t = c === undefined ? undefined : block[Number(c)]?.t;
  if (t !== props.hover) emit("hover", t);
}
watch(
  () => props.hover,
  (h) => {
    if (!props.follow || inside.value || !h) return;
    const k = runs.value.findIndex((r) => r.t === h);
    if (k < 0) return;
    root.value
      ?.querySelector(`[data-run="${k}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  },
);
</script>

<template>
  <div
    v-if="runs.length"
    ref="root"
    class="bf-table bf-book"
    :class="perPage ? 'printed' : 'card mt-2 p-1'"
  >
    <h2 v-if="!perPage" class="m-0 px-1 text-sm font-semibold">
      {{ stations[0]?.name }} – {{ stations.at(-1)?.name }}
    </h2>
    <div
      v-for="(block, b) in blocks"
      :key="b"
      :class="perPage ? 'print-page' : ['overflow-x-auto', b > 0 && 'mt-3']"
    >
      <h2 v-if="perPage" class="print-head">
        <span>{{ title }}</span>
        <span class="muted">
          {{ stations[0]?.name }} – {{ stations.at(-1)?.name
          }}<template v-if="b > 0"> ({{ $t("kursbuch.continued") }})</template>
        </span>
      </h2>
      <table
        class="text-xs"
        :class="live && 'live'"
        @mouseover="onOver($event, block)"
        @mouseenter="inside = true"
        @mouseleave="((inside = false), emit('hover', undefined))"
      >
        <thead>
          <tr class="trains">
            <th class="stn" />
            <th class="kind" />
            <th
              v-for="(r, c) in block"
              :key="c"
              :data-c="c"
              :data-run="runs.indexOf(r)"
              :class="hover === r.t && 'hovered'"
              :style="{ color: categoryColor(r.t.cat, r.t.nr) }"
            >
              <RouterLink
                :to="{ query: { ...$route.query, train: trainSlug(`${r.t.cat} ${r.t.nr}`) } }"
                class="train-link"
              >
                <span class="cat mono">{{ lineFor(r.t.cat, r.t.nr) ?? r.t.cat }}</span>
                <span class="mono block">{{ r.t.nr }}</span>
              </RouterLink>
            </th>
          </tr>
          <tr v-if="anyFrom" class="note">
            <th class="stn muted text-right font-normal">{{ $t("bf.tableFrom") }}</th>
            <th class="kind" />
            <td v-for="(r, c) in block" :key="c" :data-c="c" :class="hover === r.t && 'hovered'">
              {{ r.from }}
            </td>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, j) in rows"
            :key="j"
            :class="[row.band && 'band', row.major && 'major', row.kind === 'an' && 'an']"
          >
            <th
              class="stn"
              :class="
                rows[j - 1]?.name !== row.name && row.name && sheets?.[row.name] && 'has-sheets'
              "
            >
              <RouterLink v-if="stationLink(row.k)" :to="stationLink(row.k)!" class="stn-link">{{
                row.name
              }}</RouterLink>
              <template v-else>{{ row.name }}</template>
              <template v-if="rows[j - 1]?.name !== row.name"
                ><RouterLink
                  v-for="sh in (row.name && sheets?.[row.name]) || []"
                  :key="sh.id"
                  :to="{ path: `/bf/${sh.id}`, query: viewQuery }"
                  class="sheet mono"
                  v-tip="sh.name"
                  >{{ sh.id }}</RouterLink
                ></template
              >
            </th>
            <th class="kind muted">{{ row.kind }}</th>
            <td
              v-for="(r, c) in block"
              :key="c"
              :data-c="c"
              class="mono"
              :class="hover === r.t && 'hovered'"
              :style="{ color: categoryColor(r.t.cat, r.t.nr) }"
            >
              <span v-if="cell(r, row) === '|'" class="pass" />
              <template v-else-if="live && cell(r, row) && liveAt(r, row)"
                >{{ cell(r, row)
                }}<sup class="dl" :class="liveAt(r, row)!.cls">{{ liveAt(r, row)!.text }}</sup
                ><span v-if="liveAt(r, row)!.delay" class="rt" :class="liveAt(r, row)!.cls">{{
                  time(liveAt(r, row)!.rt)
                }}</span></template
              >
              <template v-else>{{ cell(r, row) }}</template>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="note">
            <th class="stn muted text-right font-normal">{{ $t("bf.tableTo") }}</th>
            <th class="kind" />
            <td v-for="(r, c) in block" :key="c" :data-c="c" :class="hover === r.t && 'hovered'">
              {{ r.to }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</template>

<style scoped>
/* realtime: delay superscript, expected time below (as in the stop lists) */
table.live td {
  width: 4.25rem;
  min-width: 4.25rem;
}
.dl {
  margin-left: 0.125rem;
  font-size: 0.5625rem;
}
.rt {
  display: block;
  font-size: 0.625rem;
  line-height: 0.75rem;
}
.ontime {
  color: var(--good);
}
.slight {
  color: var(--warn);
}
.late {
  color: var(--bad);
}
table {
  border-collapse: collapse;
  table-layout: fixed;
}
th,
td {
  padding: 0 0.25rem;
  white-space: nowrap;
  line-height: 1.15rem;
}
td {
  width: 3.25rem;
  min-width: 3.25rem;
  text-align: right;
  border-left: 1px solid var(--line);
}
th.stn {
  position: sticky;
  left: 0;
  z-index: 1;
  width: 12rem;
  min-width: 12rem;
  max-width: 12rem;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
  font-weight: 400;
  background: var(--bg2);
}
.stn-link {
  color: inherit;
}
.stn-link:hover {
  color: var(--link);
  text-decoration: underline;
}
/* links to sheets branching off here: small, after the name (wrapping rather than cut off) */
th.stn.has-sheets {
  white-space: normal;
  text-overflow: clip;
}
.sheet {
  margin-left: 0.25rem;
  font-size: 0.625rem;
  font-weight: 400;
  color: var(--muted);
}
.sheet:hover {
  color: var(--link);
}
tr.major th.stn {
  font-weight: 600;
}
th.kind {
  position: sticky;
  left: 12rem;
  z-index: 1;
  background: var(--bg2);
  width: 1.5rem;
  font-weight: 400;
  text-align: left;
}
tbody tr.band td,
tbody tr.band th {
  background: color-mix(in srgb, var(--muted) 12%, var(--bg2));
}
/* the major stations' arrival row: line above, like the book's separators */
tbody tr.an td,
tbody tr.an th {
  border-top: 1px solid var(--line);
}
thead tr.trains th {
  vertical-align: bottom;
  text-align: right;
  padding-bottom: 0.125rem;
  border-bottom: 1px solid var(--muted);
  line-height: 1rem;
}
/* category like the line badges: monospace, semibold, upright */
.cat {
  font-weight: 600;
}
.train-link {
  color: inherit;
}
.train-link:hover {
  text-decoration: underline;
}
tr.note td {
  font-size: 0.625rem;
  line-height: 0.8rem;
  white-space: normal;
  text-align: center;
  vertical-align: top;
  color: var(--muted);
  overflow-wrap: break-word;
  hyphens: auto;
}
tfoot tr.note td,
tfoot tr.note th {
  border-top: 1px solid var(--muted);
  padding-top: 0.125rem;
}
/* passing: a vertical line through the cell, as in the book */
.pass {
  display: block;
  width: 1px;
  height: 1.15rem;
  margin: 0 auto;
  background: currentColor;
  opacity: 0.6;
}
.hovered {
  background: color-mix(in srgb, var(--accent) 18%, transparent) !important;
}
</style>

<style>
/* Kursbuch print layout: one block of trains per page, no sticky columns */
.bf-book.printed th.stn,
.bf-book.printed th.kind {
  position: static;
}
/* short sheets share a page, a block never splits */
.bf-book.printed .print-page {
  break-inside: avoid;
  margin-bottom: 4mm;
}
.bf-book.printed .print-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin: 0 0 0.25rem;
  padding-bottom: 0.125rem;
  border-bottom: 1.5px solid var(--fg);
  font-size: 0.8125rem;
}
.bf-book.printed table {
  width: 100%;
}
</style>
