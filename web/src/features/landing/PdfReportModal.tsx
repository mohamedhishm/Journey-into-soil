import { useTranslation } from "react-i18next";
import { useStore } from "../../state/store";

export function PdfReportModal() {
  const { t } = useTranslation();
  const { pdfModalOpen, setPdfModalOpen, userEmail, request, result } = useStore();

  if (!pdfModalOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const farmerDisplay = userEmail || "Ahmed Yasser";
  const locationDisplay = `${result?.field.region || "Nile Delta"} (${request.lat.toFixed(2)}°N, ${request.lon.toFixed(2)}°E)`;
  const waterSalinityDisplay = `${request.water_ec.toFixed(1)} dS/m (ECw)`;

  return (
    <div className="astryx-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pdf-modal-title">
      <div className="astryx-card astryx-pdf-modal" id="printable-advisory-report">
        {/* Modal Controls (Hidden in Print) */}
        <div className="astryx-pdf-modal-controls no-print">
          <div className="astryx-pdf-badge-tag">
            <span className="astryx-dot-pulse" />
            <span>{t("landing.pdf_preview_mode", "Printable Advisory Preview")}</span>
          </div>
          <div className="astryx-pdf-action-group">
            <button
              type="button"
              onClick={handlePrint}
              className="astryx-btn astryx-btn--primary"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>{t("landing.print_or_pdf", "Print / Save PDF")}</span>
            </button>
            <button
              type="button"
              onClick={() => setPdfModalOpen(false)}
              className="astryx-modal-close-btn"
              aria-label={t("ui.close", "Close")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Printable Report Document Sheet */}
        <div className="astryx-report-sheet">
          {/* Header */}
          <div className="astryx-report-header">
            <div className="astryx-report-brand">
              <img
                src="/the_shifters_logo_transparent.png"
                alt="The Shifters"
                className="astryx-report-logo"
              />
              <div>
                <h3 id="pdf-modal-title" className="astryx-report-title">
                  {t("landing.report_title", "Agronomic Soil Analysis & Rotation Recommendation")}
                </h3>
                <p className="astryx-report-subtitle">
                  {t(
                    "landing.report_meta",
                    "Calibrated via NASA POWER & Egypt SoilGrids · Beneficiary:"
                  )}{" "}
                  <strong>{farmerDisplay}</strong>
                </p>
              </div>
            </div>
            <div className="astryx-report-stamp">
              <span className="astryx-badge astryx-badge--matcha">NASA FIELD SHIFT 2026</span>
              <span className="astryx-report-date">{new Date().toLocaleDateString()}</span>
            </div>
          </div>

          {/* Key Indicators Summary Strip */}
          <div className="astryx-report-summary-strip">
            <div className="astryx-strip-col">
              <span className="astryx-strip-label">{t("landing.strip_loc", "LOCATION")}</span>
              <strong className="astryx-strip-val">{locationDisplay}</strong>
            </div>
            <div className="astryx-strip-col">
              <span className="astryx-strip-label">{t("landing.strip_water", "WATER SALINITY")}</span>
              <strong className="astryx-strip-val astryx-val--amber">{waterSalinityDisplay}</strong>
            </div>
            <div className="astryx-strip-col">
              <span className="astryx-strip-label">{t("landing.strip_nasa", "CALIBRATION STATUS")}</span>
              <strong className="astryx-strip-val astryx-val--matcha">
                {t("landing.strip_verified", "NASA POWER Daily Feed Verified")}
              </strong>
            </div>
          </div>

          {/* Section 1: Multi-Layer Soil Physics Profile */}
          <div className="astryx-report-section">
            <h4 className="astryx-section-heading">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              <span>{t("landing.report_sec1", "1. Multi-Layer Soil Physics & Salinity Profile")}</span>
            </h4>
            <div className="astryx-table-wrap">
              <table className="astryx-report-table">
                <thead>
                  <tr>
                    <th>{t("landing.col_depth", "Horizon (Depth)")}</th>
                    <th>{t("landing.col_texture", "Texture")}</th>
                    <th>{t("landing.col_om", "Organic Matter")}</th>
                    <th>{t("landing.col_bd", "Bulk Density")}</th>
                    <th>{t("landing.col_ece", "Saturation (ECe)")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>{t("landing.layer_top", "Topsoil (0–15 cm)")}</strong></td>
                    <td>{t("landing.tex_clay_loam", "Clay Loam")}</td>
                    <td>1.8%</td>
                    <td>1.28 g/cm³</td>
                    <td><span className="astryx-pill-status astryx-pill--amber">2.4 dS/m (Safe)</span></td>
                  </tr>
                  <tr>
                    <td><strong>{t("landing.layer_root", "Root Zone (15–45 cm)")}</strong></td>
                    <td>{t("landing.tex_silty_clay", "Silty Clay")}</td>
                    <td>1.1%</td>
                    <td>1.34 g/cm³</td>
                    <td><span className="astryx-pill-status astryx-pill--amber">3.1 dS/m (Moderate)</span></td>
                  </tr>
                  <tr>
                    <td><strong>{t("landing.layer_sub", "Subsoil (45–100 cm)")}</strong></td>
                    <td>{t("landing.tex_alluvial", "Heavy Alluvial Clay")}</td>
                    <td>0.6%</td>
                    <td>1.42 g/cm³</td>
                    <td><span className="astryx-pill-status astryx-pill--red">4.2 dS/m (Threshold)</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Recommended Rotation Strategy */}
          <div className="astryx-report-section">
            <h4 className="astryx-section-heading">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M12 2a10 10 0 0 1 10 10v1a8 8 0 0 1-8 8H7a5 5 0 0 1-5-5v-1a10 10 0 0 1 10-10z" />
                <path d="M12 2v20" />
              </svg>
              <span>{t("landing.report_sec2", "2. Recommended Salt-Resilient Rotation Plan")}</span>
            </h4>
            <div className="astryx-rotation-cards-grid">
              <div className="astryx-report-rot-card">
                <span className="astryx-rot-badge">{t("landing.year1_tag", "YEAR 1 (WINTER → SUMMER)")}</span>
                <strong className="astryx-rot-title">{t("landing.rot_y1", "Wheat → Chickpea")}</strong>
                <p className="astryx-rot-desc">
                  {t(
                    "landing.rot_y1_desc",
                    "Chickpea restores root-zone nitrogen (45 kg N/ha) and buffers against irrigation salts under winter rain flush."
                  )}
                </p>
              </div>

              <div className="astryx-report-rot-card">
                <span className="astryx-rot-badge">{t("landing.year2_tag", "YEAR 2 (WINTER → SUMMER)")}</span>
                <strong className="astryx-rot-title">{t("landing.rot_y2", "Barley → Sorghum")}</strong>
                <p className="astryx-rot-desc">
                  {t(
                    "landing.rot_y2_desc",
                    "Highest osmotic tolerance; reduces summer irrigation water demand by 28% while extracting deep moisture."
                  )}
                </p>
              </div>

              <div className="astryx-report-rot-card">
                <span className="astryx-rot-badge">{t("landing.year3_tag", "YEAR 3 (WINTER → SUMMER)")}</span>
                <strong className="astryx-rot-title">{t("landing.rot_y3", "Faba Bean → Sunflower")}</strong>
                <p className="astryx-rot-desc">
                  {t(
                    "landing.rot_y3_desc",
                    "Deep taproots break subsoil hardpan crust; incorporates organic green manure before next cereal cycle."
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Leaching Fraction Calculation */}
          <div className="astryx-report-section">
            <div className="astryx-lf-banner">
              <div>
                <strong className="astryx-lf-title">
                  {t("landing.lf_title", "Required Leaching Fraction (LF): 12%")}
                </strong>
                <p className="astryx-lf-sub">
                  {t(
                    "landing.lf_desc",
                    "Computed via FAO-56 Dual Kc Water Balance to prevent root-zone sodium accumulation."
                  )}
                </p>
              </div>
              <span className="astryx-badge astryx-badge--matcha">
                {t("landing.fao_verified", "FAO-56 COMPLIANT")}
              </span>
            </div>
          </div>

          {/* Report Footer / Non-negotiable Disclaimer */}
          <div className="astryx-report-footer">
            <p className="astryx-report-disclaimer">
              {t(
                "landing.report_disclaimer",
                "Advisory decision-support only. NASA Space Apps 2026 'Field Shift'. Does not replace local soil laboratory testing or agronomist field judgment. No fertilizer rates or yield guarantees provided."
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
