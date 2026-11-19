<script setup lang="ts">
import { useResizeObserver } from "@vueuse/core";
import { nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import CommandPalette from "./components/CommandPalette.vue";
import ModalDialog from "./components/ModalDialog.vue";
import DebugPanel from "./components/DebugPanel.vue";
import { locale, LOCALES, setLocale, type Locale, type MessageKey } from "./i18n/index.ts";
import { useKeys } from "./lib/keys.ts";
import { state } from "./lib/store.ts";
import { scheme, toggleScheme } from "./lib/theme.ts";
import { liveAvailable, liveMode } from "./lib/live.ts";
import { COUNTRIES, country } from "./lib/country.ts";

/** each language in its own name (the language menu) */
const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  it: "Italiano",
  sl: "Slovenščina",
  es: "Español",
};

const router = useRouter();
const route = useRoute();

// navigation layout: measure whether the inline list fits the header row
const headerRow = ref<HTMLElement>();
const navList = ref<HTMLElement>();
const navWide = ref(true);
let lastWidth = 0;
async function measureNav() {
  const row = headerRow.value;
  if (!row) return;
  const width = row.clientWidth;
  // while collapsed, only re-measure when the header grew (avoids layout thrash)
  if (!navWide.value && width <= lastWidth) return;
  lastWidth = width;
  navWide.value = true;
  await nextTick();
  navWide.value = row.scrollWidth <= row.clientWidth;
}
function closeMenu() {
  if (!navWide.value) navList.value?.hidePopover?.();
}
useResizeObserver(headerRow, () => void measureNav());
// translations change the width of the links
watch(
  () => locale.value,
  () => {
    lastWidth = 0;
    void measureNav();
  },
);
const commitHash = import.meta.env.VITE_COMMIT_HASH;
const commitDate = import.meta.env.VITE_COMMIT_DATE;
const palette = ref(false);
const help = ref(false);

useKeys({
  "mod+k": () => (palette.value = !palette.value),
  "/": () => {
    const el = document.querySelector<HTMLInputElement>(
      "[data-search] input, input[role=combobox]",
    );
    if (el) el.focus();
    else void router.push("/");
  },
  "?": () => (help.value = !help.value),
  d: () => (state.debug = !state.debug),
  t: () => void router.push("/trains"),
  r: () => void router.push("/radar"),
  g: () => void router.push("/"),
  b: () => void router.push("/stations"),
  e: () => toggleLive(),
  Escape: () => {
    help.value = false;
    palette.value = false;
  },
});

/**
 * navigation: the live entries (bold, ●), stations and trains (bold), then the timetable and
 * infrastructure groups, separated by thin lines — every page one click away (docs/sitemap.md, Plan B)
 */
interface NavItem {
  to: string;
  key: MessageKey;
  live?: boolean;
  /** only for these countries (the others: struck through in the navbar, still reachable) */
  countries?: string[];
}
const nav: { main?: boolean; items: NavItem[] }[] = [
  {
    main: true,
    items: [
      { to: "/", key: "nav.search", live: true },
      { to: "/radar", key: "nav.radar", live: true },
      { to: "/him", key: "nav.him", live: true },
    ],
  },
  {
    main: true,
    items: [
      { to: "/stations", key: "nav.stations" },
      { to: "/trains", key: "nav.trains" },
    ],
  },
  {
    items: [
      { to: "/bf", key: "nav.bildfahrplan" },
      { to: "/netz", key: "nav.netz", countries: ["at"] },
    ],
  },
  {
    items: [
      { to: "/vzg", key: "nav.lines" },
      { to: "/vzg/netz", key: "nav.netmap" },
    ],
  },
  { main: true, items: [{ to: "/help", key: "nav.help" }] },
];
/** the entry of the current page (/vzg/netz is the network map, not the line index) */
/** a feature not (yet) available for the selected country */
const missing = (n: NavItem) => !!n.countries && !n.countries.includes(country.value);

function isActive(to: string): boolean {
  const p = route.path;
  if (to === "/") return p === "/" || p.startsWith("/j/") || p.startsWith("/trip/") || p === "/s";
  if (to === "/stations") return p === "/stations" || p.startsWith("/station/");
  if (to === "/trains") return p.startsWith("/trains") || p.startsWith("/train/");
  if (to === "/vzg") return p.startsWith("/vzg") && !p.startsWith("/vzg/netz");
  return p === to || p.startsWith(`${to}/`);
}

// ?land=si in a link selects the country (remembered like a choice in the navbar)
watch(
  () => route.query.land,
  (l) => {
    if (typeof l === "string") country.value = l.toLowerCase();
  },
  { immediate: true },
);

/**
 * Live switch: on a station page it also switches between live board and departure plan; on the
 * Bildfahrplan the realtime overlay follows (?live)
 */
function toggleLive() {
  if (!liveAvailable.value) return;
  liveMode.value = !liveMode.value;
  const id = route.params.id;
  if (route.path.startsWith("/station/") && typeof id === "string") {
    const plan = route.path.endsWith("/plan");
    if (liveMode.value && plan) void router.replace(`/station/${id}`);
    if (!liveMode.value && !plan) void router.replace(`/station/${id}/plan`);
  } else if (route.path.startsWith("/bf")) {
    const { live: _, ...q } = route.query;
    void router.replace({ query: liveMode.value ? { ...q, live: "1" } : q });
  }
}

const shortcuts: [string, string][] = [
  ["/", "focus search"],
  ["Ctrl/⌘ K", "command palette"],
  ["j / k", "next / previous row"],
  ["Enter", "open row"],
  ["h / l", "earlier / later"],
  ["a", "departures ↔ arrivals"],
  ["← / →", "Bildfahrplan: previous / next day"],
  ["↑ / ↓", "Bildfahrplan: two hours earlier / later (Shift: a whole window)"],
  ["+ / −", "Bildfahrplan: time scale"],
  ["n", "Bildfahrplan: now"],
  ["d", "raw API JSON"],
  ["g / b / t / r", "home / stations / trains / radar"],
  ["e", "Live on / off"],
  ["?", "this help"],
];
</script>

<template>
  <a href="#main" class="skip-link">{{ $t("common.skip") }}</a>
  <header class="border-b border-[var(--line)] bg-[var(--bg2)]">
    <div ref="headerRow" class="mx-auto flex max-w-6xl items-center gap-x-4 px-3 py-2">
      <RouterLink
        to="/"
        class="mono text-lg font-bold text-[var(--fg)] no-underline"
        aria-label="zugx home"
      >
        <span class="text-[var(--accent)]">z</span>ugx
      </RouterLink>
      <!-- one navigation list: inline when it fits, a native popover behind "Menu" when not
           (modern-web-guidance: navbar) -->
      <nav :aria-label="$t('nav.main')" class="text-sm">
        <button
          v-if="!navWide"
          type="button"
          class="btn"
          popovertarget="site-menu"
          aria-controls="site-menu"
        >
          <span aria-hidden="true">☰</span> {{ $t("nav.menu") }}
        </button>
        <ul
          id="site-menu"
          ref="navList"
          :popover="navWide ? undefined : 'auto'"
          class="site-menu m-0 list-none p-0"
          :class="navWide ? 'flex gap-3' : 'card p-1 shadow-lg'"
        >
          <template v-for="(g, gi) in nav" :key="gi">
            <li
              v-for="(n, k) in g.items"
              :key="n.to"
              :class="[
                g.main ? 'nav-main' : 'nav-expert',
                gi > 0 && k === 0 && (navWide ? 'nav-sep' : 'nav-sep-y'),
              ]"
            >
              <RouterLink
                :to="n.to"
                class="block whitespace-nowrap text-[var(--muted)] hover:text-[var(--fg)]"
                :class="[
                  !navWide && 'px-3 py-2',
                  isActive(n.to) && '!text-[var(--fg)]',
                  missing(n) && 'line-through',
                ]"
                :aria-current="isActive(n.to) ? 'page' : undefined"
                v-tip="missing(n) ? $t('nav.notInCountry') : undefined"
                @click="closeMenu"
                >{{ $t(n.key)
                }}<span
                  v-if="n.live"
                  class="live-dot on-static ml-0.5"
                  v-tip="$t('nav.liveOnly')"
                  :aria-label="$t('nav.liveOnly')"
                  >●</span
                ></RouterLink
              >
            </li>
          </template>
        </ul>
      </nav>
      <div class="ml-auto flex items-center gap-2 text-xs">
        <button
          class="btn whitespace-nowrap"
          :class="liveMode && 'btn-on'"
          :aria-pressed="liveMode"
          :disabled="!liveAvailable"
          v-tip="liveAvailable ? `${$t('nav.liveTip')} (e)` : $t('nav.liveNone')"
          @click="toggleLive"
        >
          <span class="live-dot" :class="liveMode && 'on'" aria-hidden="true">●</span>
          {{ $t("nav.live") }}
        </button>
        <!-- country and language behind one compact button (keeps the nav inline on desktops) -->
        <button
          type="button"
          class="btn mono whitespace-nowrap"
          popovertarget="site-settings"
          aria-controls="site-settings"
          :aria-label="`${$t('nav.country')} / ${$t('common.language')}`"
        >
          {{ COUNTRIES.length > 1 ? `${country.toUpperCase()} · ` : "" }}{{ locale.toUpperCase() }}
          <span aria-hidden="true">▾</span>
        </button>
        <div id="site-settings" popover="auto" class="site-settings card p-3 text-sm shadow-lg">
          <label v-if="COUNTRIES.length > 1" class="flex flex-col gap-1">
            <span class="muted text-xs">{{ $t("nav.country") }}</span>
            <select v-model="country" class="input" :aria-label="$t('nav.country')">
              <option v-for="c in COUNTRIES" :key="c.id" :value="c.id">
                {{ c.id.toUpperCase() }} · {{ c.name[locale] }}
              </option>
            </select>
            <span class="muted max-w-56 text-xs">{{ $t("nav.countryTip") }}</span>
          </label>
          <label class="mt-3 flex flex-col gap-1">
            <span class="muted text-xs">{{ $t("common.language") }}</span>
            <select
              class="input"
              :aria-label="$t('common.language')"
              :value="locale"
              @change="setLocale(($event.target as HTMLSelectElement).value as Locale)"
            >
              <option v-for="l in LOCALES" :key="l" :value="l">{{ LOCALE_NAMES[l] }}</option>
            </select>
          </label>
        </div>
        <button
          class="btn"
          v-tip="$t('common.theme')"
          :aria-label="$t('common.theme')"
          @click="toggleScheme"
        >
          {{ scheme === "dark" ? "☾" : "☀" }}
        </button>
      </div>
    </div>
  </header>
  <main
    id="main"
    tabindex="-1"
    class="mx-auto px-3 py-3 outline-none"
    :class="route.meta.wide ? 'max-w-none' : 'max-w-6xl'"
  >
    <RouterView />
  </main>
  <DebugPanel v-if="state.debug" />
  <footer class="muted mx-auto max-w-6xl px-3 py-6 text-xs">
    {{ $t("common.source.data") }}: <a href="https://fahrplan.oebb.at/">ÖBB HAFAS</a> ({{
      $t("common.source.unofficial")
    }}),
    <template v-for="c in COUNTRIES" :key="c.id"
      ><a :href="c.licence.page">{{ c.licence.source }}</a> (<a :href="c.licence.url">{{
        c.licence.name
      }}</a
      >),
    </template>
    <a href="https://www.openstreetmap.org/copyright">© {{ $t("common.source.osm") }}</a>
    (<a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a>) ·
    <a href="https://github.com/simon04/zugx">zugx</a>
    (Simon Legner,
    <a href="https://github.com/simon04/zugx/blob/master/LICENSE" rel="license">AGPL-3.0</a>,
    <a href="/licenses.txt" target="_blank">{{ $t("common.ossLicenses") }}</a>) ·
    <RouterLink to="/imprint">{{ $t("common.imprint") }}</RouterLink> ·
    <RouterLink to="/privacy">{{ $t("common.privacy") }}</RouterLink>
    <template v-if="commitHash">
      ·
      <a
        :href="`https://github.com/simon04/zugx/commit/${commitHash}`"
        class="mono whitespace-nowrap"
        >{{ commitHash }} ({{ commitDate }})</a
      >
    </template>
    ·
    <button class="link-btn" @click="palette = true">
      {{ $t("common.commandPalette") }} <span class="kbd keys-only">⌘K</span>
    </button>
    ·
    <button class="link-btn" :aria-pressed="state.debug" @click="state.debug = !state.debug">
      {{ $t("debug.show") }} <span class="kbd keys-only">d</span>
    </button>
    <span class="keys-only"> · </span>
    <button class="link-btn keys-only" @click="help = true">
      {{ $t("common.keyboard") }} <span class="kbd">?</span>
    </button>
  </footer>
  <CommandPalette v-model="palette" />
  <ModalDialog v-model="help" :label="$t('common.keyboard')">
    <div class="p-2">
      <h2 class="mt-0 text-base">{{ $t("common.keyboard") }}</h2>
      <table class="dense">
        <tbody>
          <tr v-for="[k, d] in shortcuts" :key="k">
            <td><span class="kbd">{{ k }}</span></td>
            <td>{{ d }}</td>
          </tr>
        </tbody>
      </table>
      <button class="btn mt-3" autofocus @click="help = false">{{ $t("common.close") }}</button>
    </div>
  </ModalDialog>
</template>
