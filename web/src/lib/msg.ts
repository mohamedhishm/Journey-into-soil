import type { TFunction } from "i18next";

const ID_PARAMS: Record<string, string> = {
  crop: "crop",
  prev: "crop",
  family: "family",
  texture: "texture",
  season: "season",
  priority: "priority",
};

/** Render an engine message. Id-like params (crop, family, season...) are translated; numbers are localised. */
export function msgText(t: TFunction, lang: string, m: { key: string; params?: Record<string, string | number> }): string {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(m.params ?? {})) {
    if (ID_PARAMS[k] && typeof v === "string") params[k] = t(`${ID_PARAMS[k]}.${v}`);
    else if (typeof v === "number") params[k] = v.toLocaleString(lang === "ar" ? "ar-EG" : "en", { maximumFractionDigits: 1 });
    else params[k] = v;
  }
  return t(m.key, params) as string;
}

export const fmt = (lang: string, n: number, digits = 0) =>
  n.toLocaleString(lang === "ar" ? "ar-EG" : "en", { maximumFractionDigits: digits });
