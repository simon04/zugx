// Minimal i18n (replaces vue-i18n): nested message objects per locale, `{name}` interpolation,
// English fallback, reactive locale. Keys are type-checked against the English messages.
import { ref, type App } from "vue";
import de from "./de.ts";
import en from "./en.ts";
import es from "./es.ts";
import it from "./it.ts";
import sl from "./sl.ts";

export const LOCALES = ["en", "de", "it", "sl", "es"] as const;
export type Locale = (typeof LOCALES)[number];

type Messages = typeof en;
const MESSAGES: Record<Locale, Messages> = { en, de, it, sl, es };

/** dotted paths to string messages, e.g. "nav.trains" */
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Leaves<Messages>;
/** dotted paths to any message value (also arrays/objects), for tm() */
type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string | readonly unknown[]
    ? `${P}${K}`
    : `${P}${K}` | Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
type At<T, K extends string> = K extends `${infer H}.${infer R}`
  ? H extends keyof T
    ? At<T[H], R>
    : never
  : K extends keyof T
    ? T[K]
    : never;

function initialLocale(): Locale {
  const saved = localStorage.getItem("zugx:lang");
  if (saved && (LOCALES as readonly string[]).includes(saved)) return saved as Locale;
  for (const l of navigator.languages ?? [navigator.language]) {
    const short = l.slice(0, 2) as Locale;
    if (LOCALES.includes(short)) return short;
  }
  return "en";
}

/** the current locale; reading it inside t() makes every render that translates reactive */
export const locale = ref<Locale>(initialLocale());
document.documentElement.lang = locale.value;

const lookup = (messages: unknown, key: string): unknown =>
  key
    .split(".")
    .reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], messages);

/** Translate a key; `{name}` placeholders are replaced from params. Missing → English → the key. */
export function t(key: MessageKey, params?: Record<string, string | number | undefined>): string {
  const msg = lookup(MESSAGES[locale.value], key) ?? lookup(en, key);
  if (typeof msg !== "string") return key;
  return params
    ? msg.replace(/\{(\w+)\}/g, (m, p: string) => String(p in params ? (params[p] ?? "") : m))
    : msg;
}

/** Raw message value (e.g. an array of weekday names). */
export function tm<K extends Paths<Messages>>(key: K): At<Messages, K> {
  return (lookup(MESSAGES[locale.value], key) ?? lookup(en, key)) as At<Messages, K>;
}

export function setLocale(l: Locale) {
  locale.value = l;
  localStorage.setItem("zugx:lang", l);
  document.documentElement.lang = l;
}

/** Composition API access, same shape as before */
export const useI18n = () => ({ t, tm, locale });

/** Vue plugin: `$t` in templates */
export const i18n = {
  install(app: App) {
    app.config.globalProperties.$t = t;
  },
};

declare module "vue" {
  interface ComponentCustomProperties {
    $t: typeof t;
  }
}

/** HAFAS language code for the current locale (ÖBB HAFAS has no Slovenian or Spanish: English texts) */
export const hafasLang = () =>
  ({ en: "eng", de: "deu", it: "ita", sl: "eng", es: "eng" } as const)[locale.value];
