import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import engineAr from "./engine.ar.json";
import engineEn from "./engine.en.json";
import uiAr from "./ui.ar.json";
import uiEn from "./ui.en.json";

export type Lang = "en" | "ar";

// Flat keys that contain dots ("why.focus"), so the key and namespace separators are disabled.
void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: { ...engineEn, ...uiEn } },
    ar: { translation: { ...engineAr, ...uiAr } },
  },
  lng: "en",
  fallbackLng: "en",
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
});

export default i18n;
