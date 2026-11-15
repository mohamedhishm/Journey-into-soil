import { useTranslation } from "react-i18next";

export function BattlefieldSection() {
  const { t } = useTranslation();

  return (
    <section id="battlefield" className="py-12 border-b border-[var(--astryx-color-border-subtle)] relative overflow-hidden">
      {/* Subtle Tactical Background */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none"
        style={{ backgroundImage: "url('/battle_background.jpeg')" }}
      />

      <div className="max-w-6xl mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="astryx-badge astryx-badge--amber mb-3">
            {t("landing.battlefield_badge", "Space Telemetry vs Root Zone")}
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--astryx-color-text-primary)]">
            {t("landing.battlefield_title", "The Battlefield: Where Space Data Meets the Ground")}
          </h2>
          <p className="text-sm sm:text-base text-[var(--astryx-color-text-secondary)] mt-2">
            {t(
              "landing.battlefield_subtitle",
              "Why satellites alone cannot see roots, and why field models need satellite telemetry."
            )}
          </p>
        </div>

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* Card 1: NASA Space Telemetry */}
          <div className="astryx-card p-6 sm:p-8 flex flex-col justify-between border-sky-500/20 bg-gradient-to-b from-sky-950/10 to-[var(--astryx-color-surface)]">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="astryx-badge text-sky-400 bg-sky-500/10 border-sky-500/30">
                  {t("landing.space_telemetry_label", "NASA Space Observations")}
                </span>
                <span className="text-xs font-mono text-[var(--astryx-color-text-tertiary)]">
                  50 km · 9 km · 500 m
                </span>
              </div>
              <h3 className="text-xl font-bold text-[var(--astryx-color-text-primary)] mb-4">
                {t("landing.space_heading", "Macro Climate & Surface Boundary")}
              </h3>
              <ul className="space-y-3 text-sm text-[var(--astryx-color-text-secondary)]">
                <li className="flex items-start gap-2.5">
                  <span className="text-sky-400 font-bold mt-0.5">•</span>
                  <span><strong>NASA POWER:</strong> 25-year continuous solar radiation, max/min temperature, wind velocity, and relative humidity.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-sky-400 font-bold mt-0.5">•</span>
                  <span><strong>SMAP L3:</strong> L-band microwave radiometer measuring soil moisture in the top 5 cm surface skin.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-sky-400 font-bold mt-0.5">•</span>
                  <span><strong>VIIRS NDVI:</strong> Surface greenness reflectance tracking crop canopy vigor and identifying bare fallow periods.</span>
                </li>
              </ul>
            </div>
            <div className="mt-6 pt-4 border-t border-[var(--astryx-color-border-subtle)] text-xs text-[var(--astryx-color-text-muted)] italic">
              {t("landing.space_caveat", "Limitation: Satellites cannot penetrate deeper than ~5 cm to measure subsoil root uptake or root-zone salinity.")}
            </div>
          </div>

          {/* Card 2: Subterranean Soil Physics */}
          <div className="astryx-card p-6 sm:p-8 flex flex-col justify-between border-emerald-500/20 bg-gradient-to-b from-emerald-950/10 to-[var(--astryx-color-surface)]">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="astryx-badge text-emerald-400 bg-emerald-500/10 border-emerald-500/30">
                  {t("landing.soil_physics_label", "Root Zone Soil Physics")}
                </span>
                <span className="text-xs font-mono text-[var(--astryx-color-text-tertiary)]">
                  0–150 cm · 4 Strata
                </span>
              </div>
              <h3 className="text-xl font-bold text-[var(--astryx-color-text-primary)] mb-4">
                {t("landing.soil_heading", "Vertical Moisture & Solute Flux")}
              </h3>
              <ul className="space-y-3 text-sm text-[var(--astryx-color-text-secondary)]">
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">•</span>
                  <span><strong>Stratified Horizons:</strong> 0-20, 20-50, 50-90, 90-150 cm with dynamic texture, bulk density, and organic matter.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">•</span>
                  <span><strong>Saxton-Rawls Equations:</strong> Pedotransfer functions determining field capacity, wilting point, and matric potential.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold mt-0.5">•</span>
                  <span><strong>Crop Water & Salt Stress:</strong> FAO-56 dual crop coefficient (Kc), root-growth front, and salinity threshold depression (ECe).</span>
                </li>
              </ul>
            </div>
            <div className="mt-6 pt-4 border-t border-[var(--astryx-color-border-subtle)] text-xs text-[var(--astryx-color-text-muted)] italic">
              {t("landing.soil_caveat", "Limitation: Soil models require accurate daily solar radiation and atmospheric evaporative demand to calculate real flux.")}
            </div>
          </div>
        </div>

        {/* Synthesis Banner: The Hybrid Bridge */}
        <div className="mt-8 astryx-card p-6 bg-[var(--astryx-color-surface-subtle)] border-l-4 border-l-emerald-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-base font-bold text-[var(--astryx-color-text-primary)]">
              {t("landing.hybrid_bridge_title", "The Hybrid Decision Bridge")}
            </h4>
            <p className="text-xs sm:text-sm text-[var(--astryx-color-text-secondary)]">
              {t(
                "landing.hybrid_bridge_desc",
                "NASA satellite observations supply atmospheric boundary conditions, while our physical soil model propagates moisture into the deep root zone."
              )}
            </p>
          </div>
          <span className="astryx-badge text-emerald-400 bg-emerald-500/10 border-emerald-500/30 whitespace-nowrap">
            {t("landing.physics_informed", "Physics-Informed")}
          </span>
        </div>
      </div>
    </section>
  );
}
