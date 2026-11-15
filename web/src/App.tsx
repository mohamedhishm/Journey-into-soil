import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SimulationWizard } from "./features/inputs/SimulationWizard";
import { TopNavBar } from "./features/navigation/TopNavBar";
import { AuthModal } from "./features/landing/AuthModal";
import { LandingPage } from "./features/landing/LandingPage";
import { NasaTelemetryModal } from "./features/landing/NasaTelemetryModal";
import { PdfReportModal } from "./features/landing/PdfReportModal";
import { FloatingAssistantWidget } from "./features/assistant/FloatingAssistantWidget";
import { ResultsDashboard } from "./features/results/ResultsDashboard";
import i18n from "./i18n";
import { msgText } from "./lib/msg";
import { useStore } from "./state/store";

function parseAnalysisId(): string | null {
  if (typeof window === "undefined") return null;
  const path = window.location.pathname;
  const match = path.match(/^\/a\/([^/?#]+)/);
  if (match) return decodeURIComponent(match[1]);
  const hash = window.location.hash;
  const hashMatch = hash.match(/^#\/a\/([^/?#]+)/);
  if (hashMatch) return decodeURIComponent(hashMatch[1]);
  return null;
}



function Disclaimer() {
  const { t } = useTranslation();
  const { result, lang } = useStore();
  const keys = result?.disclaimers ?? ["disclaimer.main"];
  return (
    <aside className="disclaimer" role="note">
      {keys.map((k) => <p key={k}>{msgText(t, lang, { key: k })}</p>)}
    </aside>
  );
}

function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="astryx-footer">
      <div className="astryx-footer-content">
        <div className="astryx-footer-brand">
          <img
            src="/the_shifters_logo_transparent.png"
            alt="The Shifters"
            className="astryx-footer-logo"
          />
          <span className="astryx-footer-title">The Shifters</span>
          <span className="astryx-footer-dot">·</span>
          <span className="astryx-footer-sub">Journey into the Soil</span>
          <span className="astryx-footer-dot">·</span>
          <span className="astryx-badge astryx-badge--matcha">NASA Space Apps 2026</span>
        </div>
        <p className="astryx-footer-disclaimer">
          {t(
            "disclaimer.footer",
            "NASA Space Apps Challenge 2026 'Field Shift: Adapting Farms with NASA Data'. Advisory decision-support system only. Does not replace local agronomic judgment or soil laboratory tests."
          )}
        </p>
      </div>
    </footer>
  );
}

function SimulatorView({ onBack }: { onBack: () => void }) {
  const { lang } = useStore();
  const isAr = lang === "ar";

  return (
    <main className="landing" id="field-simulator" style={{ display: "block", maxWidth: 1140, margin: "0 auto", padding: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <button
          type="button"
          onClick={onBack}
          className="astryx-btn astryx-btn--secondary"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, padding: "6px 14px", minHeight: 38 }}
        >
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ transform: isAr ? "rotate(180deg)" : "none" }}
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>{isAr ? "العودة للرئيسية" : "Back to Overview"}</span>
        </button>
      </div>

      <SimulationWizard onComplete={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
    </main>
  );
}

function Results() {
  const { t } = useTranslation();
  const { result, strategyId, reset, error } = useStore();

  if (!result) return null;
  const strategy = result.strategies.find((s) => s.id === strategyId) ?? result.strategies[0];

  return (
    <main className="results-wrapper">
      {error && <p className="error" role="alert" style={{ maxWidth: 1400, margin: "16px auto", padding: "12px 18px" }}>{t("ui.error")} {error}</p>}
      <ResultsDashboard result={result} strategy={strategy} onEdit={reset} />
    </main>
  );
}

export default function App() {
  const { lang, theme, result, loadAnalysis, reset } = useStore();
  const [showSimulator, setShowSimulator] = useState(false);

  useEffect(() => {
    void i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", theme === "dark" ? "#0b0e0c" : "#fbf9f5");
    }
  }, [theme]);

  useEffect(() => {
    const id = parseAnalysisId();
    if (id) {
      void loadAnalysis(id);
    }
    const onPopState = () => {
      const currentId = parseAnalysisId();
      if (currentId) {
        void loadAnalysis(currentId);
      } else {
        reset();
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [loadAnalysis, reset]);

  return (
    <>
      {result ? (
        <>
          <TopNavBar onBackToLanding={() => { reset(); setShowSimulator(false); }} currentView="results" />
          <Disclaimer />
          <Results />
          <Footer />
        </>
      ) : showSimulator ? (
        <>
          <TopNavBar onBackToLanding={() => setShowSimulator(false)} currentView="simulator" />
          <Disclaimer />
          <SimulatorView onBack={() => setShowSimulator(false)} />
          <Footer />
        </>
      ) : (
        <LandingPage onStartSimulation={() => setShowSimulator(true)} />
      )}

      {/* Global Persistent Floating AI Assistant & Modals */}
      <FloatingAssistantWidget />
      <AuthModal />
      <PdfReportModal />
      <NasaTelemetryModal />
    </>
  );
}
