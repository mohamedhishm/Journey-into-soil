import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "../state/store";
import { SceneController } from "./SceneController";
import { WeatherAtmosphereHUD } from "../features/results/WeatherAtmosphereHUD";
import { THM, LAYER_NAMES, LAYER_DEPTHS, LAYER_COLORS, ALT } from "./textures";
import type { CameraPreset, DiveStage, LayerInspectData, SceneTelemetry } from "./types";
import "./SoilScene.css";

export function SoilScene() {
  const { t, i18n } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctrl = useRef<SceneController | null>(null);
  const prevKey = useRef<string>("");

  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [activePreset, setActivePreset] = useState<CameraPreset>("perspective");
  const [diveStage, setDiveStage] = useState<DiveStage>("field");
  const [diveCaptionKey, setDiveCaptionKey] = useState<string | null>("ui.dive_caption_field");
  const [canSkipDive, setCanSkipDive] = useState<boolean>(true);
  const [isExploded, setIsExploded] = useState(false);
  const [inspectedLayer, setInspectedLayer] = useState<LayerInspectData | null>(null);
  const [telemetry, setTelemetry] = useState<SceneTelemetry | null>(null);
  const [weatherHudOpen, setWeatherHudOpen] = useState(false);

  const isRtl = i18n.dir() === "rtl";

  const { result, strategyId, dayT, theme, quality, focusedLayer, setFocusedLayer, weatherMode } = useStore();

  useEffect(() => {
    if (!canvasRef.current) return;
    let disposed = false;

    try {
      const controller = new SceneController(canvasRef.current);
      controller.setOnInspect((data) => setInspectedLayer(data));
      controller.setOnTelemetry((data) => setTelemetry(data));
      controller.setOnStageChange((stage) => {
        setDiveStage(stage);
        setIsExploded(stage === "layers");
      });
      controller.setOnLayerFocusChange((idx) => {
        setFocusedLayer(idx);
      });
      controller.setOnDiveProgress((key, canSkip) => {
        setDiveCaptionKey(key);
        setCanSkipDive(canSkip);
      });

      ctrl.current = controller;
      setReady(true);
    } catch {
      if (!disposed) setFailed(true);
    }

    return () => {
      disposed = true;
      ctrl.current?.dispose();
      ctrl.current = null;
      prevKey.current = "";
      setReady(false);
    };
  }, [setFocusedLayer]);

  useEffect(() => {
    if (!result || !ctrl.current || !ready) return;
    const key = `${result.field.lat},${result.field.lon},${JSON.stringify(result.input.history)}`;
    ctrl.current.loadResult(result, key !== prevKey.current);
    prevKey.current = key;
  }, [result, ready]);

  useEffect(() => ctrl.current?.setStrategy(strategyId), [strategyId, result, ready]);
  useEffect(() => ctrl.current?.setSeasonTime(dayT), [dayT, result, strategyId, ready]);
  useEffect(() => ctrl.current?.setTheme(theme), [theme, ready]);
  useEffect(() => ctrl.current?.setQuality(quality), [quality, ready]);
  useEffect(() => {
    if (!ctrl.current || !ready) return;
    ctrl.current.setWeather(weatherMode, result?.nasa_evidence?.meteomatics);
  }, [weatherMode, ready, result]);

  useEffect(() => {
    if (!ctrl.current || !ready) return;
    if (ctrl.current.getFocusedLayer() !== focusedLayer) {
      ctrl.current.focusLayer(focusedLayer);
    }
  }, [focusedLayer, ready]);

  const handlePreset = (preset: CameraPreset) => {
    ctrl.current?.clearDiveTimeouts();
    setDiveCaptionKey(null);
    setCanSkipDive(false);
    setActivePreset(preset);
    ctrl.current?.setCameraPreset(preset);
    if (preset === "perspective") {
      setDiveStage("layers");
      setIsExploded(true);
    } else if (preset === "cutaway") {
      setDiveStage("underground");
      setIsExploded(false);
    } else if (preset === "canopy") {
      setDiveStage("field");
      setIsExploded(false);
    }
  };

  const handleStageSelect = (stage: DiveStage) => {
    ctrl.current?.clearDiveTimeouts();
    setDiveCaptionKey(null);
    setCanSkipDive(false);
    setDiveStage(stage);
    setIsExploded(stage === "layers");
    ctrl.current?.setDiveStage(stage);
  };

  const handleExplode = () => {
    ctrl.current?.clearDiveTimeouts();
    setDiveCaptionKey(null);
    setCanSkipDive(false);
    const next = !isExploded;
    setIsExploded(next);
    ctrl.current?.setExploded(next);
    setDiveStage(next ? "layers" : "underground");
  };

  const handleSkipDive = () => {
    ctrl.current?.skipDive();
    setDiveCaptionKey(null);
    setCanSkipDive(false);
  };

  const handleReplay = () => {
    setFocusedLayer(null);
    ctrl.current?.clearFocus();
    setActivePreset("perspective");
    ctrl.current?.replay();
  };

  const handleSelectLayer = (idx: number) => {
    if (focusedLayer === idx) {
      setFocusedLayer(null);
      ctrl.current?.clearFocus();
    } else {
      setFocusedLayer(idx);
      ctrl.current?.focusLayer(idx);
      setWeatherHudOpen(false); // Close weather drawer to avoid distraction
    }
  };

  // Extract layer data from result or fallbacks
  const layers = [0, 1, 2, 3].map((i) => {
    const l = result?.layers?.[i];
    return {
      index: i,
      name: LAYER_NAMES[i],
      depth: LAYER_DEPTHS[i],
      color: LAYER_COLORS[i],
      alt: ALT[i],
      sand: l ? Math.round(l.sand) : [40, 30, 20, 80][i],
      silt: l ? Math.round(l.silt) : [40, 35, 25, 12][i],
      clay: l ? Math.round(l.clay) : [20, 35, 55, 8][i],
      om: l ? Number(l.om.toFixed(1)) : [3.0, 1.4, 0.6, 0.2][i],
      moist: l ? Math.round(l.fc * 100) : [24, 28, 32, 14][i],
      ph: l ? Number(l.ph.toFixed(1)) : [7.6, 7.8, 8.0, 8.2][i],
      ec: l ? Number(l.ec.toFixed(1)) : [1.4, 1.8, 2.4, 3.1][i],
    };
  });

  const selectedLayerData = focusedLayer !== null ? layers[focusedLayer] : null;

  return (
    <div className="scene-container" data-stage={diveStage} data-theme={theme} dir={isRtl ? "rtl" : "ltr"}>
      {/* Horizon Sky Backdrop */}
      <div
        className="scene-bg-gradient"
        style={{
          opacity: diveStage === "field" ? 1 : 0,
        }}
        aria-hidden="true"
      />

      <canvas ref={canvasRef} role="img" aria-label={t("ui.scene_label")} />
      {failed && <p className="scene-fallback">{t("ui.no_webgl")}</p>}

      {ready && (
        <div className="scene-overlay">
          {/* Top Bar: Unified Minimal Pill Clustered Toolbar */}
          <div className="scene-top-bar">
            {/* Left Cluster: Live Sensor & Telemetry Pill */}
            {telemetry && (
              <div className="scene-telemetry-pill scene-glass" role="region" aria-label={t("ui.data")}>
                <button
                  type="button"
                  className="telemetry-chip crop interactive"
                  onClick={() => {
                    const current = ctrl.current?.getCropOverride() || telemetry.cropId;
                    const next = current === "maize" ? "wheat" : "maize";
                    ctrl.current?.setCropOverride(next);
                  }}
                  title={t("ui.crop_toggle", "Switch crop preview (Wheat / Maize)")}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M7 20h10" />
                    <path d="M10 20c5.5-2.5.8-6.4 3-10" />
                    <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
                  </svg>
                  <span>{telemetry.cropId ? t(`crop.${telemetry.cropId}`, telemetry.cropId) : t("ui.scene_telemetry_fallow")}</span>
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="crop-toggle-icon" aria-hidden="true">
                    <polyline points="7 10 12 15 17 10" />
                  </svg>
                </button>

                <span className="telemetry-divider" aria-hidden="true">·</span>

                <span className="telemetry-chip date">
                  <bdi dir="ltr">{telemetry.date || "2026"}</bdi>
                </span>

                <span className="telemetry-divider" aria-hidden="true">·</span>

                <span className="telemetry-chip metrics">
                  <bdi dir="ltr">{telemetry.tempC}°C</bdi>
                  {" · "}
                  <bdi dir="ltr">{t("ui.et0_val", { val: telemetry.et0Mm })}</bdi>
                </span>

                <button
                  type="button"
                  className={`telemetry-expand-btn ${weatherHudOpen ? "active" : ""}`}
                  onClick={() => {
                    setWeatherHudOpen((prev) => !prev);
                    if (!weatherHudOpen) setFocusedLayer(null); // Close layer card if opening weather
                  }}
                  title={t("ui.toggle_atmosphere", "Atmospheric Telemetry")}
                  aria-expanded={weatherHudOpen}
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                  </svg>
                  <span className="telemetry-btn-text">{t("ui.toggle_atmosphere", "Atmospheric Telemetry")}</span>
                  <svg
                    viewBox="0 0 24 24"
                    width="10"
                    height="10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`telemetry-chevron ${weatherHudOpen ? "rotated" : ""}`}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
            )}

            {/* Right Cluster: 3D Scene Controls Pill */}
            <div className="scene-toolbar scene-glass" role="toolbar" aria-label={t("ui.scene_label")}>
              <button
                type="button"
                className={`scene-btn ${activePreset === "perspective" ? "active" : ""}`}
                onClick={() => handlePreset("perspective")}
                aria-pressed={activePreset === "perspective"}
                title={t("ui.scene_view_3d")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
                <span>{t("ui.scene_view_3d")}</span>
              </button>

              <button
                type="button"
                className={`scene-btn ${activePreset === "cutaway" ? "active" : ""}`}
                onClick={() => handlePreset("cutaway")}
                aria-pressed={activePreset === "cutaway"}
                title={t("ui.scene_view_cutaway")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="3" y1="15" x2="21" y2="15" />
                </svg>
                <span>{t("ui.scene_view_cutaway")}</span>
              </button>

              <button
                type="button"
                className={`scene-btn ${isExploded ? "active" : ""}`}
                onClick={handleExplode}
                aria-pressed={isExploded}
                title={isExploded ? t("ui.scene_compact") : t("ui.scene_explode")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
                <span>{isExploded ? t("ui.scene_compact") : t("ui.scene_explode")}</span>
              </button>

              <button
                type="button"
                className="scene-btn"
                onClick={handleReplay}
                title={t("ui.replay")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M1 4v6h6" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                <span>{t("ui.replay")}</span>
              </button>
            </div>
          </div>

          {/* On-Demand Meteomatics Atmospheric Telemetry Drawer */}
          <WeatherAtmosphereHUD
            isOpen={weatherHudOpen}
            onClose={() => setWeatherHudOpen(false)}
            onWeatherChange={(mode) => ctrl.current?.setWeather(mode, result?.nasa_evidence?.meteomatics)}
          />

          {/* Act 1 Field Stage Hero Overlay */}
          {diveStage === "field" && (
            <div className="scene-field-hero scene-glass" role="region" aria-label={t("ui.stage_field")}>
              <div className="scene-field-hero-info">
                <span className="scene-field-chip">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="scene-icon" aria-hidden="true">
                    <path d="M12 2a9 9 0 0 1 9 9c0 4.97-4.03 9-9 9s-9-4.03-9-9a9 9 0 0 1 9-9z" />
                    <path d="M12 6v14" />
                    <path d="M8 10c2-2 4-2 4 0" />
                    <path d="M12 14c2-2 4-2 4 0" />
                  </svg>
                  <span>{result?.field.region || "Nile Delta"} · {result?.field.area_feddan ?? 1} Feddan</span>
                </span>
                <h2 className="scene-field-title">
                  {telemetry?.cropId ? t(`crop.${telemetry.cropId}`, telemetry.cropId) : t("crop.wheat", "Wheat")}
                </h2>
                <p className="scene-field-sub">
                  {t("ui.dive_caption_field")}
                </p>
              </div>

              <button
                type="button"
                className="scene-dive-cta"
                onClick={() => handleStageSelect("underground")}
                aria-label={t("ui.dive_into_soil")}
              >
                <span>{t("ui.dive_into_soil")}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="scene-dive-cta-arrow" aria-hidden="true">
                  <path d="M12 3v14" />
                  <path d="m7 12 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
              </button>
            </div>
          )}

          {/* On-Demand Horizon Selector Rail & Detail Inspector */}
          {diveStage !== "field" && (
            <div className="scene-horizon-container">
              {/* Vertical Layer Quick-Rail */}
              <nav className="scene-horizon-rail scene-glass" aria-label={t("ui.layers_title")}>
                {layers.map((l, i) => {
                  const isSelected = focusedLayer === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`horizon-rail-pill ${isSelected ? "active" : ""}`}
                      onClick={() => handleSelectLayer(i)}
                      aria-pressed={isSelected}
                      title={`${l.name} (${l.depth})`}
                    >
                      <span className="horizon-color-dot" style={{ backgroundColor: l.color }} />
                      <span className="horizon-pill-label">L{i + 1}</span>
                      <span className="horizon-pill-depth"><bdi dir="ltr">{l.depth}</bdi></span>
                    </button>
                  );
                })}
              </nav>

              {/* Single Focused Horizon Inspector Card */}
              {selectedLayerData && (
                <div className="scene-horizon-inspector scene-glass" role="dialog" aria-label={t("ui.horizon_inspector")}>
                  <div className="inspector-header">
                    <img className="inspector-thumb" src={THM[selectedLayerData.index]} alt={selectedLayerData.alt} />
                    <div className="inspector-title-wrap">
                      <div className="inspector-title">
                        <b>{selectedLayerData.index + 1}. {t(`ui.layer_${selectedLayerData.index}`, selectedLayerData.name)}</b>
                        <span className="inspector-depth"><bdi dir="ltr">{selectedLayerData.depth}</bdi></span>
                      </div>
                      {inspectedLayer && (
                        <span className={`inspector-status-pill scene-status-${inspectedLayer.moistureStatus}`}>
                          {t(`ui.scene_moisture_${inspectedLayer.moistureStatus}`)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="inspector-close-btn"
                      onClick={() => handleSelectLayer(selectedLayerData.index)}
                      aria-label={t("ui.close_inspector")}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>

                  <div className="inspector-body">
                    {/* Texture Donut & Percentages */}
                    <div className="inspector-texture-row">
                      <div
                        className="inspector-donut"
                        style={{
                          background: `conic-gradient(#e3cf9a 0 ${selectedLayerData.sand}%, #a89578 ${selectedLayerData.sand}% ${selectedLayerData.sand + selectedLayerData.silt}%, #9a5a3c ${selectedLayerData.sand + selectedLayerData.silt}% 100%)`,
                        }}
                        aria-hidden="true"
                      />
                      <div className="inspector-texture-props">
                        <div className="inspector-prop">
                          <span><i style={{ color: "#e3cf9a" }}>●</i> {t("ui.texture_sand")}</span>
                          <b><bdi dir="ltr">{selectedLayerData.sand}%</bdi></b>
                        </div>
                        <div className="inspector-prop">
                          <span><i style={{ color: "#a89578" }}>●</i> {t("ui.texture_silt")}</span>
                          <b><bdi dir="ltr">{selectedLayerData.silt}%</bdi></b>
                        </div>
                        <div className="inspector-prop">
                          <span><i style={{ color: "#9a5a3c" }}>●</i> {t("ui.texture_clay")}</span>
                          <b><bdi dir="ltr">{selectedLayerData.clay}%</bdi></b>
                        </div>
                      </div>
                    </div>

                    {/* Agronomic Chemistry Matrix */}
                    <div className="inspector-matrix">
                      <div className="matrix-cell">
                        <span className="matrix-label">{t("ui.om_label", "OM")}</span>
                        <b className="matrix-val"><bdi dir="ltr">{selectedLayerData.om}%</bdi></b>
                      </div>
                      <div className="matrix-cell">
                        <span className="matrix-label">{t("ui.scene_available_water", "Water")}</span>
                        <b className="matrix-val"><bdi dir="ltr">{selectedLayerData.moist}%</bdi></b>
                      </div>
                      <div className="matrix-cell">
                        <span className="matrix-label">pH</span>
                        <b className="matrix-val"><bdi dir="ltr">{selectedLayerData.ph}</bdi></b>
                      </div>
                      <div className="matrix-cell">
                        <span className="matrix-label">ECe</span>
                        <b className="matrix-val"><bdi dir="ltr">{selectedLayerData.ec} dS/m</bdi></b>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom Bar: Narrative Dive Caption & 3-Stage Excavation Stepper */}
          <div className="scene-bottom-bar">
            {diveCaptionKey && (
              <div className="scene-dive-narrative scene-glass" role="status" aria-live="polite">
                <div className="scene-dive-text">
                  <svg className="scene-dive-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>{t(diveCaptionKey)}</span>
                </div>
                {canSkipDive && (
                  <button
                    type="button"
                    className="scene-dive-skip"
                    onClick={handleSkipDive}
                    title={t("ui.dive_skip")}
                    aria-label={t("ui.dive_skip")}
                  >
                    <span>{t("ui.dive_skip")}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polygon points="5 4 15 12 5 20 5 4" />
                      <line x1="19" y1="5" x2="19" y2="19" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            <nav className="scene-stages scene-glass" aria-label={t("ui.dive_into_soil")}>
              <button
                type="button"
                className={`scene-stage-btn ${diveStage === "field" ? "active" : ""}`}
                onClick={() => handleStageSelect("field")}
                aria-current={diveStage === "field" ? "step" : undefined}
                title={t("ui.stage_field")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 19V5" />
                  <path d="M5 19h14" />
                  <path d="M12 11c3 0 6-3 6-6-3 0-6 3-6 6z" />
                  <path d="M12 14c-3 0-6-3-6-6 3 0 6 3 6 6z" />
                </svg>
                <span>{t("ui.stage_field")}</span>
              </button>

              <svg className="scene-stage-sep" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>

              <button
                type="button"
                className={`scene-stage-btn ${diveStage === "underground" ? "active" : ""}`}
                onClick={() => handleStageSelect("underground")}
                aria-current={diveStage === "underground" ? "step" : undefined}
                title={t("ui.stage_underground")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v14" />
                  <path d="m7 12 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
                <span>{t("ui.stage_underground")}</span>
              </button>

              <svg className="scene-stage-sep" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>

              <button
                type="button"
                className={`scene-stage-btn ${diveStage === "layers" ? "active" : ""}`}
                onClick={() => handleStageSelect("layers")}
                aria-current={diveStage === "layers" ? "step" : undefined}
                title={t("ui.stage_layers")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5M12 2L2 7l10 5 10-5L12 2z" />
                </svg>
                <span>{t("ui.stage_layers")}</span>
              </button>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
