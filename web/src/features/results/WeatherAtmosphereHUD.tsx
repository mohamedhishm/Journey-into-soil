import React from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "../../state/store";
import type { WeatherMode } from "../../scene/types";
import "./WeatherAtmosphereHUD.css";

interface WeatherAtmosphereHUDProps {
  isOpen: boolean;
  onClose: () => void;
  onWeatherChange?: (mode: WeatherMode) => void;
}

export const WeatherAtmosphereHUD: React.FC<WeatherAtmosphereHUDProps> = ({
  isOpen,
  onClose,
  onWeatherChange,
}) => {
  const { t, i18n } = useTranslation();
  const { result, request, setRequest, analyze, weatherMode, setWeatherMode, loading } = useStore();

  if (!isOpen) return null;

  const mm = result?.nasa_evidence?.meteomatics;
  const params = mm?.parameters;
  const isLive = mm?.status === "live";
  const isRtl = i18n.dir() === "rtl";

  const handleModeSelect = (mode: WeatherMode) => {
    setWeatherMode(mode);
    onWeatherChange?.(mode);
  };

  const handleToggleLiveSim = async () => {
    const nextVal = !(request.use_live_weather ?? true);
    setRequest({ use_live_weather: nextVal });
    await analyze();
  };

  const smd = params?.soil_moisture_deficit_mm ?? 0;
  const isHighDeficit = smd > 50;

  return (
    <aside
      className="weather-hud-wrap"
      dir={isRtl ? "rtl" : "ltr"}
      aria-label={t("ui.weather_hud_title", "Atmospheric & Soil Live Telemetry")}
    >
      <div className="weather-hud-bar scene-glass">
        {/* Header / Beacon */}
        <div className="weather-hud-header">
          <div className="weather-hud-beacon">
            <span className={`weather-beacon-dot ${isLive ? "live" : "analog"}`} aria-hidden="true" />
            <span className="weather-beacon-label">
              {isLive
                ? t("ui.weather_live_beacon", "Live Meteomatics (SRTM 90m)")
                : t("ui.weather_analog_beacon", "Meteomatics Analog (SRTM 90m)")}
            </span>
          </div>

          <button
            type="button"
            className="weather-hud-collapse-btn"
            onClick={onClose}
            aria-label={t("ui.close_inspector", "Close")}
            title={t("ui.close_inspector", "Close")}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Live Telemetry Sensor Metrics */}
        <div className="weather-hud-metrics">
          {/* Temperature */}
          <div className="weather-chip" title={t("ui.temp_2m", "2m Air Temperature")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="weather-svg" aria-hidden="true">
              <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
            </svg>
            <div className="weather-chip-content">
              <span className="weather-chip-val">{params?.t_2m_c != null ? `${params.t_2m_c}°C` : "--"}</span>
              <span className="weather-chip-sub">{t("ui.weather_temp", "Temp")}</span>
            </div>
          </div>

          {/* Relative Humidity */}
          <div className="weather-chip" title={t("ui.humidity_label", "Relative Humidity")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="weather-svg" aria-hidden="true">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
            <div className="weather-chip-content">
              <span className="weather-chip-val">{params?.relative_humidity_pct != null ? `${params.relative_humidity_pct}%` : "--"}</span>
              <span className="weather-chip-sub">{t("ui.weather_humidity", "Humidity")}</span>
            </div>
          </div>

          {/* Evapotranspiration ET0 */}
          <div className="weather-chip" title={t("ui.et0_label", "Daily Reference Evapotranspiration")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="weather-svg" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
            <div className="weather-chip-content">
              <span className="weather-chip-val">{params?.evapotranspiration_24h_mm != null ? `${params.evapotranspiration_24h_mm} mm` : "--"}</span>
              <span className="weather-chip-sub">{t("ui.weather_et0", "ET₀ / day")}</span>
            </div>
          </div>

          {/* Soil Moisture Deficit */}
          <div className={`weather-chip ${isHighDeficit ? "warning" : ""}`} title={t("ui.deficit_label", "Soil Moisture Deficit")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="weather-svg" aria-hidden="true">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <div className="weather-chip-content">
              <span className="weather-chip-val">{params?.soil_moisture_deficit_mm != null ? `${params.soil_moisture_deficit_mm} mm` : "--"}</span>
              <span className="weather-chip-sub">{isHighDeficit ? t("ui.deficit_high", "High Deficit") : t("ui.deficit_normal", "Deficit")}</span>
            </div>
          </div>
        </div>

        {/* Simulation Grounding Switch */}
        <div className="weather-hud-sim-toggle">
          <span className="weather-toggle-label">{t("ui.sim_grounding_label", "Live Weather Grounding")}:</span>
          <button
            type="button"
            className={`weather-toggle-btn ${request.use_live_weather ?? true ? "active" : ""}`}
            onClick={handleToggleLiveSim}
            disabled={loading}
            aria-pressed={request.use_live_weather ?? true}
          >
            <span className="toggle-switch-thumb" />
            <span className="toggle-text">
              {(request.use_live_weather ?? true)
                ? t("ui.sim_grounding_active", "Live Sensor (SMI)")
                : t("ui.sim_grounding_baseline", "Historical (70%)")}
            </span>
          </button>
        </div>

        {/* 3D Atmospheric Preview Selector */}
        <div className="weather-hud-presets">
          <span className="weather-presets-label">{t("ui.weather_3d_mode", "3D Atmosphere")}:</span>
          <div className="weather-preset-buttons" role="radiogroup" aria-label={t("ui.weather_3d_mode", "3D Atmosphere")}>
            <button
              type="button"
              className={`weather-btn ${weatherMode === "auto" ? "active" : ""}`}
              onClick={() => handleModeSelect("auto")}
              role="radio"
              aria-checked={weatherMode === "auto"}
              title={t("ui.weather_auto_title", "Auto (Match current live weather)")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="weather-btn-svg" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span>{t("ui.weather_auto", "Auto (Live)")}</span>
            </button>

            <button
              type="button"
              className={`weather-btn ${weatherMode === "sunny" ? "active" : ""}`}
              onClick={() => handleModeSelect("sunny")}
              role="radio"
              aria-checked={weatherMode === "sunny"}
              title={t("ui.weather_sunny_title", "Clear / Arid Sun")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="weather-btn-svg" aria-hidden="true">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
              </svg>
              <span>{t("ui.weather_sunny", "Sunny")}</span>
            </button>

            <button
              type="button"
              className={`weather-btn ${weatherMode === "rain" ? "active" : ""}`}
              onClick={() => handleModeSelect("rain")}
              role="radio"
              aria-checked={weatherMode === "rain"}
              title={t("ui.weather_rain_title", "Rain / Wet Soil")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="weather-btn-svg" aria-hidden="true">
                <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
                <line x1="8" y1="19" x2="8" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
                <line x1="16" y1="19" x2="16" y2="21" />
              </svg>
              <span>{t("ui.weather_rain", "Rain")}</span>
            </button>

            <button
              type="button"
              className={`weather-btn ${weatherMode === "dust" ? "active" : ""}`}
              onClick={() => handleModeSelect("dust")}
              role="radio"
              aria-checked={weatherMode === "dust"}
              title={t("ui.weather_dust_title", "Khamsin Sand Dust Haze")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="weather-btn-svg" aria-hidden="true">
                <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
                <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
                <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
              </svg>
              <span>{t("ui.weather_dust", "Khamsin")}</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
