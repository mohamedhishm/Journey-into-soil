import { useTranslation } from "react-i18next";
import { useStore } from "../../state/store";

interface HeroSectionProps {
  onScrollToMap: () => void;
  onScrollToForm: () => void;
}

export function HeroSection({ onScrollToMap, onScrollToForm }: HeroSectionProps) {
  const { t } = useTranslation();
  const { userEmail, setUserEmail, setAuthModalOpen, setPdfModalOpen, setNasaModalOpen } = useStore();

  return (
    <section className="relative overflow-hidden border-b border-[var(--astryx-color-border-subtle)] rounded-3xl mb-8">
      {/* Background with Ambient Overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
        style={{
          backgroundImage: "url('/Gemini_Generated_Image_git6nvgit6nvgit6.jpeg')",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/60 to-black/85 backdrop-blur-[1px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16 sm:py-24 text-center text-white flex flex-col items-center">
        {/* Astryx Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs sm:text-sm font-bold tracking-wide uppercase mb-6 backdrop-blur-md shadow-lg">
          <svg className="w-4 h-4 text-emerald-400 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <path d="m4.93 4.93 4.24 4.24" />
            <path d="m14.83 9.17 4.24-4.24" />
            <path d="m14.83 14.83 4.24 4.24" />
            <path d="m9.17 14.83-4.24 4.24" />
          </svg>
          <span>{t("landing.hero_badge", "NASA Space Apps 2026 · Field Shift")}</span>
        </div>

        {/* Hero Headline */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] max-w-4xl mb-6 text-white drop-shadow-md">
          {t("landing.hero_title_p1", "Where Space Data Meets the")}{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300">
            {t("landing.hero_title_highlight", "Root Zone")}
          </span>
          : {t("landing.hero_title_p2", "Precision Soil Intelligence")}
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg lg:text-xl text-neutral-200 max-w-3xl mb-10 leading-relaxed font-medium drop-shadow">
          {t("landing.hero_subtitle", "Adaptive crop rotation & root-zone hydrological simulation bridging NASA Earth observations with real soil physical strata.")}
        </p>

        {/* Guest vs Authenticated Action Flow */}
        {!userEmail ? (
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="astryx-btn astryx-btn--accent px-8 py-4 text-base font-extrabold shadow-2xl flex items-center gap-3 w-full sm:w-auto justify-center"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              <span>{t("landing.btn_try_croptalk", "Launch CropTalk & Soil Core")}</span>
            </button>

            <button
              type="button"
              onClick={onScrollToMap}
              className="astryx-btn px-6 py-4 text-sm font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md transition w-full sm:w-auto justify-center"
            >
              <svg className="w-4 h-4 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                <line x1="9" y1="3" x2="9" y2="18" />
                <line x1="15" y1="6" x2="15" y2="21" />
              </svg>
              <span>{t("landing.btn_explore_governorates", "Explore 27 Governorates")}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 w-full max-w-2xl bg-black/40 border border-white/15 p-6 rounded-3xl backdrop-blur-xl">
            {/* Active Farmer Indicator */}
            <div className="flex items-center justify-between w-full border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs sm:text-sm font-semibold text-emerald-300">
                  {t("landing.farmer_active", "Logged in as:")} <strong className="text-white font-mono">{userEmail}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setUserEmail(null)}
                className="text-xs text-rose-300 hover:text-rose-100 underline decoration-rose-400"
              >
                {t("landing.btn_sign_out", "Sign Out")}
              </button>
            </div>

            {/* Authenticated Fast Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
              <button
                type="button"
                onClick={onScrollToForm}
                className="astryx-btn astryx-btn--accent px-4 py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
                <span>{t("landing.btn_explore_sim", "Start Simulation")}</span>
              </button>

              <button
                type="button"
                onClick={() => setPdfModalOpen(true)}
                className="astryx-btn px-4 py-3 text-xs sm:text-sm font-bold bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-md flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>{t("landing.btn_print_pdf", "Export PDF Report")}</span>
              </button>

              <button
                type="button"
                onClick={() => setNasaModalOpen(true)}
                className="astryx-btn px-4 py-3 text-xs sm:text-sm font-bold bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-md flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
                <span>{t("landing.btn_compare_nasa", "Comparing with NASA Data")}</span>
              </button>
            </div>
          </div>
        )}

        {/* Quick Statistics Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 w-full max-w-4xl">
          <div className="bg-black/30 border border-white/10 rounded-2xl p-4 backdrop-blur-md text-center">
            <div className="text-2xl font-black text-emerald-400 font-mono">27</div>
            <div className="text-xs text-neutral-300 font-semibold mt-1">{t("landing.stat_governorates", "Governorates Ready")}</div>
          </div>
          <div className="bg-black/30 border border-white/10 rounded-2xl p-4 backdrop-blur-md text-center">
            <div className="text-2xl font-black text-amber-400 font-mono">25 Yrs</div>
            <div className="text-xs text-neutral-300 font-semibold mt-1">{t("landing.stat_climate", "NASA Historical Data")}</div>
          </div>
          <div className="bg-black/30 border border-white/10 rounded-2xl p-4 backdrop-blur-md text-center">
            <div className="text-2xl font-black text-emerald-400 font-mono">0–150cm</div>
            <div className="text-xs text-neutral-300 font-semibold mt-1">{t("landing.stat_depth", "Hydraulic Horizons")}</div>
          </div>
          <div className="bg-black/30 border border-white/10 rounded-2xl p-4 backdrop-blur-md text-center">
            <div className="text-2xl font-black text-sky-400 font-mono">100%</div>
            <div className="text-xs text-neutral-300 font-semibold mt-1">{t("landing.stat_offline", "Offline Demo Packs")}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
