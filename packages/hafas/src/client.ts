// Minimal typed client for the ÖBB HAFAS mgate API.
// Runs in the browser (via the same-origin /api/mgate proxy) and in Node (direct).
import {
  ALL_PRODUCTS,
  parseHimSearch,
  parseJourneyDetails,
  parseJourneyGeoPos,
  parseJourneyMatch,
  parseLocGeoPos,
  parseLocMatch,
  parseReconstruction,
  parseStationBoard,
  parseTripSearch,
  stationLid,
  VIENNA,
} from "./parse.ts";
import type {
  BoardEntry,
  Journey,
  JourneysResult,
  Location,
  Movement,
  Trip,
  TripMatch,
  Warning,
} from "./types.ts";

export const OEBB_ENDPOINT = "https://fahrplan.oebb.at/bin/mgate.exe";

export interface ClientOptions {
  /** mgate URL; in the browser use the same-origin proxy "/api/mgate" */
  endpoint?: string;
  /** fetch priority, e.g. "low" for background refreshes (Fetch Priority API) */
  priority?: RequestPriority;
  fetch?: typeof fetch;
  /** cache TTL in ms for identical requests (default 30 s, 0 disables) */
  ttl?: number;
  lang?: "deu" | "eng" | "ita";
  /** extra headers (e.g. User-Agent in Node) */
  headers?: Record<string, string>;
  /** called with each raw request/response pair, e.g. for a debug view */
  onExchange?: (ex: Exchange) => void;
}

export interface Exchange {
  meth: string;
  request: unknown;
  response: unknown;
  ms: number;
  cached: boolean;
}

export class HafasError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly meth: string,
  ) {
    super(message);
    this.name = "HafasError";
  }
}

/** Point in time for a query: an instant, or a wall-clock time in any zone (converted to Vienna). */
export type When = Temporal.Instant | Temporal.ZonedDateTime;

/** Split a point in time into HAFAS date/time strings in Europe/Vienna. */
export function hafasDateTime(when: When = Temporal.Now.instant()): { date: string; time: string } {
  const z =
    when instanceof Temporal.Instant ? when.toZonedDateTimeISO(VIENNA) : when.withTimeZone(VIENNA);
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${z.year}${p(z.month)}${p(z.day)}`,
    time: `${p(z.hour)}${p(z.minute)}00`,
  };
}

export interface JourneysOptions {
  when?: When;
  /** true = `when` is the arrival time */
  arrival?: boolean;
  via?: string;
  products?: number;
  results?: number;
  /** minimal transfer time in minutes */
  transferTime?: number;
  maxTransfers?: number;
  polylines?: boolean;
  /** paging reference from a previous result (earlierRef / laterRef) */
  ref?: string;
}

export interface BoardOptions {
  when?: When;
  arrivals?: boolean;
  /** minutes */
  duration?: number;
  results?: number;
  products?: number;
}

export function createClient(opts: ClientOptions = {}) {
  const endpoint = opts.endpoint ?? OEBB_ENDPOINT;
  const doFetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  const ttl = opts.ttl ?? 30_000;
  const cache = new Map<string, { t: number; p: Promise<unknown> }>();

  async function request<T = any>(meth: string, req: unknown): Promise<T> {
    // fixed key order → deterministic body → cache hits for equal requests
    const body = {
      id: "1",
      ver: "1.67",
      lang: opts.lang ?? "deu",
      auth: { type: "AID", aid: "OWDL4fE4ixNiPBBm" },
      client: { id: "OEBB", type: "WEB", name: "webapp", l: "vs_webapp" },
      formatted: false,
      svcReqL: [{ meth, req }],
    };
    const key = JSON.stringify(body);
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && now - hit.t < ttl) {
      const response = await hit.p;
      opts.onExchange?.({ meth, request: body, response, ms: 0, cached: true });
      return svcRes(response, meth) as T;
    }
    const p = (async () => {
      const res = await doFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...opts.headers },
        body: key,
        ...(opts.priority ? { priority: opts.priority } : {}),
      });
      if (!res.ok) throw new HafasError(`HTTP ${res.status}`, `HTTP_${res.status}`, meth);
      return res.json();
    })();
    if (ttl > 0) cache.set(key, { t: now, p });
    try {
      const response = await p;
      opts.onExchange?.({ meth, request: body, response, ms: Date.now() - now, cached: false });
      return svcRes(response, meth) as T;
    } catch (e) {
      cache.delete(key);
      throw e;
    }
  }

  function svcRes(json: any, meth: string) {
    if (json?.err && json.err !== "OK")
      throw new HafasError(json.errTxt ?? json.err, json.err, meth);
    const svc = json?.svcResL?.[0];
    if (!svc) throw new HafasError("empty response", "EMPTY", meth);
    if (svc.err && svc.err !== "OK") throw new HafasError(svc.errTxt ?? svc.err, svc.err, meth);
    return svc.res;
  }

  const loc = (id: string) => ({ type: "S", lid: stationLid(id) });

  return {
    request,

    async locations(query: string, results = 10): Promise<Location[]> {
      const res = await request("LocMatch", {
        input: { field: "S", loc: { name: query, type: "ALL" }, maxLoc: results },
      });
      return parseLocMatch(res);
    },

    async nearby(lat: number, lon: number, distance = 1000, results = 10): Promise<Location[]> {
      const res = await request("LocGeoPos", {
        ring: { cCrd: { x: Math.round(lon * 1e6), y: Math.round(lat * 1e6) }, maxDist: distance },
        getPOIs: false,
        getStops: true,
        maxLoc: results,
      });
      return parseLocGeoPos(res);
    },

    async board(stationId: string, o: BoardOptions = {}): Promise<BoardEntry[]> {
      const type = o.arrivals ? "ARR" : "DEP";
      const { date, time } = hafasDateTime(o.when);
      const res = await request("StationBoard", {
        type,
        date,
        time,
        stbLoc: loc(stationId),
        jnyFltrL: [{ type: "PROD", mode: "INC", value: String(o.products ?? ALL_PRODUCTS) }],
        dur: o.duration ?? 60,
        maxJny: o.results ?? 40,
      });
      return parseStationBoard(res, type);
    },

    async journeys(from: string, to: string, o: JourneysOptions = {}): Promise<JourneysResult> {
      const { date, time } = hafasDateTime(o.when);
      const req: Record<string, unknown> = {
        depLocL: [loc(from)],
        arrLocL: [loc(to)],
        outDate: date,
        outTime: time,
        outFrwd: !o.arrival,
        getPasslist: true,
        getPolyline: o.polylines ?? false,
        numF: o.results ?? 6,
        maxChg: o.maxTransfers ?? -1,
        minChgTime: o.transferTime ?? -1,
        ushrp: true,
        getTariff: false,
        jnyFltrL: [{ type: "PROD", mode: "INC", value: String(o.products ?? ALL_PRODUCTS) }],
      };
      if (o.via) req.viaLocL = [{ loc: loc(o.via) }];
      if (o.ref) req.ctxScr = o.ref;
      return parseTripSearch(await request("TripSearch", req));
    },

    async refreshJourney(recon: string, polylines = false): Promise<Journey | undefined> {
      const res = await request("Reconstruction", {
        outReconL: [{ ctx: recon }],
        getIST: true,
        getPasslist: true,
        getPolyline: polylines,
      });
      return parseReconstruction(res);
    },

    async trip(journeyId: string, polyline = true): Promise<Trip> {
      const res = await request("JourneyDetails", {
        jid: journeyId,
        getPolyline: polyline,
        getPasslist: true,
      });
      return parseJourneyDetails(res);
    },

    /** Find trains by name/number, e.g. "RJX 162" or "162". */
    async tripsByName(query: string, when?: When): Promise<TripMatch[]> {
      const { date } = hafasDateTime(when);
      try {
        const res = await request("JourneyMatch", { input: query, date, onlyCR: false });
        return parseJourneyMatch(res);
      } catch (e) {
        if (e instanceof HafasError && e.code === "NO_MATCH") return [];
        throw e;
      }
    },

    async radar(
      bbox: { north: number; west: number; south: number; east: number },
      o: { results?: number; products?: number; when?: When } = {},
    ): Promise<Movement[]> {
      const { date, time } = hafasDateTime(o.when);
      const res = await request("JourneyGeoPos", {
        maxJny: o.results ?? 200,
        onlyRT: false,
        date,
        time,
        rect: {
          llCrd: { x: Math.round(bbox.west * 1e6), y: Math.round(bbox.south * 1e6) },
          urCrd: { x: Math.round(bbox.east * 1e6), y: Math.round(bbox.north * 1e6) },
        },
        perSize: 30000,
        perStep: 5000,
        trainPosMode: "CALC",
        jnyFltrL: [{ type: "PROD", mode: "INC", value: String(o.products ?? ALL_PRODUCTS) }],
      });
      // the delay at the stop closest to the asked time (a past time: then, not now)
      const at = o.when instanceof Temporal.ZonedDateTime ? o.when.toInstant() : o.when;
      return parseJourneyGeoPos(res, at);
    },

    /** HIM messages; `kinds`: only these HIM categories (see Warning.kind) */
    async warnings(results = 100, kinds?: number[]): Promise<Warning[]> {
      const himFltrL = (kinds ?? []).map((k) => ({
        type: "HIMCAT",
        mode: "INC",
        value: String(k),
      }));
      const res = await request("HimSearch", { himFltrL, getPolyline: false, maxNum: results });
      return parseHimSearch(res);
    },

    clearCache() {
      cache.clear();
    },
  };
}

export type HafasClient = ReturnType<typeof createClient>;
