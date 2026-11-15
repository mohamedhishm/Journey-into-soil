import { useTranslation } from "react-i18next";

export function WorkflowSection() {
  const { t } = useTranslation();

  const steps = [
    {
      num: "01",
      badge: t("landing.step1_badge", "Space Telemetry"),
      title: t("landing.step1_title", "1. NASA Earth Observations"),
      desc: t(
        "landing.step1_desc",
        "Continuous ingestion of NASA POWER 50 km weather series (2000–2025), SMAP surface soil moisture (top 5 cm), and Sentinel/VIIRS NDVI greenness index."
      ),
      bg: "/data_collection.jpeg",
      tags: ["NASA POWER", "SMAP L3", "VIIRS NDVI"],
    },
    {
      num: "02",
      badge: t("landing.step2_badge", "Subterranean Strata"),
      title: t("landing.step2_title", "2. Root-Zone Soil Physics"),
      desc: t(
        "landing.step2_desc",
        "Stratified 4-layer soil column (0–150 cm) pedotransfer simulation. Computes matric suction, hydraulic conductivity, salt leaching, and root uptake."
      ),
      bg: "/soil_layer_how_it_work.jpeg",
      tags: ["Saxton-Rawls", "FAO-56 ET0", "ECe Salinity"],
    },
    {
      num: "03",
      badge: t("landing.step3_badge", "Decision Support"),
      title: t("landing.step3_title", "3. Adaptive Rotation Strategies"),
      desc: t(
        "landing.step3_desc",
        "Synthesizes 3 distinct rotation candidates (Existing, Water/Health Optimal, Contrast Archetype) evaluated over 25 years with P10/P50/P90 confidence."
      ),
      bg: "/crop_recommendation_background.jpeg",
      tags: ["Multi-Year P10/P90", "Rank Stability", "Crop Diversity"],
    },
  ];

  return (
    <section id="how-it-works" className="py-12 border-b border-[var(--astryx-color-border-subtle)]">
      <div className="max-w-6xl mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="astryx-badge astryx-badge--amber mb-3">
            {t("landing.workflow_badge", "The 3-Act Architecture")}
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[var(--astryx-color-text-primary)]">
            {t("landing.workflow_title", "How Precision Soil Intelligence Works")}
          </h2>
          <p className="text-sm sm:text-base text-[var(--astryx-color-text-secondary)] mt-2">
            {t(
              "landing.workflow_subtitle",
              "Bridging coarse space-borne sensors with sub-surface agronomic reality."
            )}
          </p>
        </div>

        {/* 3-Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div
              key={step.num}
              className="astryx-card astryx-card--interactive overflow-hidden flex flex-col justify-between group relative min-h-[380px]"
            >
              {/* Background Image with Dark Gradient Scrim */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{ backgroundImage: `url('${step.bg}')` }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/75 to-black/40" />
              </div>

              {/* Card Header Content */}
              <div className="relative z-10 p-6 flex items-center justify-between">
                <span className="text-3xl font-black font-mono text-emerald-400 opacity-90">
                  {step.num}
                </span>
                <span className="astryx-badge text-[11px] bg-black/60 border-emerald-500/30 text-emerald-300 backdrop-blur-md">
                  {step.badge}
                </span>
              </div>

              {/* Card Body Content */}
              <div className="relative z-10 p-6 text-white space-y-3">
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                  {step.title}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                  {step.desc}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {step.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-neutral-200 border border-white/10 backdrop-blur-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
