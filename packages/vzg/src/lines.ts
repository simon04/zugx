/**
 * From the OSM extract to VzG lines: chain the ways of one track into an ordered path, fit
 * kilometres (chainage) to OSM `railway:position` values, derive speed sections per direction,
 * curve radii and operating points.
 */
import { encodePolyline, simplify } from "./geo.ts";
import { lineId } from "./types.ts";
import type { NetPiece, RailExtract, VzgLine, VzgPoint, VzgStructure, VzgTrack } from "./types.ts";

type Way = RailExtract["ways"][number];
type Coord = [number, number];

const R = 6371.0088;
export function distKm(a: Coord, b: Coord): number {
  const toRad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * toRad;
  const dLon = (b[1] - a[1]) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * toRad) * Math.cos(b[0] * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "35.129", "35,129", "35.1+20" (ÖBB: km + m) → km; null if not parseable */
export function parsePosition(v: string | undefined): number | null {
  if (!v) return null;
  const s = v.split(";")[0]!.trim().replace(",", ".");
  const plus = /^(-?\d+(?:\.\d+)?)\+(\d+)$/.exec(s);
  if (plus) return Number(plus[1]) + Number(plus[2]) / 1000;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "100", "100 km/h" → 100; "60 mph" → 97; else null */
export function parseSpeed(v: string | undefined): number | null {
  if (!v) return null;
  const m = /^(\d+(?:\.\d+)?)\s*(mph|km\/h)?$/.exec(v.split(";")[0]!.trim());
  if (!m) return null;
  return Math.round(Number(m[1]) * (m[2] === "mph" ? 1.609344 : 1));
}

/**
 * Kilometres along a path from (distance along path s, OSM km) anchors: orientation from the
 * anchors, outliers removed (longest monotonic subsequence), linear in between, slope 1 beyond.
 */
export function fitChainage(anchors: { s: number; km: number }[]): ((s: number) => number) | null {
  if (anchors.length < 2) return null;
  const sorted = [...anchors].sort((a, b) => a.s - b.s);
  const inc = lms(sorted, 1);
  const dec = lms(sorted, -1);
  const best = inc.length >= dec.length ? inc : dec;
  if (best.length < 2) return null;
  const dir = best === inc ? 1 : -1;
  return (s: number) => {
    if (s <= best[0]!.s) return best[0]!.km + dir * (s - best[0]!.s);
    if (s >= best.at(-1)!.s) return best.at(-1)!.km + dir * (s - best.at(-1)!.s);
    let i = 1;
    while (best[i]!.s < s) i++;
    const a = best[i - 1]!;
    const b = best[i]!;
    return a.km + ((s - a.s) / (b.s - a.s || 1)) * (b.km - a.km);
  };
}

/**
 * longest subsequence with km strictly monotonic in `dir` and plausible steps (km difference at
 * most 1.5 × path distance + 0.5 km; O(n²), n is small)
 */
function lms<T extends { s: number; km: number }>(xs: T[], dir: 1 | -1): T[] {
  const len = xs.map(() => 1);
  const prev = xs.map(() => -1);
  for (let i = 0; i < xs.length; i++)
    for (let j = 0; j < i; j++)
      if (
        dir * (xs[i]!.km - xs[j]!.km) > 0 &&
        Math.abs(xs[i]!.km - xs[j]!.km) <= 1.5 * (xs[i]!.s - xs[j]!.s) + 0.5 &&
        len[j]! + 1 > len[i]!
      ) {
        len[i] = len[j]! + 1;
        prev[i] = j;
      }
  let k = len.indexOf(Math.max(...len));
  const out: T[] = [];
  for (; k >= 0; k = prev[k]!) out.unshift(xs[k]!);
  return out;
}

const round = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

/**
 * Curve sections along a polyline: [sFrom, sTo, radius m] for radius < `max`. Resampled every
 * `step` km; curvature from the heading change over ±`half` km; radius = median of the section,
 * rounded to 10 m.
 */
export function curveSections(
  pts: Coord[],
  s: number[],
  { step = 0.025, half = 0.1, max = 3000 } = {},
): [number, number, number][] {
  const len = s.at(-1)!;
  // resample
  const rs: Coord[] = [];
  for (let x = 0, i = 0; x <= len; x += step) {
    while (i + 1 < s.length - 1 && s[i + 1]! < x) i++;
    const f = (x - s[i]!) / (s[i + 1]! - s[i]! || 1);
    rs.push([
      pts[i]![0] + f * (pts[i + 1]![0] - pts[i]![0]),
      pts[i]![1] + f * (pts[i + 1]![1] - pts[i]![1]),
    ]);
  }
  const k = Math.round(half / step);
  const heading = (a: Coord, b: Coord) =>
    Math.atan2(b[0] - a[0], (b[1] - a[1]) * Math.cos((a[0] * Math.PI) / 180));
  const radii: number[] = rs.map(() => Infinity);
  for (let i = k; i + k < rs.length; i++) {
    let d = heading(rs[i]!, rs[i + k]!) - heading(rs[i - k]!, rs[i]!);
    d = Math.atan2(Math.sin(d), Math.cos(d));
    radii[i] = Math.abs(d) < 1e-9 ? Infinity : (half * 1000) / Math.abs(d);
  }
  const out: [number, number, number][] = [];
  let start = -1;
  for (let i = 0; i <= radii.length; i++) {
    const curved = i < radii.length && radii[i]! < max;
    if (curved && start < 0) start = i;
    if (!curved && start >= 0) {
      const sec = radii.slice(start, i).sort((a, b) => a - b);
      if (i - start >= 3)
        out.push([start * step, (i - 1) * step, Math.round(sec[sec.length >> 1]! / 10) * 10]);
      start = -1;
    }
  }
  return out;
}

/** one step along a track: from node `a` to node `b` on `way` */
export interface Edge {
  a: number;
  b: number;
  way: Way;
  /** traversed in the way's own direction */
  forward: boolean;
  len: number;
}

/**
 * Line track graph: every consecutive node pair of the line's ways. Directed both ways; the
 * weight function decides which ways a path prefers.
 */
export function trackGraph(ways: Way[], coords: RailExtract["coords"]) {
  const adj = new Map<number, Edge[]>();
  const add = (e: Edge) => {
    const l = adj.get(e.a) ?? [];
    l.push(e);
    adj.set(e.a, l);
  };
  for (const w of ways)
    for (let i = 1; i < w.nodes.length; i++) {
      const a = w.nodes[i - 1]!;
      const b = w.nodes[i]!;
      if (!coords[a] || !coords[b]) continue;
      const len = distKm(coords[a]!, coords[b]!);
      add({ a, b, way: w, forward: true, len });
      add({ a: b, b: a, way: w, forward: false, len });
    }
  return adj;
}

/** cheapest path from `from` to `to` (Dijkstra; binary heap) */
export function shortestPath(
  adj: Map<number, Edge[]>,
  from: number,
  to: number,
  weight: (e: Edge) => number,
): Edge[] | null {
  const dist = new Map<number, number>([[from, 0]]);
  const prev = new Map<number, Edge>();
  const heap: [number, number][] = [[0, from]];
  const push = (x: [number, number]) => {
    heap.push(x);
    for (let i = heap.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (heap[p]![0] <= heap[i]![0]) break;
      [heap[p], heap[i]] = [heap[i]!, heap[p]!];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
        if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i]!, heap[m]!];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, n] = pop();
    if (n === to) break;
    if (d > (dist.get(n) ?? Infinity)) continue;
    for (const e of adj.get(n) ?? []) {
      const nd = d + weight(e);
      if (nd < (dist.get(e.b) ?? Infinity)) {
        dist.set(e.b, nd);
        prev.set(e.b, e);
        push([nd, e.b]);
      }
    }
  }
  if (!prev.has(to)) return null;
  const out: Edge[] = [];
  for (let n = to; n !== from;) {
    const e = prev.get(n)!;
    out.unshift(e);
    n = e.a;
  }
  return out;
}

/** Build one track from a continuous path of edges. */
/** OSM `ele` ("582", "582 m", "582.5") → metres */
const parseEle = (v?: string) => {
  const n = v ? Number.parseFloat(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? Math.round(n) : undefined;
};

const isTunnel = (w: Way) => !!w.tags.tunnel && w.tags.tunnel !== "no";

export function buildTrack(
  track: string,
  path: Edge[],
  ex: Pick<RailExtract, "coords" | "stations">,
  nodeTags: Map<number, Record<string, string>>,
): VzgTrack | null {
  if (!path.length) return null;
  const ids = [path[0]!.a, ...path.map((e) => e.b)];
  const pts = ids.map((n) => ex.coords[n]!);
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1]! + path[i - 1]!.len);
  const length = s.at(-1)!;
  if (length < 0.2) return null;

  // chainage from railway:position on the path's nodes
  const anchors: { s: number; km: number }[] = [];
  ids.forEach((n, i) => {
    const t = nodeTags.get(n);
    const km = parsePosition(t?.["railway:position:exact"] ?? t?.["railway:position"]);
    if (km !== null) anchors.push({ s: s[i]!, km });
  });
  const kmOf = fitChainage(anchors) ?? ((x: number) => x);
  const kmAt = ids.map((_, i) => kmOf(s[i]!));
  const increasing = kmAt.at(-1)! >= kmAt[0]!;

  // speed sections per edge, relative to increasing km
  const speeds: VzgTrack["speeds"] = [];
  path.forEach((e, i) => {
    const t = e.way.tags;
    const v = parseSpeed(t.maxspeed);
    const vf = parseSpeed(t["maxspeed:forward"]) ?? v; // in the way's direction
    const vb = parseSpeed(t["maxspeed:backward"]) ?? v;
    const alongKm = e.forward === increasing;
    const up = alongKm ? vf : vb; // towards increasing km
    const down = alongKm ? vb : vf;
    const [from, to] =
      kmAt[i]! <= kmAt[i + 1]! ? [kmAt[i]!, kmAt[i + 1]!] : [kmAt[i + 1]!, kmAt[i]!];
    const last = speeds.at(-1);
    const touches = last && (increasing ? Math.abs(last[1] - from) : Math.abs(last[0] - to)) < 0.05;
    if (last && touches && last[2] === up && last[3] === down) {
      if (increasing) last[1] = to;
      else last[0] = from;
    } else speeds.push([from, to, up, down]);
  });
  speeds.sort((x, y) => x[0] - y[0]);
  for (const sp of speeds) [sp[0], sp[1]] = [round(sp[0]), round(sp[1])];

  // curves: resample every 25 m, curvature = change of heading over ±HALF km (robust against
  // noisy OSM nodes), sections with radius < 3000 m, median radius per section
  const curves = curveSections(pts, s).map(
    ([a, b, r]) => [kmOf(a), kmOf(b), r] as [number, number, number],
  );
  for (const c of curves) {
    if (c[0] > c[1]) [c[0], c[1]] = [c[1], c[0]];
    [c[0], c[1]] = [round(c[0]), round(c[1])];
  }
  curves.sort((x, y) => x[0] - y[0]);

  // operating points on the path
  const points: VzgPoint[] = [];
  ids.forEach((n, i) => {
    const t = nodeTags.get(n);
    if (!t) return;
    const kind = t.railway ?? "";
    const pos = parsePosition(t["railway:position:exact"] ?? t["railway:position"]);
    const km = round(pos ?? kmAt[i]!);
    if (kind === "station" || kind === "halt" || kind === "stop" || kind === "tram_stop") {
      if (!t.name) return;
      // tram stops lie on the track (light rail such as the Innsbrucker Mittelgebirgsbahn): halts
      const k = kind === "tram_stop" ? "halt" : kind;
      if (k === "halt" && points.some((p) => p.kind === "halt" && p.label === t.name)) return;
      const c = ex.coords[n];
      const ele = parseEle(t.ele);
      points.push({
        km,
        kind: k,
        label: t.name,
        ...(t.uic_ref ? { uic: t.uic_ref } : {}),
        ...(ele !== undefined ? { ele } : {}),
        ...(c ? { pos: [round(c[0], 5), round(c[1], 5)] as [number, number] } : {}),
        ...(pos !== null ? { measured: true } : {}),
      });
    } else if (kind === "signal") {
      const types = Object.keys(t)
        .filter(
          (k) =>
            /^railway:signal:[a-z_]+$/.test(k) &&
            !["direction", "position"].some((x) => k.endsWith(x)),
        )
        .map((k) => k.slice("railway:signal:".length));
      if (!types.length) return;
      // facing direction: forward/backward relative to the way; the path runs along the way
      // (e.forward) towards increasing km (increasing) or not
      const e = path[i] ?? path[i - 1];
      const sd = t["railway:signal:direction"];
      const dir =
        e && (sd === "forward" || sd === "backward")
          ? ((sd === "forward") === e.forward) === increasing
            ? 1
            : -1
          : undefined;
      points.push({
        km,
        kind,
        ...(t.ref ? { label: t.ref } : {}),
        signal: types.join(","),
        ...(dir ? { dir } : {}),
        ...(pos !== null ? { measured: true } : {}),
      });
    }
  });
  // stations and halts beside the track: nearest point of the path within 250 m
  const box = pts.reduce<[number, number, number, number]>(
    (b, p) => [
      Math.min(b[0], p[0]),
      Math.max(b[1], p[0]),
      Math.min(b[2], p[1]),
      Math.max(b[3], p[1]),
    ],
    [90, -90, 180, -180],
  );
  const named = new Set(points.filter((p) => p.kind !== "signal").map((p) => p.label));
  for (const st of ex.stations ?? []) {
    if (
      st.lat < box[0] - 0.003 ||
      st.lat > box[1] + 0.003 ||
      st.lon < box[2] - 0.004 ||
      st.lon > box[3] + 0.004
    )
      continue;
    const name = st.tags.name!;
    if (named.has(name)) {
      // the same place already on the path as a stop position / halt: it is a station when the
      // station node says so; take its number, elevation and position
      const p = points.find((q) => q.label === name && q.kind !== "signal");
      if (p && st.tags.railway === "station" && p.kind !== "station") p.kind = "station";
      if (p && !p.uic && st.tags.uic_ref) p.uic = st.tags.uic_ref;
      const ele = parseEle(st.tags.ele);
      if (p && p.ele === undefined && ele !== undefined) p.ele = ele;
      if (p) p.pos = [round(st.lat, 5), round(st.lon, 5)];
      continue;
    }
    // distance to the path's segments (not only its nodes: a station beside a long straight
    // way can be far from the nearest node), km interpolated at the foot point
    let best = Infinity;
    let kmFoot = 0;
    const kx = 111.32 * Math.cos((st.lat * Math.PI) / 180);
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a, b] = [pts[i]!, pts[i + 1]!];
      const ax = (a[1] - st.lon) * kx;
      const ay = (a[0] - st.lat) * 111.32;
      const dx = (b[1] - a[1]) * kx;
      const dy = (b[0] - a[0]) * 111.32;
      const f = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1e-12)));
      const d = Math.hypot(ax + f * dx, ay + f * dy);
      if (d < best) {
        best = d;
        kmFoot = kmAt[i]! + f * (kmAt[i + 1]! - kmAt[i]!);
      }
    }
    if (best > 0.25) continue;
    const pos = parsePosition(st.tags["railway:position:exact"] ?? st.tags["railway:position"]);
    points.push({
      km: round(pos ?? kmFoot),
      kind: st.tags.railway!,
      label: name,
      ...(st.tags.uic_ref ? { uic: st.tags.uic_ref } : {}),
      ...(parseEle(st.tags.ele) !== undefined ? { ele: parseEle(st.tags.ele)! } : {}),
      pos: [round(st.lat, 5), round(st.lon, 5)],
      ...(pos !== null ? { measured: true } : {}),
    });
    named.add(name);
  }
  points.sort((a, b) => a.km - b.km);

  const kmFrom = round(Math.min(kmAt[0]!, kmAt.at(-1)!));
  const kmTo = round(Math.max(kmAt[0]!, kmAt.at(-1)!));
  // bridges and tunnels: runs of consecutive bridge/tunnel edges (same structure name)
  const structures: VzgStructure[] = [];
  {
    let cur: { kind: "bridge" | "tunnel"; name?: string; i0: number; len: number } | undefined;
    const close = (i1: number) => {
      if (!cur) return;
      const [a, b] = [kmAt[cur.i0]!, kmAt[i1]!];
      const m = Math.round(cur.len * 1000);
      if (m >= (cur.kind === "bridge" ? 10 : 50))
        structures.push({
          kind: cur.kind,
          kmFrom: round(Math.min(a, b)),
          kmTo: round(Math.max(a, b)),
          length: m,
          ...(cur.name ? { name: cur.name } : {}),
        });
      cur = undefined;
    };
    path.forEach((e, i) => {
      const t = e.way.tags;
      const kind = isTunnel(e.way)
        ? "tunnel"
        : t.bridge && t.bridge !== "no"
          ? "bridge"
          : undefined;
      const name =
        (kind === "tunnel" ? t["tunnel:name"] : kind === "bridge" ? t["bridge:name"] : undefined) ??
        (t.name && /brücke|viadukt|tunnel|galerie|bridge/i.test(t.name) ? t.name : undefined);
      if (cur && (cur.kind !== kind || cur.name !== name)) close(i);
      if (!kind) return;
      cur ??= { kind, ...(name ? { name } : {}), i0: i, len: 0 };
      cur.len += e.len;
    });
    close(path.length);
    structures.sort((x, y) => x.kmFrom - y.kmFrom);
  }

  // map geometry: path pieces by tunnel and permitted speed (the higher of both directions),
  // simplified; km posts at whole km
  const edgeV = (e: Edge) => {
    const t = e.way.tags;
    const vs = [t.maxspeed, t["maxspeed:forward"], t["maxspeed:backward"]]
      .map(parseSpeed)
      .filter((v): v is number => v !== null);
    return vs.length ? Math.max(...vs) : undefined;
  };
  const segments: { line: string; tunnel?: boolean; v?: number }[] = [];
  const flush = (pieces: [number, number][], tunnel: boolean, v: number | undefined) =>
    segments.push({
      line: encodePolyline(simplify(pieces, 10)),
      ...(tunnel ? { tunnel: true } : {}),
      ...(v !== undefined ? { v } : {}),
    });
  let run: [number, number][] = [pts[0]!];
  let inTunnel = isTunnel(path[0]!.way);
  let curV = edgeV(path[0]!);
  path.forEach((e, i) => {
    const t = isTunnel(e.way);
    const v = edgeV(e);
    if (t !== inTunnel || v !== curV) {
      flush(run, inTunnel, curV);
      run = [pts[i]!];
      inTunnel = t;
      curV = v;
    }
    run.push(pts[i + 1]!);
  });
  flush(run, inTunnel, curV);
  const posts: [number, number, number][] = [];
  for (let i = 1; i < kmAt.length; i++) {
    const [k0, k1] = [kmAt[i - 1]!, kmAt[i]!];
    const lo = Math.min(k0, k1);
    const hi = Math.max(k0, k1);
    for (let k = Math.ceil(lo); k <= hi && k1 !== k0; k++) {
      if (k === lo && i > 1) continue; // a whole km on a vertex: once
      const f = (k - k0) / (k1 - k0);
      const [a0, b0] = pts[i - 1]!;
      const [a1, b1] = pts[i]!;
      posts.push([k, round(a0 + f * (a1 - a0), 5), round(b0 + f * (b1 - b0), 5)]);
    }
  }
  return {
    track,
    kmFrom,
    kmTo,
    length: round(length),
    speeds,
    curves,
    points,
    ...(structures.length ? { structures } : {}),
    geo: { segments, posts },
  };
}

/** ÖBB section track number "e21" → track 1 ("…1"/"…2" = Regelgleis of direction 1/2) */
export const trackOf = (ref: string | undefined): "1" | "2" | null => {
  const m = /^[a-z0-9]\d([12])$/i.exec(ref ?? "");
  return m ? (m[1] as "1" | "2") : null;
};

/**
 * Start and end of a line track: the nodes with the smallest / largest OSM kilometre — within the
 * connected part of the network holding most of the line's positions, and within the largest run
 * of kilometres without jumps > 20 km (wrong positions, e.g. of a node shared with another line).
 */
export function kmExtremes(
  ways: Way[],
  nodeTags: Map<number, Record<string, string>>,
  adj?: Map<number, Edge[]>,
  coords?: RailExtract["coords"],
) {
  const pos: { n: number; km: number }[] = [];
  for (const w of ways)
    for (const n of w.nodes) {
      const t = nodeTags.get(n);
      const km = parsePosition(t?.["railway:position:exact"] ?? t?.["railway:position"]);
      if (km !== null) pos.push({ n, km });
    }
  if (pos.length < 2) return null;
  let cand = pos;
  if (adj) {
    // connected components (undirected), restricted to the nodes with positions
    const comp = new Map<number, number>();
    let c = 0;
    for (const p of pos) {
      if (comp.has(p.n)) continue;
      const stack = [p.n];
      comp.set(p.n, c);
      while (stack.length) {
        const n = stack.pop()!;
        for (const e of adj.get(n) ?? [])
          if (!comp.has(e.b)) {
            comp.set(e.b, c);
            stack.push(e.b);
          }
      }
      c++;
    }
    const size = new Map<number, number>();
    for (const p of pos) size.set(comp.get(p.n)!, (size.get(comp.get(p.n)!) ?? 0) + 1);
    const best = [...size].sort((a, b) => b[1] - a[1])[0]![0];
    cand = pos.filter((p) => comp.get(p.n) === best);
  }
  cand.sort((a, b) => a.km - b.km);
  // largest run without km jumps > 20 and without positions much farther apart than their km
  // difference (straight-line distance d ≤ Δ·1.5 + 3; wrong positions of other lines break a run)
  const at = (n: number) => coords?.[n];
  let bestRun: [number, number] = [0, 0];
  for (let i = 0, start = 0; i < cand.length; i++) {
    if (i > 0) {
      const dkm = cand[i]!.km - cand[i - 1]!.km;
      const a = at(cand[i - 1]!.n);
      const b = at(cand[i]!.n);
      const d = a && b ? distKm(a, b) : dkm;
      if (dkm > 20 || d > dkm * 1.5 + 3) start = i;
    }
    if (i - start > bestRun[1] - bestRun[0]) bestRun = [start, i];
  }
  const lo = cand[bestRun[0]]!;
  const hi = cand[bestRun[1]]!;
  return lo.n !== hi.n ? { lo, hi } : null;
}

/**
 * Tracks of one line: per direction (1/2) the Regelgleis as one continuous path through the
 * stations — its own section tracks preferred, the other direction's avoided, ways of the line
 * cheaper than connectors without line number (station through tracks), other lines expensive;
 * single-track lines as the cheapest path between the line's kilometre extremes.
 */
/** the two ends of a line's ways (nodes used by one way end only) that are farthest apart */
export function farthestEnds(ways: Way[], coords: RailExtract["coords"]) {
  const deg = new Map<number, number>();
  for (const w of ways)
    for (const n of [w.nodes[0]!, w.nodes.at(-1)!]) deg.set(n, (deg.get(n) ?? 0) + 1);
  const ends = [...deg].filter(([n, d]) => d === 1 && coords[n]).map(([n]) => n);
  let best: { lo: { n: number; km: number }; hi: { n: number; km: number } } | null = null;
  let max = 0;
  for (let i = 0; i < ends.length; i++)
    for (let j = i + 1; j < ends.length; j++) {
      const d = distKm(coords[ends[i]!]!, coords[ends[j]!]!);
      if (d > max) {
        max = d;
        best = { lo: { n: ends[i]!, km: 0 }, hi: { n: ends[j]!, km: d } };
      }
    }
  return best;
}

/**
 * The path as pieces of equal attributes for the network map: permitted speed (higher
 * direction), electrified, ETCS level, PZB, gauge, track count (2 where the other direction runs
 * on other ways). Simplified to ~30 m.
 */
export function networkPieces(
  path: Edge[],
  coords: RailExtract["coords"],
  otherDirection?: Set<number>,
): NetPiece[] {
  const attrs = (e: Edge): Omit<NetPiece, "line"> => {
    const t = e.way.tags;
    const vs = [t.maxspeed, t["maxspeed:forward"], t["maxspeed:backward"]]
      .map(parseSpeed)
      .filter((v): v is number => v !== null);
    const etcs = Number.parseInt(t["railway:etcs"] ?? "", 10);
    return {
      ...(vs.length ? { v: Math.max(...vs) } : {}),
      ...(t.electrified ? { e: t.electrified !== "no" } : {}),
      ...(Number.isFinite(etcs) && etcs > 0 ? { etcs } : {}),
      ...(t["railway:pzb"] ? { pzb: t["railway:pzb"] !== "no" } : {}),
      ...(t.gauge ? { g: t.gauge } : {}),
      // double track: in the Austrian OSM data each track of a double-track line carries a
      // preferred direction (forward/backward), single-track lines none (or "both"); also where
      // the two computed directions run on different ways
      tr:
        t["railway:preferred_direction"] === "forward" ||
        t["railway:preferred_direction"] === "backward" ||
        (otherDirection && !otherDirection.has(e.way.id))
          ? 2
          : 1,
    };
  };
  const key = (a: Omit<NetPiece, "line">) => JSON.stringify(a);
  const out: NetPiece[] = [];
  let run: [number, number][] = [];
  let cur: Omit<NetPiece, "line"> | undefined;
  const flush = () => {
    if (cur && run.length > 1) out.push({ line: encodePolyline(simplify(run, 30)), ...cur });
  };
  for (const e of path) {
    const a = attrs(e);
    const [pa, pb] = [coords[e.a]!, coords[e.b]!];
    if (!cur || key(a) !== key(cur)) {
      flush();
      run = [pa];
      cur = a;
    }
    run.push(pb);
  }
  flush();
  return out;
}

/** cost of a crossover (km): worth it only to leave ≥ ~0.6 km of the other direction's track */
const CROSSOVER_KM = 2;

export function lineTracks(
  ref: string,
  lineWays: Way[],
  adj: Map<number, Edge[]>,
  /** adj with the crossovers, for the paths */
  pathAdj: Map<number, Edge[]>,
  ex: Pick<RailExtract, "coords" | "stations">,
  nodeTags: Map<number, Record<string, string>>,
  members: Set<number>,
): VzgTrack[] {
  const onLine = (w: Way) => w.tags.ref === ref || members.has(w.id);
  const cost = (e: Edge, d?: "1" | "2") => {
    const w = e.way;
    // crossovers: a Regelgleis does not change tracks, but a direction may have to cross over
    // once to reach its own track (both directions start at the same end node; e.g. the Südbahn
    // at Bruck an der Mur, where only crossovers link the two tracks): a fixed penalty, only
    // for the direction runs of a double-track line (Infinity: never relaxed)
    if (w.tags.service === "crossover") return d ? e.len + CROSSOVER_KM : Infinity;
    // tracks under construction only for their own line, and only to close a gap (Infinity:
    // shortestPath never relaxes such an edge)
    if (w.tags.construction) return onLine(w) ? e.len * 4 : Infinity;
    if (!onLine(w)) return e.len * (w.tags.ref ? 6 : 2);
    const t = trackOf(w.tags["railway:track_ref"]);
    return e.len * (d && t === d ? 0.5 : d && t ? 4 : 1);
  };
  const tracks: VzgTrack[] = [];
  const seeds = {
    "1": lineWays.filter((w) => trackOf(w.tags["railway:track_ref"]) === "1"),
    "2": lineWays.filter((w) => trackOf(w.tags["railway:track_ref"]) === "2"),
  };
  // double track: both directions have their own section tracks; one direction alone (a few
  // station tracks with direction numbers, e.g. Karwendelbahn near Innsbruck) is a single-track line
  const directions = (["1", "2"] as const).filter((d) => seeds[d].length >= 2);
  const double = directions.length === 2;
  const runs: [string, "1" | "2" | undefined][] = double
    ? directions.map((d) => [d, d])
    : [["1", undefined]];
  // the line's ends: the two farthest ends of its relation's ways (independent of how well its
  // km positions are tagged; double track often covers only part of a line, e.g. Salzburg –
  // Taxenbach on the Salzburg-Tiroler-Bahn); without relation: from the km positions
  // tracks under construction (extract.ts) only bridge gaps in the graph: the ends come from the
  // tracks in service (a relation may list new tracks far beyond today's line)
  const inService = lineWays.filter((w) => !w.tags.construction);
  const rel = inService.filter((w) => members.has(w.id));
  const candidates = [
    rel.length ? farthestEnds(rel, ex.coords) : null,
    // per direction from its own section tracks (only the double-track part)
    ...directions.map((d) => kmExtremes(seeds[d], nodeTags, adj, ex.coords)),
    kmExtremes(inService, nodeTags, adj, ex.coords),
    farthestEnds(inService, ex.coords),
  ].filter((e): e is NonNullable<typeof e> => !!e);
  // the first candidate whose paths are plausible: no detour (path much longer than its km
  // range, i.e. a gap in the line bridged over other lines); relation ends may also lie in
  // disconnected parts (no path); else the first that yields tracks at all
  let fallback: { ts: VzgTrack[]; ratio: number } | undefined;
  for (const ext of candidates) {
    const ts: VzgTrack[] = [];
    const paths: Edge[][] = [];
    for (const [track, d] of runs) {
      let path = shortestPath(adj, ext.lo.n, ext.hi.n, (e) => cost(e, d));
      // a direction of a double-track line: with the crossovers, it may reach its own track
      // (both start at the same end node); taken if it leaves the other direction's track
      // (clearly cheaper, not a tie broken differently) on about as long a route (not a
      // shortcut over another line)
      if (path && d) {
        const alt = shortestPath(pathAdj, ext.lo.n, ext.hi.n, (e) => cost(e, d));
        const len = (p: Edge[]) => p.reduce((s, e) => s + e.len, 0);
        const sum = (p: Edge[]) => p.reduce((s, e) => s + cost(e, d), 0);
        if (
          alt &&
          sum(alt) < sum(path) - 1 &&
          Math.abs(len(alt) - len(path)) <= 0.005 * len(path) + 0.3
        )
          path = alt;
      }
      const t = path && buildTrack(track, path, ex, nodeTags);
      if (t) {
        ts.push(t);
        paths.push(path!);
      }
    }
    if (!ts.length) continue;
    // network map pieces (first track; double track where the second runs on other ways)
    ts[0]!.net = networkPieces(
      paths[0]!,
      ex.coords,
      paths[1] ? new Set(paths[1].map((e) => e.way.id)) : undefined,
    );
    const ratio = Math.max(...ts.map((t) => (t.length - 2) / Math.max(1, t.kmTo - t.kmFrom)));
    if (ratio <= 1.3) return ts;
    if (!fallback || ratio < fallback.ratio) fallback = { ts, ratio };
  }
  return fallback?.ts ?? tracks;
}

/** ÖBB line numbers ("101 01"), the default pattern of the national line numbers */
export const OEBB_LINE_REF = /^\d{3} \d{2}$/;

/** most common value of a way tag */
function common(ways: Way[], key: string): string | undefined {
  const c = new Map<string, number>();
  for (const w of ways) if (w.tags[key]) c.set(w.tags[key]!, (c.get(w.tags[key]!) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * All lines: the national lines by their number (`lineRef`, e.g. ÖBB "101 01"; route=tracks
 * relations + ways with a line `ref`), and the other `route=tracks` relations with a name whose
 * ways are mostly in the extract (private and narrow-gauge railways, light rail such as the
 * Stubaitalbahn; foreign and abandoned lines drop out), merged by name.
 */
export function buildLines(ex: RailExtract, lineRef: RegExp = OEBB_LINE_REF): VzgLine[] {
  const NUMBERED = lineRef;
  const nodeTags = new Map(ex.nodes.map((n) => [n.id, n.tags]));
  const byId = new Map(ex.ways.map((w) => [w.id, w]));
  // one graph of all tracks, crossovers excluded (a Regelgleis does not change tracks; the
  // connected parts of a line's km positions); the paths also get the crossovers, for a
  // direction reaching its own track (see lineTracks)
  const adj = trackGraph(
    ex.ways.filter((w) => w.tags.service !== "crossover"),
    ex.coords,
  );
  const crossovers = trackGraph(
    ex.ways.filter((w) => w.tags.service === "crossover"),
    ex.coords,
  );
  const paths = new Map(adj);
  for (const [n, es] of crossovers) paths.set(n, [...(adj.get(n) ?? []), ...es]);
  type Group = { key: string; oebb: boolean; rels: RailExtract["lines"]; ways: Way[] };
  const groups = new Map<string, Group>();
  const group = (key: string, oebb: boolean) => {
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { key, oebb, rels: [], ways: [] }));
    return g;
  };
  // ways tagged with a line ref but without relation still count
  for (const w of ex.ways)
    if (w.tags.ref && NUMBERED.test(w.tags.ref)) group(w.tags.ref, true).ways.push(w);
  const oebbWays = new Set([
    ...ex.ways.filter((w) => w.tags.ref && NUMBERED.test(w.tags.ref)).map((w) => w.id),
    ...ex.lines.filter((r) => NUMBERED.test(r.ref)).flatMap((r) => r.ways),
  ]);
  for (const rel of ex.lines) {
    const members = rel.ways.map((id) => byId.get(id)).filter((w): w is Way => !!w);
    let g: Group;
    if (NUMBERED.test(rel.ref)) g = group(rel.ref, true);
    else {
      if (!rel.name || NUMBERED.test(rel.name) || members.length < Math.max(1, rel.ways.length / 2))
        continue;
      // already an ÖBB line (e.g. NÖVOG's Waldviertelbahn = 177 01 / 179 01)
      if (members.filter((w) => oebbWays.has(w.id)).length >= members.length / 2) continue;
      g = group(rel.name, false);
    }
    g.rels.push(rel);
    for (const w of members) if (!g.ways.includes(w)) g.ways.push(w);
  }
  const out: VzgLine[] = [];
  const sorted = [...groups.values()].sort(
    (a, b) => Number(b.oebb) - Number(a.oebb) || a.key.localeCompare(b.key),
  );
  for (const g of sorted) {
    const lineWays = g.ways.filter((w) => w.tags.service !== "crossover");
    const members = new Set(g.rels.flatMap((r) => r.ways));
    const ref = g.oebb ? g.key : g.rels.find((r) => r.ref)?.ref;
    const tracks = lineTracks(
      g.oebb ? g.key : `\u0000${g.key}`,
      lineWays,
      adj,
      paths,
      ex,
      nodeTags,
      members,
    );
    if (!tracks.length) continue;
    const rel = g.rels[0];
    const name = g.oebb
      ? rel?.name && rel.name !== g.key
        ? rel.name
        : // a way's name, not a tunnel's or bridge's own name ("Tunel br. 245")
          (g.ways.find((w) => w.tags.name && !w.tags.tunnel && !w.tags.bridge)?.tags.name ??
          g.ways.find((w) => w.tags.name)?.tags.name)
      : g.key;
    const gauge = common(lineWays, "gauge");
    const operator = rel?.operator || common(lineWays, "operator");
    out.push({
      id: lineId(g.key),
      ...(ref ? { ref } : {}),
      ...(name ? { name } : {}),
      ...(operator ? { operator } : {}),
      ...(gauge ? { gauge } : {}),
      ...(g.rels.find((r) => r.wikidata)
        ? { wikidata: g.rels.find((r) => r.wikidata)!.wikidata }
        : {}),
      ...(rel?.from ? { from: rel.from } : {}),
      ...(rel?.to ? { to: rel.to } : {}),
      source: `OpenStreetMap (${ex.source}), © OpenStreetMap contributors, ODbL 1.0`,
      tracks,
    });
  }
  return out;
}
