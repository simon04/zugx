// Locate / download GTFS feeds. Default: the feeds of the current country (COUNTRY, see
// country.ts; Austria: ÖBB open data GTFS, CC BY 4.0). Override with
// GTFS_ZIP=<path or URL>[,<path or URL>...] to use (and merge) other feeds, e.g. the Austria-wide
// dataset from mobilitydata.gv.at.
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rename, stat } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { currentCountry } from "./country.ts";

export const OEBB_GTFS_URL =
  "https://static.web.oebb.at/open-data/soll-fahrplan-gtfs/GTFS_Fahrplan_2026.zip";

/** Repository root (packages/gtfs/src → ../../..) */
export const REPO_ROOT = resolve(import.meta.dirname, "..", "..", "..");
export const CACHE_DIR = join(REPO_ROOT, ".cache");

export interface FeedSource {
  /** what was configured (URL or path) */
  source: string;
  /** local zip path */
  path: string;
}

export function configuredFeeds(env = process.env): string[] {
  const v = env.GTFS_ZIP?.trim();
  if (!v) return currentCountry(env).feeds;
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const isUrl = (s: string) => /^https?:\/\//i.test(s);

/** Resolve configured feeds to local zip files, downloading URLs into .cache/ if not present. */
export async function fetchFeeds(
  log: (msg: string) => void = console.log,
  env = process.env,
): Promise<FeedSource[]> {
  const out: FeedSource[] = [];
  for (const source of configuredFeeds(env)) {
    if (!isUrl(source)) {
      // a zip or an unpacked directory (Germany: the rail extract, vp run gtfs:rail); relative to
      // the working directory, else to the repository (countries.toml: ".cache/de-rail")
      const local = resolve(process.cwd(), source);
      const path = isAbsolute(source)
        ? source
        : existsSync(local)
          ? local
          : resolve(REPO_ROOT, source);
      if (!existsSync(path)) throw new Error(`GTFS feed not found: ${path}`);
      out.push({ source, path });
      continue;
    }
    await mkdir(CACHE_DIR, { recursive: true });
    const path = join(CACHE_DIR, basename(new URL(source).pathname) || "gtfs.zip");
    if (existsSync(path) && !env.GTFS_REFRESH) {
      const s = await stat(path);
      log(`gtfs: using cached ${path} (${mb(s.size)})`);
    } else {
      const t0 = Date.now();
      log(`gtfs: downloading ${source} …`);
      const res = await fetch(source, {
        headers: { "User-Agent": "zugx (https://zugx.legner.me)" },
      });
      if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status} ${source}`);
      const tmp = `${path}.part`;
      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp));
      await rename(tmp, path);
      const s = await stat(path);
      log(`gtfs: downloaded ${mb(s.size)} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    }
    out.push({ source, path });
  }
  return out;
}

const mb = (n: number) => `${(n / 1e6).toFixed(1)} MB`;
