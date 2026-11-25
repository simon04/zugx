<script setup lang="ts">
// MapLibre map with OSM + OpenRailwayMap raster tiles; draws lines (legs) and points (stops/trains).
import { badgeEl } from "../lib/tip.ts";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre 6 runs a module worker; its URL must be set explicitly, otherwise the production
// build has no worker and GeoJSON layers (lines, markers) are never drawn
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import {
  LngLatBounds,
  Map as MlMap,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type StyleSpecification,
} from "maplibre-gl";
import type { Feature, FeatureCollection } from "geojson";
import { useResizeObserver } from "@vueuse/core";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { scheme } from "../lib/theme.ts";

export interface MapLine {
  coords: [lat: number, lon: number][];
  color: string;
  dashed?: boolean;
}
export interface MapPoint {
  lat: number;
  lon: number;
  label?: string;
  /** line badge before the label in the tooltip (like the LineBadge component) */
  badge?: { text: string; color: string };
  color?: string;
  /** outline colour (default black) */
  stroke?: string;
  id?: string;
  big?: boolean;
  /** direction of travel (compass degrees): drawn as a small arrow at the edge of the dot */
  bearing?: number;
}

setWorkerUrl(workerUrl);

const props = withDefaults(
  defineProps<{
    lines?: MapLine[];
    points?: MapPoint[];
    fit?: boolean;
    height?: string;
    railway?: boolean;
    /** "vector": calm OpenFreeMap style; "osm": OSM Carto raster (platforms, entrances, buildings in detail) */
    base?: "vector" | "osm";
    /** initial view (lat, lon) and zoom, instead of Austria */
    center?: [number, number];
    zoom?: number;
  }>(),
  {
    lines: () => [],
    points: () => [],
    fit: true,
    height: "420px",
    railway: true,
    base: "vector",
    center: () => [47.6, 14.5], // Austria
    zoom: 6.3,
  },
);
const emit = defineEmits<{ ready: [MlMap]; moveend: [MlMap]; clickPoint: [string] }>();
const el = ref<HTMLDivElement>();
let map: MlMap | undefined;

const fc = (features: Feature[]): FeatureCollection => ({ type: "FeatureCollection", features });

function lineData() {
  return fc(
    props.lines.map((l) => ({
      type: "Feature",
      properties: { color: l.color, dashed: l.dashed ? 1 : 0 },
      geometry: { type: "LineString", coordinates: l.coords.map(([la, lo]) => [lo, la]) },
    })),
  );
}
function pointData() {
  return fc(
    props.points.map((p) => ({
      type: "Feature",
      properties: {
        label: p.label ?? "",
        ...(p.badge ? { badgeText: p.badge.text, badgeColor: p.badge.color } : {}),
        color: p.color ?? "#e6e8eb",
        stroke: p.stroke ?? "#000",
        id: p.id ?? "",
        big: p.big ? 1 : 0,
        ...(p.bearing !== undefined ? { bearing: p.bearing } : {}),
      },
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
    })),
  );
}

function fitAll() {
  if (!map || !props.fit) return;
  const b = new LngLatBounds();
  for (const l of props.lines) for (const [la, lo] of l.coords) b.extend([lo, la]);
  for (const p of props.points) b.extend([p.lon, p.lat]);
  if (!b.isEmpty()) map.fitBounds(b, { padding: 40, maxZoom: 13, duration: 0 });
}

// ---- base map: OpenFreeMap vector styles (calm, railways included), optional OpenRailwayMap overlay ----
// the OpenRailwayMap overlay is always on (zugx's users want the rail network on every map)
const orm = ref(true);
const styleUrl = (): string | StyleSpecification =>
  props.base === "osm"
    ? {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            maxzoom: 19,
            attribution:
              "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
            // slightly dimmed in the dark theme
            paint:
              scheme.value === "dark"
                ? { "raster-brightness-max": 0.8, "raster-saturation": -0.3 }
                : {},
          },
        ],
      }
    : `https://tiles.openfreemap.org/styles/${scheme.value === "dark" ? "dark" : "positron"}`;

/** small triangle pointing up (north), black with a white outline: visible on light and dark maps */
function arrowImage() {
  const px = 2; // device pixels per CSS pixel
  const c = document.createElement("canvas");
  c.width = c.height = 12 * px;
  const g = c.getContext("2d")!;
  g.scale(px, px);
  g.beginPath();
  g.moveTo(6, 1.5);
  g.lineTo(10.5, 10.5);
  g.lineTo(1.5, 10.5);
  g.closePath();
  g.lineJoin = "round";
  g.lineWidth = 1.5;
  g.strokeStyle = "#fff";
  g.stroke();
  g.fillStyle = "#111";
  g.fill();
  const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
  return { image: { width, height, data: new Uint8Array(data.buffer) }, pixelRatio: px };
}

function addOverlays(m: MlMap) {
  if (!m.hasImage("zugx-arrow")) {
    const { image, pixelRatio } = arrowImage();
    m.addImage("zugx-arrow", image, { pixelRatio });
  }
  if (!m.getSource("lines")) {
    m.addSource("lines", { type: "geojson", data: lineData() });
    m.addSource("points", { type: "geojson", data: pointData() });
    m.addLayer({
      id: "lines-casing",
      type: "line",
      source: "lines",
      paint: { "line-color": "#000", "line-width": 6, "line-opacity": 0.35 },
      layout: { "line-cap": "round", "line-join": "round" },
    });
    m.addLayer({
      id: "lines",
      type: "line",
      source: "lines",
      paint: { "line-color": ["get", "color"], "line-width": 4 },
      layout: { "line-cap": "round", "line-join": "round" },
    });
    // direction of travel (vonatinfo style): an arrow just outside the dot, rotating with the map
    m.addLayer({
      id: "point-arrows",
      type: "symbol",
      source: "points",
      filter: ["has", "bearing"],
      layout: {
        "icon-image": "zugx-arrow",
        "icon-rotate": ["get", "bearing"],
        "icon-rotation-alignment": "map",
        "icon-offset": [0, -7],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
    m.addLayer({
      id: "points",
      type: "circle",
      source: "points",
      paint: {
        "circle-radius": ["case", ["==", ["get", "big"], 1], 6, 4],
        "circle-color": ["get", "color"],
        "circle-stroke-color": ["get", "stroke"],
        "circle-stroke-width": ["case", ["==", ["get", "stroke"], "#000"], 1, 2],
      },
    });
  }
  // make the base map's railway lines a bit more prominent (still calm grey)
  for (const l of m.getStyle().layers ?? []) {
    if (l.type === "line" && l.id.startsWith("railway")) {
      m.setPaintProperty(l.id, "line-color", scheme.value === "dark" ? "#7d8590" : "#7a7f87");
    }
  }
  setOrm(m);
}

/** OpenRailwayMap raster overlay, desaturated so it doesn't dominate */
function setOrm(m: MlMap) {
  if (!props.railway) return;
  if (orm.value && !m.getSource("orm")) {
    m.addSource("orm", {
      type: "raster",
      tiles: ["https://a.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "<a href='https://www.openrailwaymap.org/'>OpenRailwayMap</a> (CC BY-SA)",
      maxzoom: 19,
    });
    m.addLayer(
      {
        id: "orm",
        type: "raster",
        source: "orm",
        paint: { "raster-saturation": -0.7, "raster-opacity": 0.55 },
      },
      "lines-casing",
    );
  } else if (!orm.value && m.getSource("orm")) {
    m.removeLayer("orm");
    m.removeSource("orm");
  }
}

watch(orm, () => {
  if (map) setOrm(map);
});
watch(
  () => scheme.value,
  () => map?.setStyle(styleUrl()),
);

onMounted(() => {
  if (!el.value) return;
  const m = new MlMap({
    container: el.value,
    style: styleUrl(),
    center: [props.center[1], props.center[0]],
    zoom: props.zoom,
    maxZoom: 19,
    attributionControl: { compact: true },
  });
  map = m;
  m.addControl(new NavigationControl({ showCompass: false }), "top-right");
  // (re-)add our layers whenever a base style is (re)loaded, e.g. after a theme switch
  m.on("style.load", () => addOverlays(m));
  m.on("load", () => {
    const map = m;
    addOverlays(map);
    // attribution collapsed on all devices (MapLibre opens the compact one the first time; it is
    // not re-opened afterwards) — the ⓘ button shows it
    el.value?.querySelectorAll(".maplibregl-ctrl-attrib.maplibregl-compact-show").forEach((a) => {
      a.classList.remove("maplibregl-compact-show");
      a.removeAttribute("open");
    });
    // tooltip: hover on desktop; on touch the first tap shows it, a second tap on the same marker
    // opens it. Several markers under the finger/cursor (trains at one platform): a list to choose.
    const tip = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
      className: "zugx-tip",
    });
    let tipId: string | undefined;
    let choosing = false;
    const keyOf = (f: MapGeoJSONFeature) => String(f.properties?.id || f.properties?.label || "");
    const content = (f: MapGeoJSONFeature) => {
      const pr = f.properties ?? {};
      const el = document.createElement("span");
      if (pr.badgeText) el.append(badgeEl(String(pr.badgeText), String(pr.badgeColor)), " ");
      el.append(String(pr.label ?? ""));
      return el;
    };
    const showTip = (f: MapGeoJSONFeature | undefined) => {
      if (!f || f.geometry.type !== "Point" || !f.properties?.label) return;
      choosing = false;
      tip.setLngLat(f.geometry.coordinates as [number, number]);
      tip.setDOMContent(content(f));
      tip.addTo(map);
      tipId = keyOf(f);
    };
    /** several markers at one spot: one button per train */
    const showChooser = (fs: MapGeoJSONFeature[]) => {
      const f = fs[0]!;
      if (f.geometry.type !== "Point") return;
      const list = document.createElement("div");
      list.className = "zugx-choose-list";
      list.setAttribute("role", "menu");
      for (const g of fs) {
        const id = g.properties?.id ? String(g.properties.id) : undefined;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("role", "menuitem");
        btn.append(content(g));
        btn.disabled = !id;
        btn.addEventListener("click", () => {
          hideTip();
          if (id) emit("clickPoint", id);
        });
        list.append(btn);
      }
      tip.setLngLat(f.geometry.coordinates as [number, number]);
      tip.setDOMContent(list);
      tip.addTo(map);
      choosing = true;
      tipId = undefined;
    };
    const hideTip = () => {
      tip.remove();
      tipId = undefined;
      choosing = false;
    };
    /** the markers within a few pixels (a finger needs more), one per train, nearest first */
    const near = (pt: { x: number; y: number }, r: number) => {
      const seen = new Set<string>();
      const d = (f: MapGeoJSONFeature) => {
        if (f.geometry.type !== "Point") return 0;
        const q = map.project(f.geometry.coordinates as [number, number]);
        return (q.x - pt.x) ** 2 + (q.y - pt.y) ** 2;
      };
      return map
        .queryRenderedFeatures(
          [
            [pt.x - r, pt.y - r],
            [pt.x + r, pt.y + r],
          ],
          { layers: ["points"] },
        )
        .filter((f) => {
          const k = keyOf(f);
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .sort((a, b) => d(a) - d(b));
    };
    map.on("mousemove", (e) => {
      if (choosing) return;
      const fs = near(e.point, 3);
      map.getCanvas().style.cursor = fs.length ? "pointer" : "";
      if (fs.length) showTip(fs[0]);
      else if (tipId) hideTip();
    });
    map.on("click", (e) => {
      const touch = (e.originalEvent as PointerEvent).pointerType === "touch";
      const fs = near(e.point, touch ? 14 : 4);
      if (!fs.length) return hideTip();
      // a list only where markers open something (trains); else the nearest one's tooltip
      const openable = fs.filter((f) => f.properties?.id);
      if (openable.length > 1) return showChooser(openable);
      const f = fs[0]!;
      if (touch && tipId !== keyOf(f)) return showTip(f);
      const id = f.properties?.id ? String(f.properties.id) : undefined;
      if (id) {
        hideTip();
        emit("clickPoint", id);
      }
    });
    // markers move under a static cursor when data refreshes (radar)
    // (an open list stays: its trains are still valid)
    map.on("data", (e) => {
      if ((e as { sourceId?: string }).sourceId === "points" && tipId && !choosing) hideTip();
    });
    fitAll();
    emit("ready", map);
  });
  m.on("moveend", () => emit("moveend", m));
});

watch(
  () => [props.lines, props.points],
  () => {
    (map?.getSource("lines") as GeoJSONSource | undefined)?.setData(lineData());
    (map?.getSource("points") as GeoJSONSource | undefined)?.setData(pointData());
  },
);
watch(() => props.lines, fitAll);

useResizeObserver(el, () => map?.resize());
onBeforeUnmount(() => map?.remove());
</script>

<template>
  <div class="relative">
    <div
      ref="el"
      class="w-full overflow-hidden rounded-md border border-[var(--line)]"
      :style="{ height }"
    />
  </div>
</template>
