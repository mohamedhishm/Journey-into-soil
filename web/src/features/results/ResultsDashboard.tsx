import { useState } from "react";
import { useTranslation } from "react-i18next";
import { fmt } from "../../lib/msg";
import type { AnalysisResult, Strategy } from "../../scene/types";
import { useStore } from "../../state/store";
import { SoilScene } from "../../scene/SoilScene";
import { StrategyCards } from "./StrategyCards";
import { Timeline } from "./Timeline";
import { EvidencePanel } from "./EvidencePanel";
import { LayerTable, Flags, ClimateSlider, NasaPanel, Glossary } from "./Panels";
import { NasaVsModelPanel, NdviTimelinePanel } from "./NasaEvidence";
import "./ResultsDashboard.css";

interface ResultsDashboardProps {
  result: AnalysisResult;
  strategy: Strategy;
  onEdit: () => void;
}

export function ResultsDashboard({ result, strategy, onEdit }: ResultsDashboardProps) {
  const { t } = useTranslation();
  const { lang, usingSample, loading, setPdfModalOpen, setAssistantOpen } = useStore();
  const [activeTab, setActiveTab] = useState<"root_zone" | "nasa_grounding" | "climate_ai">("root_zone");
  const [copied, setCopied] = useState(false);
  const [scenarioQuery, setScenarioQuery] = useState("");

  const copyLink = async () => {
    const id = result.request_id || "sample";
    const url = `${window.location.origin}/a/${id}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        throw new Error("Clipboard API unavailable");
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("ui.copy_link_prompt"), url);
    }
  };

  // KPI calculations
  const successionCrops = strategy.seasons
    .map((s) => (s.crop ? t(`crop.${s.crop}`) : t("ui.fallow")))
    .join(" → ");

  // Margin estimate
  const estimatedMargin = Math.round(strategy.scores.income * 28000 + 12000);
  const baselineStrategy = result.strategies.find((s) => s.id === "existing");
  const baselineIncome = baselineStrategy?.scores.income ?? 0.5;
  const incomeDiffPct = Math.round((strategy.scores.income - baselineIncome) * 100);

  // Water calculations
  const waterMm = strategy.indicators.irrigation_mm;
  const waterM3PerFeddan = Math.round(waterMm * 4.2);

  // Salinity & Stress
  const topsoilEce = strategy.sim?.ece?.[0]?.[strategy.sim.ece[0].length - 1] ?? 1.8;
  const isSoilResilient = strategy.scores.soil_health >= 0.7;

  return (
    <div className="results-dashboard">
      {/* 1. EXECUTIVE ACTION & FARM SPEC BAR */}
      <section className="results-action-bar" aria-label="Analysis Metadata and Actions">
        <div className="action-bar-left">
          <div className="farm-spec-badge">
            <span className="spec-dot" />
            <span>
              {result.field.region || t("ui.nile_delta", "Nile Delta")} · {result.field.area_feddan ?? 1} {t("ui.feddans", "feddans")}
            </span>
          </div>

          <div className="farm-meta-pill">
            <span>
              {t("ui.texture", "Texture")}: {result.layers[0]?.name_key ? t(result.layers[0].name_key) : t("ui.sandy_clay_loam", "Sandy Clay Loam")}
            </span>
            {" · "}
            <span>
              {result.input?.irrigation
                ? t(`ui.irrigation_${result.input.irrigation}`, result.input.irrigation)
                : t("ui.irrigation_drip", "Drip")}
            </span>
          </div>

          {usingSample && (
            <span className="badge warn" style={{ fontSize: "11px", padding: "3px 8px" }}>
              {t("ui.sample_badge")}
            </span>
          )}
          {loading && (
            <span className="badge" style={{ fontSize: "11px", padding: "3px 8px" }}>
              {t("ui.analyzing")}
            </span>
          )}
        </div>

        <div className="action-bar-right">
          <button type="button" className="action-btn" onClick={onEdit} title={t("ui.edit")}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
            <span>{t("ui.edit")}</span>
          </button>

          <button type="button" className="action-btn" onClick={() => void copyLink()} title={t("ui.copy_link")}>
            {copied ? (
              <>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ color: "#10b981" }}>{t("ui.link_copied")}</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span>{t("ui.copy_link")}</span>
              </>
            )}
          </button>

          <button type="button" className="action-btn primary" onClick={() => setPdfModalOpen(true)} title={t("landing.btn_print_pdf", "Export PDF Report")}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span>{t("landing.btn_print_pdf", "Export PDF Report")}</span>
          </button>
        </div>
      </section>

      {/* 2. EXECUTIVE KPI BENTO ROW */}
      <section className="results-kpi-grid" aria-label="Key Performance Indicators">
        {/* KPI 1: Succession */}
        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">{t("ui.kpi_succession", "Recommended Succession")}</span>
            <div className="kpi-icon-wrap matcha" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 20h10" />
                <path d="M10 20c5.5-2.5.8-6.4 3-10" />
                <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
                <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.4 1.7-4.6-2.7.1-4.2.9-4.9 2z" />
              </svg>
            </div>
          </div>
          <h4 className="kpi-card-val" style={{ fontSize: "1.15rem" }}>
            {successionCrops || t("ui.optimized_rotation", "Optimized Rotation")}
          </h4>
          <p className="kpi-card-sub">
            {Math.round(strategy.scores.total * 100)}% {t("ui.suitability", "Suitability")} ({t(`ui.level_${strategy.confidence.level}`)} {t("ui.confidence_short", "confidence")})
          </p>
        </div>

        {/* KPI 2: Margin */}
        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">{t("ui.kpi_margin", "Estimated Net Margin")}</span>
            <div className="kpi-icon-wrap emerald" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
          </div>
          <h4 className="kpi-card-val">
            {fmt(lang, estimatedMargin)} <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>EGP/feddan</span>
          </h4>
          <p className="kpi-card-sub">
            <span style={{ color: incomeDiffPct >= 0 ? "#10b981" : "#ef4444", fontWeight: 700 }}>
              {incomeDiffPct >= 0 ? `+${incomeDiffPct}%` : `${incomeDiffPct}%`}
            </span>{" "}
            {t("ui.vs_baseline", "vs baseline rotation")}
          </p>
        </div>

        {/* KPI 3: Water Demand */}
        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">{t("ui.kpi_water_demand", "Seasonal Water Demand")}</span>
            <div className="kpi-icon-wrap sky" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
            </div>
          </div>
          <h4 className="kpi-card-val">
            {fmt(lang, waterMm)} <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>mm</span>{" "}
            <span style={{ fontSize: "0.82rem", color: "var(--astryx-color-text-secondary, #4a544e)", fontWeight: 500 }}>
              ({fmt(lang, waterM3PerFeddan)} m³/fed)
            </span>
          </h4>
          <p className="kpi-card-sub">
            ETc {fmt(lang, strategy.indicators.et_mm)} mm · {strategy.indicators.bare_days} {t("ui.bare_days", "bare days")}
          </p>
        </div>

        {/* KPI 4: Salt & Health */}
        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">{t("ui.kpi_stress_index", "Root-Zone Salinity & Health")}</span>
            <div className="kpi-icon-wrap amber" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
          </div>
          <h4 className="kpi-card-val">
            ECe {topsoilEce.toFixed(1)} <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>dS/m</span>
          </h4>
          <p className="kpi-card-sub">
            {isSoilResilient ? (
              <span style={{ color: "#10b981", fontWeight: 700 }}>{t("ui.resilient_core", "Resilient soil core")}</span>
            ) : (
              <span style={{ color: "#d97706", fontWeight: 700 }}>{t("ui.leaching_required", "Active salinity management required")}</span>
            )}
          </p>
        </div>
      </section>

      {/* 3. 3D SOIL STUDIO CENTERPIECE */}
      <section className="studio-centerpiece" aria-label="3D Interactive Soil Studio">
        <StrategyCards result={result} />
        <SoilScene />
        <Timeline result={result} strategy={strategy} />
      </section>

      {/* 4. ANALYTICAL INTELLIGENCE HUB (TABBED BENTO) */}
      <section className="analytics-hub" aria-label="Analytical Intelligence Hub">
        <div className="analytics-tab-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "root_zone"}
            className={`analytics-tab-btn ${activeTab === "root_zone" ? "active" : ""}`}
            onClick={() => setActiveTab("root_zone")}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <span>{t("ui.tab_rootzone", "Root-Zone & Soil Horizons")}</span>
            <span className="tab-badge">{result.layers.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "nasa_grounding"}
            className={`analytics-tab-btn ${activeTab === "nasa_grounding" ? "active" : ""}`}
            onClick={() => setActiveTab("nasa_grounding")}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M13 7 9 3 5 7l4 4" />
              <path d="m17 11 4 4-4 4-4-4" />
              <path d="m8 12 4 4 6-6-4-4Z" />
              <path d="m16 8 3-3" />
              <path d="M9 21a6 6 0 0 0-6-6" />
            </svg>
            <span>{t("ui.tab_satellite", "NASA Satellite Validation")}</span>
            <span className="tab-badge">SMAP & MODIS</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "climate_ai"}
            className={`analytics-tab-btn ${activeTab === "climate_ai" ? "active" : ""}`}
            onClick={() => setActiveTab("climate_ai")}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>{t("ui.tab_climate_ai", "Climate Stress & AI Agronomist")}</span>
            <span className="tab-badge">AI Active</span>
          </button>
        </div>

        {/* Tab 1: Root-Zone Hydrology & Horizons */}
        {activeTab === "root_zone" && (
          <div className="analytics-pane" role="tabpanel">
            <div className="analytics-grid-two-col">
              <EvidencePanel result={result} strategy={strategy} />
              <LayerTable result={result} />
            </div>
          </div>
        )}

        {/* Tab 2: NASA Satellite Validation */}
        {activeTab === "nasa_grounding" && (
          <div className="analytics-pane" role="tabpanel">
            <NasaVsModelPanel result={result} strategy={strategy} />
            <NdviTimelinePanel result={result} />
            <NasaPanel result={result} />
          </div>
        )}

        {/* Tab 3: Climate Stress & AI Agronomist */}
        {activeTab === "climate_ai" && (
          <div className="analytics-pane" role="tabpanel">
            <Flags result={result} />
            <ClimateSlider result={result} />

            {/* AI Agronomist Scenario Gateway Card */}
            <div className="scenario-ai-card">
              <div className="scenario-ai-header">
                <div className="scenario-ai-icon-wrap" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="scenario-ai-text">
                  <h4>{t("ui.agent_scenario_title", "Ask AI Agronomist About This Scenario")}</h4>
                  <p>{t("ui.agent_scenario_desc", "Questions entered here port directly into the AI chatbot, grounded in your field's soil, NASA telemetry, and crop rotation.")}</p>
                </div>
              </div>

              <div className="scenario-ai-input-row">
                <input
                  type="text"
                  className="scenario-ai-input"
                  placeholder={t("ui.agent_placeholder", "e.g. Why was strategy 1 recommended for this farm?")}
                  value={scenarioQuery}
                  onChange={(e) => setScenarioQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && scenarioQuery.trim()) {
                      setAssistantOpen(true, scenarioQuery.trim());
                      setScenarioQuery("");
                    }
                  }}
                  dir={lang === "ar" ? "rtl" : "ltr"}
                />
                <button
                  type="button"
                  className="action-btn primary"
                  onClick={() => {
                    setAssistantOpen(true, scenarioQuery.trim() || undefined);
                    setScenarioQuery("");
                  }}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>{t("ui.ask_in_chatbot", "Ask in Chatbot")}</span>
                </button>
              </div>

              <div className="scenario-ai-chips-row" aria-label="Suggested scenario questions">
                {[
                  { en: "Why is this rotation recommended?", ar: "لماذا تم ترشيح هذه الدورة الزراعية؟" },
                  { en: "How to reduce seasonal water demand?", ar: "كيف أخفض الاحتياج المائي الموسمي؟" },
                  { en: "Is salt accumulating in root zone?", ar: "هل تتراكم الأملاح في منطقة الجذور؟" },
                  { en: "What is my recommended leaching fraction?", ar: "ما هي نسبة غسيل الأملاح الموصى بها؟" },
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="scenario-ai-chip"
                    onClick={() => setAssistantOpen(true, lang === "ar" ? chip.ar : chip.en)}
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>{lang === "ar" ? chip.ar : chip.en}</span>
                  </button>
                ))}
              </div>
            </div>

            <Glossary />
          </div>
        )}
      </section>
    </div>
  );
}
