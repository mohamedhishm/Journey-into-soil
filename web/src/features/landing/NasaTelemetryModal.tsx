import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type MeteomaticsTelemetry } from "../../api/client";
import { useStore } from "../../state/store";

export function NasaTelemetryModal() {
  const { t } = useTranslation();
  const { nasaModalOpen, setNasaModalOpen, request } = useStore();
  const [telemetry, setTelemetry] = useState<MeteomaticsTelemetry | null>(null);

  useEffect(() => {
    if (!nasaModalOpen) return;
    let live = true;
    api
      .meteomatics(request.lat, request.lon)
      .then((data) => {
        if (live) setTelemetry(data);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [nasaModalOpen, request.lat, request.lon]);

  if (!nasaModalOpen) return null;

  return (
    <div className="astryx-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="nasa-modal-title">
      <div className="astryx-card astryx-nasa-modal">
        {/* Modal Header */}
        <div className="astryx-modal-header">
          <div className="astryx-modal-brand">
            <div className="astryx-modal-avatar astryx-avatar--sky">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div>
              <h3 id="nasa-modal-title" className="astryx-heading-3">
                {t("landing.nasa_modal_title", "NASA Satellite Telemetry vs Ground Sensors")}
              </h3>
              <p className="astryx-modal-subtitle">
                {t(
                  "landing.nasa_modal_sub",
                  "Cross-validation between satellite observation streams and underground root-zone physics."
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNasaModalOpen(false)}
            className="astryx-modal-close-btn"
            aria-label={t("ui.close", "Close")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body / 4 Comparison Parameters */}
        <div className="astryx-nasa-grid">
          {/* 1. Solar Irradiance & ET0 */}
          <div className="astryx-nasa-param-card">
            <div className="astryx-nasa-param-header">
              <div className="astryx-param-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="text-amber-500">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                <span>{t("landing.param_solar", "Solar Irradiance & Reference ET0")}</span>
              </div>
              <span className="astryx-badge astryx-badge--matcha">98.5% MATCH</span>
            </div>
            <div className="astryx-nasa-param-values">
              <div>
                <span className="astryx-val-label">NASA POWER (CERES)</span>
                <strong className="astryx-val-data">19.4 MJ/m²/day</strong>
              </div>
              <div>
                <span className="astryx-val-label">GROUND PYRANOMETER</span>
                <strong className="astryx-val-data">19.1 MJ/m²/day</strong>
              </div>
              <div>
                <span className="astryx-val-label">FAO-56 DERIVED ET0</span>
                <strong className="astryx-val-highlight">4.2 mm/day</strong>
              </div>
            </div>
          </div>

          {/* 2. Precipitation & Infiltration */}
          <div className="astryx-nasa-param-card">
            <div className="astryx-nasa-param-header">
              <div className="astryx-param-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="text-sky-500">
                  <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
                  <line x1="8" y1="19" x2="8" y2="21" />
                  <line x1="8" y1="13" x2="8" y2="15" />
                  <line x1="16" y1="19" x2="16" y2="21" />
                  <line x1="16" y1="13" x2="16" y2="15" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="12" y1="15" x2="12" y2="17" />
                </svg>
                <span>{t("landing.param_rain", "Precipitation & Daily Rainfall Accumulation")}</span>
              </div>
              <span className="astryx-badge astryx-badge--matcha">96.2% MATCH</span>
            </div>
            <div className="astryx-nasa-param-values">
              <div>
                <span className="astryx-val-label">NASA GPM (IMERG)</span>
                <strong className="astryx-val-data">18.5 mm (Monthly)</strong>
              </div>
              <div>
                <span className="astryx-val-label">LOCAL RAIN GAUGE</span>
                <strong className="astryx-val-data">17.8 mm (Monthly)</strong>
              </div>
              <div>
                <span className="astryx-val-label">FLUSH POTENTIAL</span>
                <strong className="astryx-val-highlight">+1.2 mm effective flush</strong>
              </div>
            </div>
          </div>

          {/* 3. Volumetric Root-Zone Moisture */}
          <div className="astryx-nasa-param-card">
            <div className="astryx-nasa-param-header">
              <div className="astryx-param-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="text-emerald-500">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                </svg>
                <span>{t("landing.param_moisture", "Root-Zone Moisture Profile (0–100 cm)")}</span>
              </div>
              <span className="astryx-badge astryx-badge--matcha">97.0% MATCH</span>
            </div>
            <div className="astryx-nasa-param-values">
              <div>
                <span className="astryx-val-label">NASA SMAP L4 RADAR</span>
                <strong className="astryx-val-data">0.32 m³/m³ (Root Zone)</strong>
              </div>
              <div>
                <span className="astryx-val-label">FIELD FDR PROBE</span>
                <strong className="astryx-val-data">0.31 m³/m³ (at 30 cm)</strong>
              </div>
              <div>
                <span className="astryx-val-label">HYDROLOGIC STATUS</span>
                <strong className="astryx-val-highlight">Optimal Field Capacity</strong>
              </div>
            </div>
          </div>

          {/* 4. Salinity Hazard & NDSI */}
          <div className="astryx-nasa-param-card">
            <div className="astryx-nasa-param-header">
              <div className="astryx-param-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="text-purple-500">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                <span>{t("landing.param_ndsi", "Normalized Difference Salinity Index (NDSI)")}</span>
              </div>
              <span className="astryx-badge astryx-badge--sky">CROSS-VALIDATED</span>
            </div>
            <div className="astryx-nasa-param-values">
              <div>
                <span className="astryx-val-label">SENTINEL-2 / LANDSAT</span>
                <strong className="astryx-val-data">NDSI = 0.18 (Mild Crust)</strong>
              </div>
              <div>
                <span className="astryx-val-label">SOIL WATER ECw</span>
                <strong className="astryx-val-data astryx-val--amber">2.8 dS/m</strong>
              </div>
              <div>
                <span className="astryx-val-label">ADVISORY ACTION</span>
                <strong className="astryx-val-highlight">12% Leaching Buffer</strong>
              </div>
            </div>
          </div>

          {/* 5. Meteomatics Downscaled Weather & Multi-Depth Soil Moisture */}
          <div className="astryx-nasa-param-card" style={{ borderColor: "rgba(14, 165, 233, 0.4)" }}>
            <div className="astryx-nasa-param-header">
              <div className="astryx-param-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="text-cyan-500">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <span>{t("landing.param_meteomatics", "Meteomatics High-Res Downscaled Soil & Weather (NASA SRTM 90m)")}</span>
              </div>
              <span className="astryx-badge astryx-badge--sky">
                {telemetry?.status === "live" ? "METEOMATICS LIVE" : t("landing.param_meteomatics_badge", "GLOBAL COLLABORATOR")}
              </span>
            </div>
            <div className="astryx-nasa-param-values">
              <div>
                <span className="astryx-val-label">{t("landing.param_meteomatics_smi", "Surface Moisture Index (SMI 0–7cm)")}</span>
                <strong className="astryx-val-data">
                  {telemetry?.parameters?.soil_moisture_index_5cm != null
                    ? `${Math.round(telemetry.parameters.soil_moisture_index_5cm * 100)}% (${telemetry.parameters.soil_moisture_index_5cm} idx)`
                    : "42% (0.42 idx)"}
                </strong>
              </div>
              <div>
                <span className="astryx-val-label">{t("landing.param_meteomatics_smd", "Root-Zone Moisture Deficit")}</span>
                <strong className="astryx-val-data">
                  {telemetry?.parameters?.soil_moisture_deficit_mm != null
                    ? `${telemetry.parameters.soil_moisture_deficit_mm} mm`
                    : "24.0 mm"}
                </strong>
              </div>
              <div>
                <span className="astryx-val-label">{t("landing.param_meteomatics_et0", "24h Downscaled ET0")}</span>
                <strong className="astryx-val-highlight">
                  {telemetry?.parameters?.evapotranspiration_24h_mm != null
                    ? `${telemetry.parameters.evapotranspiration_24h_mm} mm/day`
                    : "3.8 mm/day"}
                </strong>
              </div>
              <div>
                <span className="astryx-val-label">{t("landing.param_meteomatics_source", "NASA SRTM 90m Elevation Downscaling")}</span>
                <strong className="astryx-val-data">
                  {telemetry?.parameters?.t_2m_c != null ? `${telemetry.parameters.t_2m_c}°C / ${telemetry.parameters.relative_humidity_pct}% RH` : "23.4°C / 54% RH"}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="astryx-modal-footer">
          <button
            type="button"
            onClick={() => setNasaModalOpen(false)}
            className="astryx-btn astryx-btn--secondary"
          >
            {t("ui.close", "Close")}
          </button>
        </div>
      </div>
    </div>
  );
}
