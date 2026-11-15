import { useTranslation } from "react-i18next";
import { useStore } from "../../state/store";
import "./TopNavBar.css";

interface TopNavBarProps {
  onBackToLanding?: () => void;
  currentView?: "simulator" | "results";
}

export function TopNavBar({ onBackToLanding, currentView }: TopNavBarProps) {
  const { t } = useTranslation();
  const {
    lang,
    setLang,
    theme,
    setTheme,
    quality,
    setQuality,
    result,
    userEmail,
    setAuthModalOpen,
    setUserEmail,
    setNasaModalOpen,
    setPdfModalOpen,
  } = useStore();

  const isAr = lang === "ar";
  const isResults = currentView === "results" || !!result;

  return (
    <header className="astryx-top-nav" dir={isAr ? "rtl" : "ltr"}>
      <div className="astryx-top-nav-inner">
        {/* 1. BRAND IDENTITY */}
        <div className="nav-brand-group">
          <button
            type="button"
            onClick={onBackToLanding}
            className="nav-brand-btn"
            title={isAr ? "العودة للرئيسية" : "Back to Overview"}
          >
            <img
              src="/Gemini_Generated_Image_42gudn42gudn42gu.svg"
              alt="The Shifters Logo"
              className="nav-brand-logo"
            />
            <div className="nav-brand-text">
              <span className="nav-brand-title">The Shifter</span>
              <span className="nav-brand-sub">
                {isAr ? "رحلة في أعماق التربة" : "Journey into the Soil"}
              </span>
            </div>
          </button>
          <span className="nav-nasa-badge">NASA Space Apps 2026</span>
        </div>

        {/* 2. CONTEXTUAL NAVIGATION & LIVE TELEMETRY */}
        <nav className="nav-links-group" aria-label="Main Navigation">
          {onBackToLanding && (
            <button
              type="button"
              onClick={onBackToLanding}
              className="nav-link-btn"
              title={isAr ? "العودة إلى النظرة العامة" : "Return to Overview"}
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
              <span>{isAr ? "نظرة عامة" : "Overview"}</span>
            </button>
          )}

          {/* Active Status Badge */}
          <div className="nav-active-crumb">
            <span className="crumb-dot" />
            <span>
              {isResults
                ? (isAr ? "نتائج الدورة والمحاكاة" : "Rotation & 3D Core")
                : (isAr ? "معالج المحاكاة" : "Field Simulator")}
            </span>
          </div>

          {/* Live NASA & Meteomatics Satellite Telemetry Trigger */}
          <button
            type="button"
            onClick={() => setNasaModalOpen(true)}
            className="nav-telemetry-btn"
            title={
              isAr
                ? "عرض قياسات الأقمار الصناعية الحية من ناسا وميتيوماتيكس"
                : "Inspect live satellite telemetry from NASA & Meteomatics"
            }
          >
            <span className="nav-live-pulse" />
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="2" />
              <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
            </svg>
            <span className="telemetry-label">
              {isAr ? "بيانات ناسا الحية" : "NASA Satellite Data"}
            </span>
          </button>

          {/* Contextual Export PDF Trigger (Visible when analysis result is present) */}
          {result && (
            <button
              type="button"
              onClick={() => setPdfModalOpen(true)}
              className="nav-action-btn highlight"
              title={isAr ? "تصدير التقرير التنفيذي بصيغة PDF" : "Export Executive PDF Report"}
            >
              <svg
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>{isAr ? "تقرير PDF" : "PDF Report"}</span>
            </button>
          )}
        </nav>

        {/* 3. RIGHT TOOLS & PROFILE */}
        <div className="nav-tools-group">
          {/* 3D Visualizer Quality Selector */}
          {result && (
            <div className="nav-quality-wrap" title={t("ui.quality")}>
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="nav-quality-icon"
                aria-hidden="true"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <select
                aria-label={t("ui.quality")}
                value={quality}
                onChange={(e) => setQuality(e.target.value as typeof quality)}
                className="nav-quality-select"
              >
                {["auto", "high", "medium", "low"].map((q) => (
                  <option key={q} value={q}>
                    {t(`ui.q_${q}`)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="nav-icon-btn"
            title={
              theme === "dark"
                ? (isAr ? "التبديل إلى الوضع النهاري" : "Switch to Light Mode")
                : (isAr ? "التبديل إلى الوضع الليلي" : "Switch to Dark Mode")
            }
          >
            {theme === "dark" ? (
              <svg
                viewBox="0 0 24 24"
                width="17"
                height="17"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="theme-sun-svg"
                aria-hidden="true"
              >
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
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="17"
                height="17"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="theme-moon-svg"
                aria-hidden="true"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Language Switcher Button */}
          <button
            type="button"
            onClick={() => setLang(isAr ? "en" : "ar")}
            aria-label="Toggle language"
            className="nav-lang-btn"
            title={isAr ? "Switch to English" : "التبديل إلى اللغة العربية"}
          >
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span>{isAr ? "EN" : "عربي"}</span>
          </button>

          {/* User Profile / Google Sign-in */}
          {userEmail ? (
            <div className="nav-user-chip">
              <span className="nav-user-dot" />
              <span className="nav-user-name" title={userEmail}>
                {userEmail.split("@")[0]}
              </span>
              <button
                type="button"
                onClick={() => setUserEmail(null)}
                className="nav-signout-btn"
                title={isAr ? "تسجيل الخروج" : "Sign Out"}
                aria-label="Sign Out"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="nav-auth-btn"
              title={isAr ? "تسجيل الدخول باستخدام Google" : "Sign in with Google"}
            >
              <svg className="nav-google-svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>{isAr ? "تسجيل الدخول" : "Sign In"}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
