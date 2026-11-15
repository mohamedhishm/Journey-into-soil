import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DemoSite } from "../../scene/types";
import { useStore } from "../../state/store";

export interface GovernorateData {
  id: string;
  name_en: string;
  name_ar: string;
  zone: "delta" | "canal" | "upper" | "desert";
  x: number; // percentage
  y: number; // percentage
  align: "left" | "right" | "top" | "bottom";
  soil_en: string;
  soil_ar: string;
  et0: string;
  lat: number;
  lon: number;
}

export const EGYPT_GOVERNORATES: GovernorateData[] = [
  { id: "alexandria", name_en: "Alexandria", name_ar: "الإسكندرية", zone: "delta", x: 37.0, y: 15.4, align: "left", soil_en: "Sandy Loam to Clay", soil_ar: "طميية رملية إلى طينية", et0: "4.8 mm/d", lat: 31.20, lon: 29.92 },
  { id: "matrouh", name_en: "Matrouh", name_ar: "مطروح", zone: "desert", x: 12.9, y: 13.9, align: "right", soil_en: "Calcareous Sand", soil_ar: "رملية جيرية", et0: "5.1 mm/d", lat: 31.35, lon: 27.24 },
  { id: "beheira", name_en: "Beheira", name_ar: "البحيرة", zone: "delta", x: 41.9, y: 17.0, align: "left", soil_en: "Clay & Reclaimed Sand", soil_ar: "طميية ورملية مستصلحة", et0: "4.9 mm/d", lat: 31.04, lon: 30.47 },
  { id: "nubaria", name_en: "Nubaria", name_ar: "النوبارية", zone: "desert", x: 38.3, y: 20.5, align: "left", soil_en: "Sandy Reclaimed Loam", soil_ar: "رملية مستصلحة", et0: "5.2 mm/d", lat: 30.67, lon: 30.07 },
  { id: "kafr_el_sheikh", name_en: "Kafr El Sheikh", name_ar: "كفر الشيخ", zone: "delta", x: 46.1, y: 16.3, align: "top", soil_en: "Heavy Alluvial Clay", soil_ar: "طينية رسوبية ثقيلة", et0: "4.7 mm/d", lat: 31.11, lon: 30.94 },
  { id: "gharbia", name_en: "Gharbia", name_ar: "الغربية", zone: "delta", x: 46.6, y: 19.3, align: "right", soil_en: "Rich Silty Clay", soil_ar: "طينية سلتية خصبة", et0: "4.8 mm/d", lat: 30.88, lon: 31.03 },
  { id: "damietta", name_en: "Damietta", name_ar: "دمياط", zone: "delta", x: 54.2, y: 13.4, align: "top", soil_en: "Coastal Clay & Saline", soil_ar: "طينية ساحلية مالحة", et0: "4.6 mm/d", lat: 31.42, lon: 31.81 },
  { id: "dakahlia", name_en: "Dakahlia", name_ar: "الدقهلية", zone: "delta", x: 50.3, y: 17.0, align: "right", soil_en: "Deep Fertile Clay", soil_ar: "طينية رسوبية عميقة", et0: "4.8 mm/d", lat: 31.04, lon: 31.38 },
  { id: "port_said", name_en: "Port Said", name_ar: "بورسعيد", zone: "canal", x: 58.7, y: 14.8, align: "right", soil_en: "Saline Coastal Silt", soil_ar: "سلتية ساحلية مالحة", et0: "4.7 mm/d", lat: 31.26, lon: 32.30 },
  { id: "sharqia", name_en: "Sharqia", name_ar: "الشرقية", zone: "delta", x: 51.4, y: 21.3, align: "bottom", soil_en: "Clay Loam & Eastern Sand", soil_ar: "طميية طينية ورملية", et0: "5.0 mm/d", lat: 30.59, lon: 31.50 },
  { id: "ismailia", name_en: "Ismailia", name_ar: "الإسماعيلية", zone: "canal", x: 58.5, y: 21.2, align: "right", soil_en: "Sandy Loam to Sand", soil_ar: "طميية رملية خفيفة", et0: "5.3 mm/d", lat: 30.60, lon: 32.27 },
  { id: "qalyubia", name_en: "Qalyubia", name_ar: "القليوبية", zone: "delta", x: 48.2, y: 22.8, align: "left", soil_en: "Alluvial Clay Loam", soil_ar: "طميية طينية رسوبية", et0: "4.9 mm/d", lat: 30.46, lon: 31.18 },
  { id: "cairo", name_en: "Cairo", name_ar: "القاهرة", zone: "delta", x: 48.9, y: 26.3, align: "right", soil_en: "Floodplain Loam", soil_ar: "طميية نهرية", et0: "5.2 mm/d", lat: 30.04, lon: 31.24 },
  { id: "giza", name_en: "Giza", name_ar: "الجيزة", zone: "upper", x: 48.0, y: 26.9, align: "left", soil_en: "Clay Loam & Sand Margin", soil_ar: "طميية طينية وأطراف رملية", et0: "5.3 mm/d", lat: 30.01, lon: 31.21 },
  { id: "suez", name_en: "Suez", name_ar: "السويس", zone: "canal", x: 61.0, y: 27.1, align: "right", soil_en: "Gravelly Desert Loam", soil_ar: "طميية رملية وحصوية", et0: "5.6 mm/d", lat: 29.97, lon: 32.53 },
  { id: "fayoum", name_en: "Fayoum", name_ar: "الفيوم", zone: "upper", x: 45.2, y: 33.3, align: "left", soil_en: "Depression Clay Loam", soil_ar: "طميية طينية لمنخفض مغلق", et0: "5.4 mm/d", lat: 29.31, lon: 30.84 },
  { id: "beni_suef", name_en: "Beni Suef", name_ar: "بني سويف", zone: "upper", x: 47.5, y: 35.5, align: "right", soil_en: "Nile Valley Clay Loam", soil_ar: "طميية طينية لوادي النيل", et0: "5.6 mm/d", lat: 29.07, lon: 31.10 },
  { id: "minya", name_en: "Minya", name_ar: "المنيا", zone: "upper", x: 44.4, y: 44.9, align: "left", soil_en: "Silty Clay & West Sands", soil_ar: "طينية سلتية وأراضٍ غربية", et0: "5.8 mm/d", lat: 28.11, lon: 30.75 },
  { id: "asyut", name_en: "Asyut", name_ar: "أسيوط", zone: "upper", x: 48.2, y: 53.6, align: "left", soil_en: "Alluvial Clay & Reclaimed", soil_ar: "طينية رسوبية ومستصلحة", et0: "6.0 mm/d", lat: 27.18, lon: 31.18 },
  { id: "sohag", name_en: "Sohag", name_ar: "سوهاج", zone: "upper", x: 52.8, y: 59.5, align: "left", soil_en: "Fine Alluvial Clay", soil_ar: "طينية رسوبية ناعمة", et0: "6.2 mm/d", lat: 26.56, lon: 31.70 },
  { id: "qena", name_en: "Qena", name_ar: "قنا", zone: "upper", x: 62.4, y: 63.3, align: "right", soil_en: "Dense Alluvium", soil_ar: "رسوبية نيلية", et0: "6.5 mm/d", lat: 26.16, lon: 32.72 },
  { id: "luxor", name_en: "Luxor", name_ar: "الأقصر", zone: "upper", x: 61.7, y: 67.8, align: "right", soil_en: "Sandy Clay Loam", soil_ar: "طميية طينية رملية", et0: "6.6 mm/d", lat: 25.70, lon: 32.64 },
  { id: "aswan", name_en: "Aswan", name_ar: "أسوان", zone: "upper", x: 64.1, y: 83.0, align: "right", soil_en: "Coarse Loamy Sand", soil_ar: "رملية خشنة وطميية", et0: "7.1 mm/d", lat: 24.09, lon: 32.90 },
  { id: "new_valley", name_en: "New Valley", name_ar: "الوادي الجديد", zone: "desert", x: 42.4, y: 70.0, align: "left", soil_en: "Deep Oasis Sand & Clay", soil_ar: "رملية عميقة وطينية بواحات", et0: "6.8 mm/d", lat: 25.45, lon: 30.55 },
  { id: "north_sinai", name_en: "North Sinai", name_ar: "شمال سيناء", zone: "canal", x: 70.5, y: 22.0, align: "right", soil_en: "Coastal Sand Dunes", soil_ar: "كثبان رملية ساحلية", et0: "5.1 mm/d", lat: 31.13, lon: 33.80 },
  { id: "south_sinai", name_en: "South Sinai", name_ar: "جنوب سيناء", zone: "canal", x: 72.3, y: 41.0, align: "right", soil_en: "Wadi Gravel & Sand", soil_ar: "حصوية ورملية بالأودية", et0: "5.7 mm/d", lat: 28.96, lon: 33.62 },
  { id: "red_sea", name_en: "Red Sea", name_ar: "البحر الأحمر", zone: "desert", x: 74.3, y: 57.3, align: "right", soil_en: "Arid Coastal Gravel", soil_ar: "حصوية ساحلية جافة", et0: "6.3 mm/d", lat: 27.26, lon: 33.81 },
];

export function EgyptReliefMap() {
  const { t } = useTranslation();
  const { lang, openDemoSite, applySite } = useStore();
  const isAr = lang === "ar";

  const [activeGovId, setActiveGovId] = useState<string>("beheira");
  const [selectedZone, setSelectedZone] = useState<"all" | "delta" | "canal" | "upper" | "desert">("all");

  const filtered = selectedZone === "all"
    ? EGYPT_GOVERNORATES
    : EGYPT_GOVERNORATES.filter((g) => g.zone === selectedZone);

  const activeGov = EGYPT_GOVERNORATES.find((g) => g.id === activeGovId) || EGYPT_GOVERNORATES[2];

  const handleLaunch = () => {
    const demoSite: DemoSite = {
      id: activeGov.id,
      name_en: activeGov.name_en,
      name_ar: activeGov.name_ar,
      lat: activeGov.lat,
      lon: activeGov.lon,
      region: activeGov.zone === "upper" ? "upper_egypt" : activeGov.zone === "desert" ? "reclaimed" : "nile_delta",
      preset: {},
    };
    void openDemoSite(demoSite);
  };

  const handleCustomize = () => {
    const demoSite: DemoSite = {
      id: activeGov.id,
      name_en: activeGov.name_en,
      name_ar: activeGov.name_ar,
      lat: activeGov.lat,
      lon: activeGov.lon,
      region: activeGov.zone === "upper" ? "upper_egypt" : activeGov.zone === "desert" ? "reclaimed" : "nile_delta",
      preset: {},
    };
    applySite(demoSite);
    const formEl = document.getElementById("field-inputs");
    if (formEl) {
      formEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="map-section" className="astryx-section-map">
      <div className="astryx-container">
        <div className="astryx-map-header text-center">
          <h2 className="astryx-heading-2">
            {t("landing.map_title", "Agroclimatology Map of Egypt")}
          </h2>
          <p className="astryx-map-sub">
            {t(
              "landing.map_subtitle",
              "Interactive agricultural relief map highlighting 27 calibrated Egyptian governorates with NASA POWER telemetry and SoilGrids hydrology."
            )}
          </p>
        </div>

        {/* Zone Filter Chips */}
        <div className="astryx-zone-filters" role="group" aria-label={t("landing.zone_filters", "Agricultural Zones")}>
          {[
            { id: "all", label_en: "All 27 Governorates", label_ar: "كافة المحافظات الـ 27" },
            { id: "delta", label_en: "Nile Delta", label_ar: "الدلتا" },
            { id: "canal", label_en: "Suez Canal & Sinai", label_ar: "القناة وسيناء" },
            { id: "upper", label_en: "Upper Egypt (Nile Valley)", label_ar: "الصعيد ووادي النيل" },
            { id: "desert", label_en: "Oases & Desert Margins", label_ar: "الواحات والظهير الصحراوي" },
          ].map((z) => (
            <button
              key={z.id}
              type="button"
              className={`astryx-btn ${selectedZone === z.id ? "astryx-btn--primary" : "astryx-btn--secondary"}`}
              onClick={() => setSelectedZone(z.id as typeof selectedZone)}
            >
              {isAr ? z.label_ar : z.label_en}
            </button>
          ))}
        </div>

        <div className="astryx-card astryx-map-card">
          {/* Active Governorate Inspector Bar */}
          <div className="astryx-map-inspector">
            <div className="astryx-inspector-info">
              <div className="astryx-inspector-badge">
                <span className="astryx-dot-pulse" />
                <span className="astryx-inspector-name">
                  {isAr ? activeGov.name_ar : activeGov.name_en}
                </span>
              </div>
              <div className="astryx-inspector-metrics">
                <span className="astryx-metric-pill">
                  <strong>{t("landing.metric_soil", "Soil:")}</strong> {isAr ? activeGov.soil_ar : activeGov.soil_en}
                </span>
                <span className="astryx-metric-pill">
                  <strong>{t("landing.metric_et0", "Ref ET0:")}</strong> {activeGov.et0}
                </span>
                <span className="astryx-metric-pill">
                  <strong>{t("landing.metric_coords", "Coordinates:")}</strong> {activeGov.lat.toFixed(2)}°N, {activeGov.lon.toFixed(2)}°E
                </span>
              </div>
            </div>

            <div className="astryx-inspector-actions">
              <button
                type="button"
                className="astryx-btn astryx-btn--primary"
                onClick={handleLaunch}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>{t("landing.launch_for_gov", "Launch Simulation")}</span>
              </button>
              <button
                type="button"
                className="astryx-btn astryx-btn--secondary"
                onClick={handleCustomize}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <span>{t("landing.customize_field", "Edit in Field Form")}</span>
              </button>
            </div>
          </div>

          {/* Interactive Relief Map Canvas (Strict LTR direction to prevent horizontal geographic inversion) */}
          <div className="astryx-map-frame" dir="ltr">
            <div className="astryx-map-aspect">
              <img
                src="/Unlabeled Relief Map of Egypt.png"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.endsWith("egypt_map.png")) {
                    target.src = "/egypt_map.png";
                  }
                }}
                alt="Agroclimatology Relief Map of Egypt"
                className="astryx-map-img"
              />

              {/* Pins Layer */}
              <div className="astryx-pins-overlay" role="region" aria-label="Governorates Pins">
                {filtered.map((gov) => {
                  const isActive = gov.id === activeGovId;
                  const govName = isAr ? gov.name_ar : gov.name_en;

                  let alignClass = "astryx-pin-label--right";
                  if (gov.align === "left") alignClass = "astryx-pin-label--left";
                  if (gov.align === "top") alignClass = "astryx-pin-label--top";
                  if (gov.align === "bottom") alignClass = "astryx-pin-label--bottom";

                  return (
                    <div
                      key={gov.id}
                      className={`astryx-gov-pin ${isActive ? "astryx-gov-pin--active" : ""}`}
                      style={{ left: `${gov.x}%`, top: `${gov.y}%` }}
                      onClick={() => setActiveGovId(gov.id)}
                      onMouseEnter={() => setActiveGovId(gov.id)}
                      role="button"
                      tabIndex={0}
                      aria-label={govName}
                      title={govName}
                    >
                      <div className="astryx-pin-marker">
                        <div className="astryx-pin-ring" />
                        <div className="astryx-pin-core" />
                      </div>
                      <span className={`astryx-pin-label ${alignClass}`} dir={isAr ? "rtl" : "ltr"}>
                        {govName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Governorates Tag Grid */}
          <div className="astryx-map-tags-section">
            <div className="astryx-tags-header">
              <h4 className="astryx-tags-title">
                {t("landing.calibrated_zones_title", "Calibrated Agroclimatology Nodes")}
              </h4>
              <span className="astryx-tags-count">
                {filtered.length} {t("landing.govs_unit", "Governorates")}
              </span>
            </div>
            <div className="astryx-tags-grid">
              {filtered.map((gov) => {
                const isActive = gov.id === activeGovId;
                const govName = isAr ? gov.name_ar : gov.name_en;
                return (
                  <button
                    key={gov.id}
                    type="button"
                    className={`astryx-gov-tag ${isActive ? "astryx-gov-tag--active" : ""}`}
                    onClick={() => setActiveGovId(gov.id)}
                  >
                    <span className={`astryx-tag-dot ${isActive ? "astryx-tag-dot--active" : ""}`} />
                    <span>{govName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
