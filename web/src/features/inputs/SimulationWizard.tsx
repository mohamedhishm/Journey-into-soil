import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { useStore } from "../../state/store";
import type { AnalysisRequest, DemoSite, Priority, Season } from "../../scene/types";
import { FieldMap } from "../map/FieldMap";
import engineEn from "../../i18n/engine.en.json";
import "./SimulationWizard.css";

const CROP_IDS = Object.keys(engineEn)
  .filter((k) => k.startsWith("crop.") && k !== "crop.sugarcane")
  .map((k) => k.slice(5));

const PREV_SEASON: Record<Season, Season> = {
  winter: "summer",
  summer: "winter",
  nili: "summer",
};

export function historySeasons(next: Season): Season[] {
  const out: Season[] = [];
  let s: Season = next;
  for (let i = 0; i < 3; i++) {
    s = PREV_SEASON[s];
    out.push(s);
  }
  return out;
}

const POPULAR_CROPS = [
  "wheat",
  "maize",
  "berseem",
  "tomato",
  "sugar_beet",
  "faba_bean",
  "potato",
  "cotton",
  "rice",
];

const TEXTURE_OPTIONS: { id: AnalysisRequest["texture"]; key: string; sand: number; clay: number }[] = [
  { id: "sand", key: "texture.sand", sand: 90, clay: 5 },
  { id: "sandy_loam", key: "texture.sandy_loam", sand: 65, clay: 10 },
  { id: "loam", key: "texture.loam", sand: 40, clay: 20 },
  { id: "silt_loam", key: "texture.silt_loam", sand: 20, clay: 15 },
  { id: "clay_loam", key: "texture.clay_loam", sand: 30, clay: 35 },
  { id: "clay", key: "texture.clay", sand: 15, clay: 50 },
];

const IRRIGATION_OPTIONS: { id: AnalysisRequest["irrigation"]; eff: string; icon: string }[] = [
  { id: "flood", eff: "55%", icon: "basin" },
  { id: "sprinkler", eff: "75%", icon: "spray" },
  { id: "drip", eff: "90%", icon: "drip" },
];

export function SimulationWizard({ onComplete }: { onComplete?: () => void }) {
  const { t, i18n } = useTranslation();
  const {
    request: r,
    setRequest,
    analyze,
    loadSample,
    openDemoSite,
    applySite,
    loading,
    error,
  } = useStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [pickerMode, setPickerMode] = useState<"demo" | "custom">("demo");
  const [sites, setSites] = useState<DemoSite[]>([]);
  const [showLabData, setShowLabData] = useState(false);

  const isRtl = i18n.dir() === "rtl";

  React.useEffect(() => {
    api.demoSites().then(setSites).catch(() => setSites([]));
  }, []);

  const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));

  const setNext = (next: Season) => {
    const seasons = historySeasons(next);
    setRequest({
      next_season: next,
      history: r.history.map((h, i) => ({ ...h, season: seasons[i] ?? h.season })),
    });
  };

  const setHistory = (i: number, crop: string) => {
    setRequest({
      history: r.history.map((h, k) => (k === i ? { ...h, crop } : h)),
    });
  };

  const seasons = historySeasons(r.next_season);
  const hist = [0, 1, 2].map((i) => r.history[i] ?? { crop: "wheat", season: seasons[i] });

  // Priority total for percentage calculation
  const pTotal =
    (r.priorities.water || 0) +
    (r.priorities.soil_health || 0) +
    (r.priorities.income || 0) +
    (r.priorities.risk || 0) || 1;

  const handleLaunch = async () => {
    await analyze();
    onComplete?.();
  };

  return (
    <div className="sim-wizard-card scene-glass" dir={isRtl ? "rtl" : "ltr"}>
      {/* 4-Step Visual Stepper Bar */}
      <nav className="sim-stepper" aria-label={t("ui.wizard_progress", "Simulation Wizard Progress")}>
        {[
          {
            num: 1,
            title: t("ui.wizard_step_1"),
            sub: t("ui.wizard_step_1_sub"),
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="stepper-svg" aria-hidden="true">
                <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            ),
          },
          {
            num: 2,
            title: t("ui.wizard_step_2"),
            sub: t("ui.wizard_step_2_sub"),
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="stepper-svg" aria-hidden="true">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            ),
          },
          {
            num: 3,
            title: t("ui.wizard_step_3"),
            sub: t("ui.wizard_step_3_sub"),
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="stepper-svg" aria-hidden="true">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                <path d="M6 18h12" />
              </svg>
            ),
          },
          {
            num: 4,
            title: t("ui.wizard_step_4"),
            sub: t("ui.wizard_step_4_sub"),
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="stepper-svg" aria-hidden="true">
                <path d="M12 2v20" />
                <path d="M8 8c2-2 4-2 4 0" />
                <path d="M12 12c2-2 4-2 4 0" />
                <path d="M8 16c2-2 4-2 4 0" />
              </svg>
            ),
          },
        ].map((s) => {
          const isActive = step === s.num;
          const isDone = step > s.num;
          return (
            <button
              key={s.num}
              type="button"
              className={`stepper-node ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
              onClick={() => setStep(s.num as 1 | 2 | 3 | 4)}
              aria-current={isActive ? "step" : undefined}
            >
              <div className="stepper-icon-wrap">
                {isDone ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="stepper-check" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  s.icon
                )}
              </div>
              <div className="stepper-text">
                <span className="stepper-title">
                  {s.num}. {s.title}
                </span>
                <span className="stepper-sub">{s.sub}</span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* STEP 1: Location & Microclimate */}
      {step === 1 && (
        <section className="sim-step-pane" aria-labelledby="step1-heading">
          <div className="sim-pane-header">
            <div>
              <h3 id="step1-heading" className="sim-pane-title">
                {t("ui.step_field")}
              </h3>
              <p className="sim-pane-desc">{t("ui.demo_sites_intro")}</p>
            </div>

            <div className="sim-mode-toggle" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={pickerMode === "demo"}
                className={`sim-tab-btn ${pickerMode === "demo" ? "active" : ""}`}
                onClick={() => setPickerMode("demo")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-inline-svg" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                <span>{t("ui.demo_sites")}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={pickerMode === "custom"}
                className={`sim-tab-btn ${pickerMode === "custom" ? "active" : ""}`}
                onClick={() => setPickerMode("custom")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-inline-svg" aria-hidden="true">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
                <span>{t("ui.click_own_field")}</span>
              </button>
            </div>
          </div>

          {pickerMode === "demo" ? (
            <div className="sim-demo-grid">
              {sites.map((s) => {
                const isSelected = Math.abs(r.lat - s.lat) < 0.05 && Math.abs(r.lon - s.lon) < 0.05;
                return (
                  <div key={s.id} className={`sim-bento-card ${isSelected ? "selected" : ""}`}>
                    <div className="bento-card-top">
                      <div className="bento-badge">{t(`ui.region.${s.region}`)}</div>
                      <span className="bento-coords">
                        {s.lat.toFixed(2)}°N, {s.lon.toFixed(2)}°E
                      </span>
                    </div>

                    <h4 className="bento-card-title">{isRtl ? s.name_ar : s.name_en}</h4>

                    <div className="bento-card-params">
                      <span className="bento-pill">
                        {t(`texture.${s.preset.texture || "loam"}`)}
                      </span>
                      <span className="bento-pill">
                        {t(`ui.irrigation_${s.preset.irrigation || "flood"}`)}
                      </span>
                      <span className="bento-pill">EC {s.preset.water_ec ?? 1.0} dS/m</span>
                    </div>

                    <div className="bento-card-actions">
                      <button
                        type="button"
                        className="sim-card-btn select"
                        onClick={() => {
                          applySite(s);
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-inline-svg" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>{isSelected ? t("ui.selected", "Selected") : t("ui.select_site", "Select Profile")}</span>
                      </button>

                      <button
                        type="button"
                        className="sim-card-btn direct"
                        disabled={loading}
                        onClick={() => void openDemoSite(s)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-inline-svg" aria-hidden="true">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        <span>{t("ui.open_demo_result")}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="sim-custom-map-wrap">
              <FieldMap />
            </div>
          )}

          {/* Area & Regional Confirmation */}
          <div className="sim-field-row">
            <label className="sim-input-label">
              <span>{t("ui.area_feddan", "Farm Area (Feddan)")}</span>
              <div className="sim-input-stepper">
                <input
                  type="number"
                  min={0.5}
                  max={500}
                  step={0.5}
                  value={r.area_feddan ?? 5}
                  onChange={(e) => setRequest({ area_feddan: Number(e.target.value) })}
                  className="sim-input"
                />
                <span className="sim-input-unit">Feddan (فدان)</span>
              </div>
            </label>

            <div className="sim-meta-chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="meta-chip-svg" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <div>
                <b>{t("ui.coordinates", "Coordinates")}:</b> {r.lat.toFixed(4)}°N, {r.lon.toFixed(4)}°E
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP 2: Soil Profile & Horizons */}
      {step === 2 && (
        <section className="sim-step-pane" aria-labelledby="step2-heading">
          <div className="sim-pane-header">
            <div>
              <h3 id="step2-heading" className="sim-pane-title">
                {t("ui.sec_soil")}
              </h3>
              <p className="sim-pane-desc">{t("ui.texture_hint")}</p>
            </div>
          </div>

          {/* 6 Visual Texture Cards */}
          <div className="sim-texture-grid" role="radiogroup" aria-label={t("ui.texture")}>
            {TEXTURE_OPTIONS.map((tex) => {
              const isSelected = r.texture === tex.id;
              return (
                <button
                  key={tex.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`sim-texture-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setRequest({ texture: tex.id })}
                >
                  <div className="texture-card-head">
                    <span className="texture-name">{t(tex.key)}</span>
                    {isSelected && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="texture-check-svg" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>

                  <p className="texture-desc">{t(`ui.texture_${tex.id}_desc`)}</p>

                  <div className="texture-bar-wrap">
                    <div className="texture-bar sand" style={{ width: `${tex.sand}%` }} title={`Sand: ${tex.sand}%`} />
                    <div className="texture-bar clay" style={{ width: `${tex.clay}%` }} title={`Clay: ${tex.clay}%`} />
                  </div>
                  <span className="texture-sub">
                    {tex.sand}% Sand · {tex.clay}% Clay
                  </span>
                </button>
              );
            })}
          </div>

          {/* Drainage & Residues */}
          <div className="sim-selectors-grid">
            <div className="sim-selector-group">
              <span className="sim-selector-title">{t("ui.drainage")}</span>
              <div className="sim-chip-group" role="radiogroup">
                {(["good", "moderate", "poor"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={r.drainage === d}
                    className={`sim-pill-btn ${r.drainage === d ? "active" : ""}`}
                    onClick={() => setRequest({ drainage: d })}
                  >
                    {t(`ui.drainage_${d}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="sim-selector-group">
              <span className="sim-selector-title">{t("ui.organic_input")}</span>
              <div className="sim-chip-group" role="radiogroup">
                {(["none", "some", "regular"] as const).map((o) => (
                  <button
                    key={o}
                    type="button"
                    role="radio"
                    aria-checked={r.organic_input === o}
                    className={`sim-pill-btn ${r.organic_input === o ? "active" : ""}`}
                    onClick={() => setRequest({ organic_input: o })}
                  >
                    {t(`ui.organic_${o}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="sim-selector-group">
              <span className="sim-selector-title">{t("ui.residues")}</span>
              <div className="sim-chip-group" role="radiogroup">
                {(["retained", "burned", "unknown"] as const).map((res) => (
                  <button
                    key={res}
                    type="button"
                    role="radio"
                    aria-checked={r.residues === res}
                    className={`sim-pill-btn ${r.residues === res ? "active" : ""}`}
                    onClick={() => setRequest({ residues: res })}
                  >
                    {t(`ui.residues_${res}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Collapsible Lab Test Measurements */}
          <div className="sim-lab-accordion">
            <button
              type="button"
              className="sim-lab-toggle"
              onClick={() => setShowLabData(!showLabData)}
              aria-expanded={showLabData}
            >
              <div className="sim-lab-toggle-left">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="lab-svg" aria-hidden="true">
                  <path d="M10 2v7.31L4.62 18.2A2 2 0 0 0 6.33 21h11.34a2 2 0 0 0 1.71-2.8L14 9.31V2" />
                  <line x1="8.5" y1="2" x2="15.5" y2="2" />
                </svg>
                <div>
                  <span className="sim-lab-title">{t("ui.wizard_lab_data")}</span>
                  <span className="sim-lab-sub">{t("ui.wizard_lab_data_sub")}</span>
                </div>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`lab-arrow ${showLabData ? "open" : ""}`} aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showLabData && (
              <div className="sim-lab-inputs">
                <label className="sim-input-label">
                  <span>{t("ui.soil_ec")} (ECe dS/m)</span>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    step={0.1}
                    value={r.soil_ec ?? ""}
                    placeholder="e.g. 2.4"
                    onChange={(e) => setRequest({ soil_ec: num(e.target.value) })}
                    className="sim-input"
                  />
                  <small>{t("ui.optional_measured")}</small>
                </label>

                <label className="sim-input-label">
                  <span>{t("ui.ph")} (pH 4.0 - 10.0)</span>
                  <input
                    type="number"
                    min={4}
                    max={10}
                    step={0.1}
                    value={r.ph ?? ""}
                    placeholder="e.g. 7.9"
                    onChange={(e) => setRequest({ ph: num(e.target.value) })}
                    className="sim-input"
                  />
                  <small>{t("ui.optional_measured")}</small>
                </label>
              </div>
            )}
          </div>
        </section>
      )}

      {/* STEP 3: Water & Irrigation */}
      {step === 3 && (
        <section className="sim-step-pane" aria-labelledby="step3-heading">
          <div className="sim-pane-header">
            <div>
              <h3 id="step3-heading" className="sim-pane-title">
                {t("ui.sec_water")}
              </h3>
              <p className="sim-pane-desc">{t("ui.water_ec_hint")}</p>
            </div>
          </div>

          {/* 3 Irrigation Method Bento Cards */}
          <div className="sim-irrigation-grid" role="radiogroup" aria-label={t("ui.irrigation")}>
            {IRRIGATION_OPTIONS.map((opt) => {
              const isSelected = r.irrigation === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`sim-irrigation-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setRequest({ irrigation: opt.id })}
                >
                  <div className="irrigation-card-top">
                    <span className="irrigation-name">{t(`ui.irrigation_${opt.id}`)}</span>
                    <span className="irrigation-eff">{opt.eff} Eff.</span>
                  </div>

                  <p className="irrigation-desc">{t(`ui.irrigation_${opt.id}_desc`)}</p>

                  {isSelected && (
                    <div className="irrigation-badge-selected">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="btn-inline-svg" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{t("ui.active", "Active System")}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Water Salinity Slider with Bracket Guidance */}
          <div className="sim-salinity-box">
            <div className="salinity-box-header">
              <span className="salinity-box-title">{t("ui.water_ec")} (ECw)</span>
              <span className="salinity-box-val">{r.water_ec.toFixed(1)} dS/m</span>
            </div>

            <input
              type="range"
              min={0}
              max={12}
              step={0.1}
              value={r.water_ec}
              onChange={(e) => setRequest({ water_ec: Number(e.target.value) })}
              className="sim-slider"
            />

            <div className="salinity-bracket-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="bracket-svg" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>
                {r.water_ec < 1.2
                  ? t("ui.salinity_fresh")
                  : r.water_ec <= 3.0
                  ? t("ui.salinity_mixed")
                  : t("ui.salinity_saline")}
              </span>
            </div>
          </div>

          {/* Water Availability & Soil-borne Pest */}
          <div className="sim-selectors-grid">
            <div className="sim-selector-group">
              <span className="sim-selector-title">{t("ui.water_availability")}</span>
              <div className="sim-chip-group" role="radiogroup">
                {(["ample", "limited", "scarce"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    role="radio"
                    aria-checked={r.water_availability === w}
                    className={`sim-pill-btn ${r.water_availability === w ? "active" : ""}`}
                    onClick={() => setRequest({ water_availability: w })}
                  >
                    {t(`ui.water_${w}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="sim-selector-group">
              <span className="sim-selector-title">{t("ui.pest")}</span>
              <div className="sim-chip-group" role="radiogroup">
                {(["none", "nematodes", "soil_borne", "unknown"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={r.pest === p}
                    className={`sim-pill-btn ${r.pest === p ? "active" : ""}`}
                    onClick={() => setRequest({ pest: p })}
                  >
                    {t(`ui.pest_${p}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STEP 4: Crops, History & Farmer Priorities */}
      {step === 4 && (
        <section className="sim-step-pane" aria-labelledby="step4-heading">
          <div className="sim-pane-header">
            <div>
              <h3 id="step4-heading" className="sim-pane-title">
                {t("ui.wizard_step_4")}
              </h3>
              <p className="sim-pane-desc">{t("ui.wizard_step_4_sub")}</p>
            </div>
          </div>

          {/* Next Season Selector */}
          <div className="sim-season-box">
            <span className="sim-selector-title">{t("ui.next_season")}</span>
            <div className="sim-chip-group" role="radiogroup">
              {(["winter", "summer", "nili"] as Season[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={r.next_season === s}
                  className={`sim-season-btn ${r.next_season === s ? "active" : ""}`}
                  onClick={() => setNext(s)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="season-btn-svg" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>{t(`season.${s}`)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Crop Succession History Flow */}
          <div className="sim-history-flow">
            <span className="sim-selector-title">{t("ui.sec_history")}</span>
            <div className="sim-history-cards">
              {hist.map((h, i) => (
                <div key={i} className="sim-history-card">
                  <div className="history-card-head">
                    <span className="history-card-step">
                      {t(`ui.history_${i}`)}
                    </span>
                    <span className="history-card-season">
                      {t(`season.${seasons[i]}`)}
                    </span>
                  </div>

                  <select
                    value={h.crop}
                    onChange={(e) => setHistory(i, e.target.value)}
                    className="sim-select"
                  >
                    {CROP_IDS.map((id) => (
                      <option key={id} value={id}>
                        {t(`crop.${id}`)}
                      </option>
                    ))}
                  </select>

                  {/* Quick-Pick Popular Crops */}
                  <div className="history-quick-chips">
                    {POPULAR_CROPS.slice(0, 4).map((cid) => (
                      <button
                        key={cid}
                        type="button"
                        className={`history-quick-chip ${h.crop === cid ? "active" : ""}`}
                        onClick={() => setHistory(i, cid)}
                      >
                        {t(`crop.${cid}`)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Strategic Farmer Priorities */}
          <div className="sim-priorities-box">
            <div className="priorities-box-head">
              <span className="sim-selector-title">{t("ui.sec_priorities")}</span>
              <span className="priorities-balance-tag">{t("ui.prio_balance")}</span>
            </div>

            {/* Visual Balance Bar */}
            <div className="prio-balance-bar">
              <div
                className="prio-seg water"
                style={{ width: `${((r.priorities.water || 0) / pTotal) * 100}%` }}
                title={`${t("ui.prio_water")}: ${Math.round(((r.priorities.water || 0) / pTotal) * 100)}%`}
              />
              <div
                className="prio-seg soil"
                style={{ width: `${((r.priorities.soil_health || 0) / pTotal) * 100}%` }}
                title={`${t("ui.prio_soil_health")}: ${Math.round(((r.priorities.soil_health || 0) / pTotal) * 100)}%`}
              />
              <div
                className="prio-seg income"
                style={{ width: `${((r.priorities.income || 0) / pTotal) * 100}%` }}
                title={`${t("ui.prio_income")}: ${Math.round(((r.priorities.income || 0) / pTotal) * 100)}%`}
              />
              <div
                className="prio-seg risk"
                style={{ width: `${((r.priorities.risk || 0) / pTotal) * 100}%` }}
                title={`${t("ui.prio_risk")}: ${Math.round(((r.priorities.risk || 0) / pTotal) * 100)}%`}
              />
            </div>

            <div className="prio-sliders-grid">
              {(["water", "soil_health", "income", "risk"] as Priority[]).map((p) => {
                const val = r.priorities[p] || 0;
                return (
                  <div key={p} className="prio-slider-item">
                    <div className="prio-slider-header">
                      <span className="prio-slider-label">{t(`ui.prio_${p}`)}</span>
                      <span className="prio-slider-val">{val.toFixed(1)} / 5</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={5}
                      step={0.5}
                      value={val}
                      onChange={(e) =>
                        setRequest({
                          priorities: { ...r.priorities, [p]: Number(e.target.value) },
                        })
                      }
                      className={`sim-slider ${p}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* WIZARD NAVIGATION FOOTER */}
      <footer className="sim-wizard-footer">
        <div className="wizard-footer-left">
          {step > 1 && (
            <button
              type="button"
              className="wizard-nav-btn back"
              onClick={() => setStep((step - 1) as 1 | 2 | 3 | 4)}
              disabled={loading}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-nav-svg" aria-hidden="true">
                {isRtl ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
              </svg>
              <span>{t("ui.wizard_back")}</span>
            </button>
          )}

          <button
            type="button"
            className="wizard-sample-btn"
            disabled={loading}
            onClick={() => void loadSample()}
          >
            <span>{t("ui.sample")}</span>
          </button>
        </div>

        <div className="wizard-footer-center">
          <span className="wizard-step-indicator">
            {step} / 4
          </span>
        </div>

        <div className="wizard-footer-right">
          {step < 4 ? (
            <button
              type="button"
              className="wizard-nav-btn next"
              onClick={() => setStep((step + 1) as 1 | 2 | 3 | 4)}
            >
              <span>{t("ui.wizard_next")}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-nav-svg" aria-hidden="true">
                {isRtl ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
              </svg>
            </button>
          ) : (
            <button
              type="button"
              className="wizard-launch-btn"
              disabled={loading}
              onClick={handleLaunch}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="launch-svg" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="2" x2="12" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <circle cx="12" cy="12" r="4" />
              </svg>
              <span>{loading ? t("ui.analyzing") : t("ui.wizard_launch")}</span>
            </button>
          )}
        </div>
      </footer>

      {error && (
        <div className="sim-error-banner" role="alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="error-svg" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{t("ui.error")} {error}</span>
        </div>
      )}
    </div>
  );
}
