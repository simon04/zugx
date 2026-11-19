// Vite plugin: `import data from "./x.toml"` works like a JSON import (parsed at build time,
// "" → null as in fromToml; emitted as JSON.parse of a string literal, fast for big files).
// A generated data file (packages/*/data/**) that doesn't parse doesn't fail the build: it becomes a
// module that throws when loaded (with a build warning), so only what reads it fails — the app
// loads each country's data on its own and leaves a broken country out. Other TOML (config such as
// countries.toml) stays strict.
import { readFileSync } from "node:fs";
import { fromToml } from "./index.ts";

/** minimal structural type of a Vite plugin (avoids depending on a particular Vite build) */
interface TomlPlugin {
  name: string;
  load(
    this: { addWatchFile(file: string): void; warn(msg: string): void },
    id: string,
  ): { code: string; map: { mappings: string } } | null;
}

export function toml(): TomlPlugin {
  return {
    name: "zugx:toml",
    load(id) {
      const [path, query] = id.split("?");
      if (!path!.endsWith(".toml") || query) return null;
      this.addWatchFile(path!);
      let data: unknown;
      try {
        data = fromToml(readFileSync(path!, "utf8"));
      } catch (e) {
        if (!/\/packages\/[^/]+\/data\//.test(path!)) throw e;
        const msg = `${path}: not valid TOML, left out (${e instanceof Error ? e.message : e})`;
        this.warn(msg);
        return { code: `throw new Error(${JSON.stringify(msg)});\n`, map: { mappings: "" } };
      }
      return {
        code: `export default JSON.parse(${JSON.stringify(JSON.stringify(data))});\n`,
        map: { mappings: "" },
      };
    },
  };
}
