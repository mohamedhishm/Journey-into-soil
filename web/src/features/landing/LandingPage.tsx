import { useState, useEffect } from "react";
import { useStore } from "../../state/store";
import { api } from "../../api/client";

// All 27 Calibrated Governorates with exact coordinates from landing.html
export interface Governorate {
  id: string;
  name_en: string;
  name_ar: string;
  zone: "delta" | "canal" | "upper" | "desert";
  x: number;
  y: number;
  align: "left" | "right" | "top" | "bottom";
  soil_en: string;
  soil_ar: string;
  et0: string;
}

const GOVERNORATES: Governorate[] = [
  { id: "alexandria", name_en: "Alexandria", name_ar: "الإسكندرية", zone: "delta", x: 37.0, y: 15.4, align: "left", soil_en: "Sandy Loam to Clay", soil_ar: "طميية رملية إلى طينية", et0: "4.8 mm/d" },
  { id: "matrouh", name_en: "Matrouh", name_ar: "مطروح", zone: "desert", x: 12.9, y: 13.9, align: "right", soil_en: "Calcareous Sand", soil_ar: "رملية جيرية", et0: "5.1 mm/d" },
  { id: "beheira", name_en: "Beheira", name_ar: "البحيرة", zone: "delta", x: 41.9, y: 17.0, align: "left", soil_en: "Clay & Reclaimed Sand", soil_ar: "طميية ورملية مستصلحة", et0: "4.9 mm/d" },
  { id: "nubaria", name_en: "Nubaria", name_ar: "النوبارية", zone: "desert", x: 38.3, y: 20.5, align: "left", soil_en: "Sandy Reclaimed Loam", soil_ar: "رملية مستصلحة", et0: "5.2 mm/d" },
  { id: "kafr_el_sheikh", name_en: "Kafr El Sheikh", name_ar: "كفر الشيخ", zone: "delta", x: 46.1, y: 16.3, align: "top", soil_en: "Heavy Alluvial Clay", soil_ar: "طينية رسوبية ثقيلة", et0: "4.7 mm/d" },
  { id: "gharbia", name_en: "Gharbia", name_ar: "الغربية", zone: "delta", x: 46.6, y: 19.3, align: "right", soil_en: "Rich Silty Clay", soil_ar: "طينية سلتية خصبة", et0: "4.8 mm/d" },
  { id: "damietta", name_en: "Damietta", name_ar: "دمياط", zone: "delta", x: 54.2, y: 13.4, align: "top", soil_en: "Coastal Clay & Saline", soil_ar: "طينية ساحلية مالحة", et0: "4.6 mm/d" },
  { id: "dakahlia", name_en: "Dakahlia", name_ar: "الدقهلية", zone: "delta", x: 50.3, y: 17.0, align: "right", soil_en: "Deep Fertile Clay", soil_ar: "طينية رسوبية عميقة", et0: "4.8 mm/d" },
  { id: "port_said", name_en: "Port Said", name_ar: "بورسعيد", zone: "canal", x: 58.7, y: 14.8, align: "right", soil_en: "Saline Coastal Silt", soil_ar: "سلتية ساحلية مالحة", et0: "4.7 mm/d" },
  { id: "sharqia", name_en: "Sharqia", name_ar: "الشرقية", zone: "delta", x: 51.4, y: 21.3, align: "bottom", soil_en: "Clay Loam & Eastern Sand", soil_ar: "طميية طينية ورملية", et0: "5.0 mm/d" },
  { id: "ismailia", name_en: "Ismailia", name_ar: "الإسماعيلية", zone: "canal", x: 58.5, y: 21.2, align: "right", soil_en: "Sandy Loam to Sand", soil_ar: "طميية رملية خفيفة", et0: "5.3 mm/d" },
  { id: "qalyubia", name_en: "Qalyubia", name_ar: "القليوبية", zone: "delta", x: 48.2, y: 22.8, align: "left", soil_en: "Alluvial Clay Loam", soil_ar: "طميية طينية رسوبية", et0: "4.9 mm/d" },
  { id: "cairo", name_en: "Cairo", name_ar: "القاهرة", zone: "delta", x: 48.9, y: 26.3, align: "right", soil_en: "Floodplain Loam", soil_ar: "طميية نهرية", et0: "5.2 mm/d" },
  { id: "giza", name_en: "Giza", name_ar: "الجيزة", zone: "upper", x: 48.0, y: 26.9, align: "left", soil_en: "Clay Loam & Sand Margin", soil_ar: "طميية طينية وأطراف رملية", et0: "5.3 mm/d" },
  { id: "suez", name_en: "Suez", name_ar: "السويس", zone: "canal", x: 61.0, y: 27.1, align: "right", soil_en: "Gravelly Desert Loam", soil_ar: "طميية رملية وحصوية", et0: "5.6 mm/d" },
  { id: "fayoum", name_en: "Fayoum", name_ar: "الفيوم", zone: "upper", x: 45.2, y: 33.3, align: "left", soil_en: "Depression Clay Loam", soil_ar: "طميية طينية لمنخفض مغلق", et0: "5.4 mm/d" },
  { id: "beni_suef", name_en: "Beni Suef", name_ar: "بني سويف", zone: "upper", x: 47.5, y: 35.5, align: "right", soil_en: "Nile Valley Clay Loam", soil_ar: "طميية طينية لوادي النيل", et0: "5.6 mm/d" },
  { id: "minya", name_en: "Minya", name_ar: "المنيا", zone: "upper", x: 44.4, y: 44.9, align: "left", soil_en: "Silty Clay & West Sands", soil_ar: "طينية سلتية وأراضٍ غربية", et0: "5.8 mm/d" },
  { id: "asyut", name_en: "Asyut", name_ar: "أسيوط", zone: "upper", x: 48.2, y: 53.6, align: "left", soil_en: "Alluvial Clay & Reclaimed", soil_ar: "طينية رسوبية ومستصلحة", et0: "6.0 mm/d" },
  { id: "sohag", name_en: "Sohag", name_ar: "سوهاج", zone: "upper", x: 52.8, y: 59.5, align: "left", soil_en: "Fine Alluvial Clay", soil_ar: "طينية رسوبية ناعمة", et0: "6.2 mm/d" },
  { id: "qena", name_en: "Qena", name_ar: "قنا", zone: "upper", x: 62.4, y: 63.3, align: "right", soil_en: "Dense Alluvium", soil_ar: "رسوبية نيلية", et0: "6.5 mm/d" },
  { id: "luxor", name_en: "Luxor", name_ar: "الأقصر", zone: "upper", x: 61.7, y: 67.8, align: "right", soil_en: "Sandy Clay Loam", soil_ar: "طميية طينية رملية", et0: "6.6 mm/d" },
  { id: "aswan", name_en: "Aswan", name_ar: "أسوان", zone: "upper", x: 64.1, y: 83.0, align: "right", soil_en: "Coarse Loamy Sand", soil_ar: "رملية خشنة وطميية", et0: "7.1 mm/d" },
  { id: "new_valley", name_en: "New Valley", name_ar: "الوادي الجديد", zone: "desert", x: 42.4, y: 70.0, align: "left", soil_en: "Deep Oasis Sand & Clay", soil_ar: "رملية عميقة وطينية بواحات", et0: "6.8 mm/d" },
  { id: "north_sinai", name_en: "North Sinai", name_ar: "شمال سيناء", zone: "canal", x: 70.5, y: 22.0, align: "right", soil_en: "Coastal Sand Dunes", soil_ar: "كثبان رملية ساحلية", et0: "5.1 mm/d" },
  { id: "south_sinai", name_en: "South Sinai", name_ar: "جنوب سيناء", zone: "canal", x: 72.3, y: 41.0, align: "right", soil_en: "Wadi Gravel & Sand", soil_ar: "حصوية ورملية بالأودية", et0: "5.7 mm/d" },
  { id: "red_sea", name_en: "Red Sea", name_ar: "البحر الأحمر", zone: "desert", x: 74.3, y: 57.3, align: "right", soil_en: "Arid Coastal Gravel", soil_ar: "حصوية ساحلية جافة", et0: "6.3 mm/d" }
];

interface LandingPageProps {
  onStartSimulation: () => void;
}

export function LandingPage({ onStartSimulation }: LandingPageProps) {
  const { lang, setLang, theme, setTheme, user, setUser, userEmail, openDemoSite } = useStore();
  const isAr = lang === "ar";

  // Modals state
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [nasaModalOpen, setNasaModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Map state
  const [activeGovId, setActiveGovId] = useState<string>("beheira");
  const [selectedZone, setSelectedZone] = useState<"all" | "delta" | "canal" | "upper" | "desert">("all");

  // Toast notification
  const [toastText, setToastText] = useState<string | null>(null);

  // Keyboard shortcut to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPdfModalOpen(false);
        setNasaModalOpen(false);
        setAuthModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const showToast = (msg: string) => {
    setToastText(msg);
    setTimeout(() => setToastText(null), 3200);
  };

  // Listen for Google OAuth callback parameters (?code=... or ?credential=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const credential = params.get("credential");
    if (code || credential) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsAuthenticating(true);
      api
        .exchangeGoogleAuth({
          code: code || undefined,
          credential: credential || undefined,
          redirect_uri: window.location.origin,
        })
        .then((res) => {
          if (res.success && res.user) {
            setUser(res.user, res.token);
            setAuthModalOpen(false);
            showToast(
              isAr
                ? `مرحباً بعودتك ${res.user.name}! تم تسجيل الدخول بنجاح عبر Google`
                : `Welcome back ${res.user.name}! Authenticated with Google.`,
            );
          }
        })
        .catch((err) => {
          showToast(
            isAr
              ? `تعذر إتمام تسجيل الدخول عبر Google: ${err.message}`
              : `Google sign-in failed: ${err.message}`,
          );
        })
        .finally(() => {
          setIsAuthenticating(false);
        });
    }
  }, []);

  const activeGov = GOVERNORATES.find((g) => g.id === activeGovId) || GOVERNORATES[2];

  const filteredGovs = selectedZone === "all"
    ? GOVERNORATES
    : GOVERNORATES.filter((g) => g.zone === selectedZone);

  // Google OAuth sign-in via backend
  const handleGoogleSignIn = async () => {
    setIsAuthenticating(true);
    try {
      const data = await api.getGoogleAuthUrl(window.location.origin);
      if (data.configured && data.auth_url) {
        window.location.href = data.auth_url;
      } else {
        const authRes = await api.exchangeGoogleAuth({
          code: "dev_mock_oauth",
          redirect_uri: window.location.origin,
        });
        if (authRes.success && authRes.user) {
          setUser(authRes.user, authRes.token);
          setAuthModalOpen(false);
          showToast(
            isAr
              ? `مرحباً بك ${authRes.user.name}! تم تسجيل الدخول بنجاح عبر Google`
              : `Welcome ${authRes.user.name}! Authenticated with Google.`,
          );
        }
      }
    } catch (err: any) {
      showToast(
        isAr
          ? `خطأ في المصادقة: ${err.message}`
          : `Authentication error: ${err.message}`,
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Sign out via backend & local state
  const handleSignOut = async () => {
    try {
      await api.logout();
    } catch {}
    setUser(null);
    showToast(
      isAr
        ? "تم تسجيل الخروج من حساب Google بنجاح."
        : "Signed out of Google account.",
    );
  };

  return (
    <div className={`min-h-screen relative bg-[var(--astryx-color-bg)] text-[var(--astryx-color-text-primary)] antialiased transition-colors duration-300 font-sans ${theme === "dark" ? "dark" : ""}`} dir={isAr ? "rtl" : "ltr"}>
      
      {/* ==========================================================================
           1. ASTRYX NAVBAR (HEADER)
           ========================================================================== */}
      <header className="sticky top-0 z-40 border-b border-[var(--astryx-color-border-subtle)] bg-[var(--astryx-color-surface-overlay)] backdrop-blur-xl transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          
          {/* Brand Identity */}
          <a href="#" className="flex items-center gap-3.5 group text-start focus:outline-none focus:ring-2 focus:ring-[var(--astryx-color-border-focus)] rounded-xl p-1">
            <div className="flex items-center justify-center bg-transparent">
              <img src="/Gemini_Generated_Image_42gudn42gudn42gu.svg" alt="The Shifters Logo" className="h-14 sm:h-16 w-auto object-contain group-hover:scale-105 transition-transform duration-300 select-none" />
            </div>
            <div className="flex flex-col justify-center">
              <h1 className="font-extrabold text-xl sm:text-2xl tracking-tight text-[var(--astryx-color-text-primary)]">
                {isAr ? "The Shifter" : "The Shifter"}
              </h1>
              <span className="text-xs sm:text-sm text-[var(--astryx-color-primary)] font-bold tracking-wide">
                {isAr ? "رحلة في أعماق التربة" : "Journey into the Soil"}
              </span>
            </div>
          </a>

          {/* Desktop Nav Anchors */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-semibold text-[var(--astryx-color-text-secondary)]">
            <a href="#how-it-works" className="px-3 py-2 rounded-xl hover:text-[var(--astryx-color-text-primary)] hover:bg-[var(--astryx-color-surface-subtle)] transition">
              {isAr ? "آلية العمل" : "How It Works"}
            </a>
            <a href="#battlefield" className="px-3 py-2 rounded-xl hover:text-[var(--astryx-color-text-primary)] hover:bg-[var(--astryx-color-surface-subtle)] transition">
              {isAr ? "باطن التربة" : "Root Zone"}
            </a>
            <a href="#crop-talk" className="px-3 py-2 rounded-xl hover:text-[var(--astryx-color-text-primary)] hover:bg-[var(--astryx-color-surface-subtle)] transition">
              {isAr ? "حديث المحصول" : "Crop Talk AI"}
            </a>
            <a href="#map-section" className="px-3 py-2 rounded-xl hover:text-[var(--astryx-color-text-primary)] hover:bg-[var(--astryx-color-surface-subtle)] transition">
              {isAr ? "خريطة مصر" : "Egypt Map"}
            </a>
          </nav>

          {/* Header Actions: Language, Theme & Google Account Switchers */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Switcher */}
            <button
              onClick={() => {
                const nextLang = isAr ? "en" : "ar";
                setLang(nextLang);
                showToast(nextLang === "ar" ? "تم تحويل اللغة إلى العربية" : "Switched to English");
              }}
              aria-label="Toggle Language"
              className="astryx-btn astryx-btn--secondary px-3 py-2 text-xs font-bold"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="text-[var(--astryx-color-primary)]">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>{isAr ? "English" : "العربية"}</span>
            </button>

            {/* Theme Switcher */}
            <button
              onClick={() => {
                const next = theme === "dark" ? "light" : "dark";
                setTheme(next);
                showToast(next === "dark" ? (isAr ? "تم تفعيل الوضع الليلي (أستريكس)" : "Switched to Astryx Dark Mode") : (isAr ? "تم تفعيل الوضع النهاري (أستريكس)" : "Switched to Astryx Light Mode"));
              }}
              aria-label="Toggle Dark/Light Mode"
              className="astryx-btn astryx-btn--secondary p-2.5"
            >
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="text-[var(--astryx-color-accent)]">
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="text-[var(--astryx-color-accent)]">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            {/* Google Account / Sign-In Button in Header */}
            {!user ? (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="astryx-btn astryx-btn--secondary px-3.5 py-2 text-xs font-bold flex items-center gap-2 border-[var(--astryx-color-border)] hover:border-[#00a76f]/50 hover:bg-[var(--astryx-color-surface-raised)] transition-all shadow-sm"
                title={isAr ? "تسجيل الدخول عبر Google" : "Sign in with Google"}
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span className="hidden sm:inline">{isAr ? "تسجيل الدخول عبر Google" : "Sign in with Google"}</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {user.picture ? (
                    <img src={user.picture} alt={user.name} className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#1b4332] to-[#00a76f] text-white flex items-center justify-center text-[10px] font-bold">
                      {(user.name || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden sm:inline truncate max-w-[110px]">{user.name || user.email}</span>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  title={isAr ? "تسجيل الخروج" : "Sign Out"}
                  className="astryx-btn astryx-btn--secondary p-2 text-xs font-bold hover:text-rose-500 hover:border-rose-500/30 transition"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" className="rtl:rotate-180">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      <main>
        {/* ==========================================================================
             2. FULL-SCREEN ASTRYX HERO SECTION (Whole Screen Background)
             ========================================================================== */}
        <section className="relative min-h-[90vh] lg:min-h-screen w-full flex flex-col justify-between overflow-hidden border-b border-[var(--astryx-color-border-subtle)]">
          
          {/* Full-Screen Edge-to-Edge Background Image */}
          <div
            className="absolute inset-0 w-full h-full bg-cover bg-center lg:bg-[center_top] bg-no-repeat transition-transform duration-1000 scale-[1.01]"
            style={{ backgroundImage: "url('/Gemini_Generated_Image_fzlkafzlkafzlkaf.jpeg')" }}
          />

          {/* Astryx Multi-Layer Scrim & Atmospheric Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--astryx-color-bg)]/85 via-[var(--astryx-color-bg)]/70 to-[var(--astryx-color-bg)]/95 dark:from-[#0b0e0c]/85 dark:via-[#0b0e0c]/70 dark:to-[#0b0e0c]/95 backdrop-blur-[1px] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_20%,_var(--astryx-color-bg)_95%)] dark:bg-[radial-gradient(ellipse_at_center,_transparent_20%,_#0b0e0c_95%)] opacity-70 pointer-events-none" />

          {/* 1. Hero Guest Content: Shown when user is null */}
          {!user ? (
            <div id="heroGuestContent" className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8 sm:pt-16 sm:pb-12 text-center flex-1 flex flex-col justify-center items-center transition-all duration-300">
              
              {/* Grand Unbounded Full-Screen Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-[1.15] text-[var(--astryx-color-text-primary)] max-w-5xl mx-auto drop-shadow-sm">
                {isAr ? "حيث تلتقي بيانات الفضاء بمنطقة الجذور:" : "Where Space Data Meets the Root Zone:"} <br />
                <span className="bg-gradient-to-r from-[#1b4332] via-[#2d6a4f] to-[#d97706] dark:from-[#52b788] dark:via-[#74c69d] dark:to-[#f59e0b] bg-clip-text text-transparent">
                  {isAr ? "ذكاء التربة الدقيق" : "Precision Soil Intelligence"}
                </span>
              </h1>

              {/* Subtitle */}
              <p className="mt-6 text-base sm:text-lg lg:text-xl text-[var(--astryx-color-text-secondary)] font-medium leading-relaxed max-w-3xl mx-auto">
                {isAr
                  ? "نظام إرشادي قائم على فيزياء التربة يُمكّن المزارع المصري من استثمار أرصاد ناسا الفضائية، وهيدرولوجيا الطبقات، والتخطيط لدورات زراعية صامدة للملوحة."
                  : "A physics-based agronomic advisory system empowering Egyptian farmers with NASA Earth data, multi-layer soil hydrology, and salt-resilient crop rotation planning."}
              </p>

              {/* Unified Hero Action Button (Account-Gated) */}
              <div className="mt-8 sm:mt-12 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="astryx-btn px-8 sm:px-11 py-4 sm:py-5 text-base sm:text-lg font-extrabold text-white shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3.5 rounded-2xl group"
                  style={{ backgroundColor: "#00a76f", boxShadow: "0 16px 36px -6px rgba(0, 167, 111, 0.45)" }}
                >
                  <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 group-hover:rotate-12 transition-transform">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <span>{isAr ? "حديث المحصول وتشغيل المحاكي" : "crop talk ai and launch simulation"}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20" className="rtl:rotate-180 group-hover:translate-x-1.5 rtl:group-hover:-translate-x-1.5 transition-transform">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>

            </div>
          ) : (
            /* 2. Hero Authenticated Content: The Three Buttons (Unlocked after Google sign-in) */
            <div id="heroAuthenticatedContent" className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col justify-center items-center text-center transition-all duration-300 pb-56 sm:pb-72">
              
              {/* Account Status & Navigation Header above the 3 Buttons */}
              <div className="mb-6 sm:mb-8 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                {/* Back to Overview Button */}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-white/85 dark:bg-black/60 hover:bg-white dark:hover:bg-black/80 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-white/10 backdrop-blur-md shadow-sm transition hover:scale-105"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14" className="rtl:rotate-180 text-[#00a76f]">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  <span>{isAr ? "العودة للرئيسية" : "Back to Overview"}</span>
                </button>

                {/* Active Google Account Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 backdrop-blur-md shadow-sm">
                  {user.picture ? (
                    <img src={user.picture} alt={user.name} className="w-4 h-4 rounded-full object-cover" />
                  ) : (
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                    </svg>
                  )}
                  <span>{user.name} ({user.email})</span>
                </div>

                {/* Sign Out Button */}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/20 backdrop-blur-md transition hover:scale-105"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" className="rtl:rotate-180">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>{isAr ? "تسجيل الخروج" : "Sign Out"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 astryx-three-col-pipeline gap-5 sm:gap-6 w-full max-w-4xl mx-auto">
                
                {/* BUTTON 1: "start the journey simulation" */}
                <button
                  type="button"
                  onClick={onStartSimulation}
                  className="px-6 py-5 sm:py-6 rounded-3xl text-white font-extrabold text-sm sm:text-base shadow-2xl transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] flex items-center justify-center gap-3 text-center group cursor-pointer border-none"
                  style={{ background: "linear-gradient(135deg, #00a76f 0%, #1b4332 100%)", boxShadow: "0 14px 32px -4px rgba(0, 167, 111, 0.55)" }}
                >
                  <div className="w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                  <span>{isAr ? "تشغيل محاكاة الرحلة" : "start the journey simulation "}</span>
                </button>

                {/* BUTTON 2: "print analysis and reccomendation PDF" */}
                <button
                  type="button"
                  onClick={() => {
                    setPdfModalOpen(true);
                    showToast(isAr ? "جاري فتح تقرير التحليل والتوصيات..." : "Opening Analysis & Recommendation report...");
                  }}
                  className="px-6 py-5 sm:py-6 rounded-3xl bg-white/95 dark:bg-[#151c17]/95 hover:bg-white dark:hover:bg-white/10 text-neutral-900 dark:text-white border-2 border-emerald-500/50 hover:border-emerald-500 font-extrabold text-sm sm:text-base shadow-2xl backdrop-blur-xl transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] flex items-center justify-center gap-3 text-center group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-[#00a76f] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <polyline points="6 9 6 2 18 2 18 9" />
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" />
                    </svg>
                  </div>
                  <span>{isAr ? "طباعة تقرير التحليل والتوصيات PDF" : "print analysis and reccomendation PDF"}</span>
                </button>

                {/* BUTTON 3: "comparing the data with nasa's data" */}
                <button
                  type="button"
                  onClick={() => {
                    setNasaModalOpen(true);
                    showToast(isAr ? "تم تحميل مقارنة بيانات أقمار ناسا الفضائية." : "Loaded live NASA Earth Data comparison.");
                  }}
                  className="px-6 py-5 sm:py-6 rounded-3xl bg-white/95 dark:bg-[#151c17]/95 hover:bg-white dark:hover:bg-white/10 text-neutral-900 dark:text-white border-2 border-sky-500/50 hover:border-sky-500 font-extrabold text-sm sm:text-base shadow-2xl backdrop-blur-xl transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] flex items-center justify-center gap-3 text-center group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  </div>
                  <span>{isAr ? "مقارنة البيانات مع بيانات ناسا" : "comparing the data with nasa's data"}</span>
                </button>

              </div>

            </div>
          )}

          {/* Bottom Edge Stats Cards Strip */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 astryx-four-col-pipeline gap-3 sm:gap-4">
              
              <div className="p-3.5 sm:p-4 rounded-2xl bg-white/90 dark:bg-[#151b17]/90 border border-neutral-200/80 dark:border-white/10 backdrop-blur-md shadow-md text-start">
                <div className="text-xl sm:text-2xl font-black text-[var(--astryx-color-primary)] font-mono">
                  27
                </div>
                <div className="text-[11px] sm:text-xs font-bold text-[var(--astryx-color-text-secondary)] mt-0.5">
                  {isAr ? "محافظة مصرية معايرة" : "Egyptian Governorates"}
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-white/90 dark:bg-[#151b17]/90 border border-neutral-200/80 dark:border-white/10 backdrop-blur-md shadow-md text-start">
                <div className="text-xl sm:text-2xl font-black text-amber-500 font-mono">
                  {isAr ? "25 سنة" : "25 Years"}
                </div>
                <div className="text-[11px] sm:text-xs font-bold text-[var(--astryx-color-text-secondary)] mt-0.5">
                  {isAr ? "تدفق يومي للإشعاع والأمطار" : "Daily Solar & Rain Streams"}
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-white/90 dark:bg-[#151b17]/90 border border-neutral-200/80 dark:border-white/10 backdrop-blur-md shadow-md text-start">
                <div className="text-xl sm:text-2xl font-black text-[var(--astryx-color-primary)] font-mono">
                  0–100 cm
                </div>
                <div className="text-[11px] sm:text-xs font-bold text-[var(--astryx-color-text-secondary)] mt-0.5">
                  {isAr ? "محرك هيدرولوجيا وملوحة FAO-56" : "Hydrology & Salinity Engine"}
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-white/90 dark:bg-[#151b17]/90 border border-neutral-200/80 dark:border-white/10 backdrop-blur-md shadow-md text-start">
                <div className="text-xl sm:text-2xl font-black text-sky-500 font-mono">
                  100%
                </div>
                <div className="text-[11px] sm:text-xs font-bold text-[var(--astryx-color-text-secondary)] mt-0.5">
                  {isAr ? "جاهز بدون اتصال بالإنترنت" : "Field Pack Ready"}
                </div>
              </div>

            </div>
          </div>

        </section>

        {/* ==========================================================================
             3. HOW DOES IT WORK? (ASTRYX 3-STEP PIPELINE)
             ========================================================================== */}
        <section id="how-it-works" className="py-16 sm:py-24 border-t border-[var(--astryx-color-border-subtle)] bg-[var(--astryx-color-bg-subtle)]/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[var(--astryx-color-text-primary)] mb-4">
                {isAr ? "كيف يعمل النظام؟" : "How does it work?"}
              </h2>
              <p className="text-base sm:text-lg text-[var(--astryx-color-text-secondary)] leading-relaxed">
                {isAr
                  ? "من عينات وبيانات الحقل إلى خطط دورات زراعية مرنة عبر المحاكاة الفيزيائية."
                  : "From field sample inputs to resilient rotation plans through physics-based simulation."}
              </p>
            </div>

            {/* 3-Step Cards Pipeline */}
            <div className="relative mt-8">
              {/* Connecting dashed line across desktop */}
              <div className="hidden lg:block absolute top-10 inset-x-14 h-0.5 border-t-2 border-dashed border-[var(--astryx-color-border)] z-0" aria-hidden="true" />

              <div className="grid grid-cols-1 md:grid-cols-3 astryx-three-col-pipeline gap-6 relative z-10">
                
                {/* Step 1 */}
                <div className="group astryx-card astryx-card--interactive p-3 sm:p-3.5 flex flex-col justify-between relative overflow-hidden min-h-[480px] sm:min-h-[520px]">
                  {/* Background Image: data_collection.jpeg */}
                  <div
                    className="absolute inset-0 bg-cover bg-bottom transition-transform duration-500 group-hover:scale-105"
                    style={{ backgroundImage: "url('/data_collection.jpeg')" }}
                  />

                  {/* Upper Part: Text Plate */}
                  <div className="relative z-10 flex flex-col items-start w-full">
                    <div className="p-3 sm:p-3.5 rounded-2xl bg-white/95 dark:bg-white/95 backdrop-blur-md border border-white/90 shadow-md w-full text-start">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0">
                          1
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                          {isAr ? "إدخال بيانات الأرض" : "input the land data"}
                        </h3>
                      </div>
                      <p className="text-xs sm:text-sm text-stone-800 leading-snug font-medium">
                        {isAr
                          ? "إدخال موقع الحقل، وملوحة مياه الري، ونوع نظام الري، وتاريخ المحاصيل في المواسم السابقة في نموذج المحاكاة."
                          : "Input field location, water salinity, irrigation method, and recent crop rotation history in the form of the simulation."}
                      </p>
                    </div>
                  </div>

                  <div className="relative z-10 w-full pt-12" />
                </div>

                {/* Step 2 */}
                <div className="group astryx-card astryx-card--interactive p-3 sm:p-3.5 flex flex-col justify-between relative overflow-hidden min-h-[480px] sm:min-h-[520px]">
                  {/* Background Image: soil_layer_how_it_work.jpeg */}
                  <div
                    className="absolute inset-0 bg-cover bg-bottom transition-transform duration-500 group-hover:scale-105"
                    style={{ backgroundImage: "url('/soil_layer_how_it_work.jpeg')" }}
                  />

                  {/* Upper Part: Text Plate */}
                  <div className="relative z-10 flex flex-col items-start w-full">
                    <div className="p-3 sm:p-3.5 rounded-2xl bg-white/95 dark:bg-white/95 backdrop-blur-md border border-white/90 shadow-md w-full text-start">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0">
                          2
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                          {isAr ? "محاكاة فيزياء التربة" : "Simulate Soil Physics"}
                        </h3>
                      </div>
                      <p className="text-xs sm:text-sm text-stone-800 leading-snug font-medium">
                        {isAr
                          ? "تُعرض كل طبقة من طبقات الأرض بشكل منفصل، مع تفاصيل مكوناتها ودرجة الحموضة (pH) والمادة العضوية والرطوبة والملوحة."
                          : "Each of Earth's layers is shown separately, with details on its components, pH, organic matter, moisture, and salinity."}
                      </p>
                    </div>
                  </div>

                  <div className="relative z-10 w-full pt-12" />
                </div>

                {/* Step 3 */}
                <div className="group astryx-card astryx-card--interactive p-3 sm:p-3.5 flex flex-col justify-between relative overflow-hidden min-h-[480px] sm:min-h-[520px]">
                  {/* Background Image: crop_recommendation_background.jpeg */}
                  <div
                    className="absolute inset-0 bg-cover bg-bottom transition-transform duration-500 group-hover:scale-105"
                    style={{ backgroundImage: "url('/crop_recommendation_background.jpeg')" }}
                  />

                  {/* Upper Part: Text Plate */}
                  <div className="relative z-10 flex flex-col items-start w-full">
                    <div className="p-3 sm:p-3.5 rounded-2xl bg-white/95 dark:bg-white/95 backdrop-blur-md border border-white/90 shadow-md w-full text-start">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0">
                          3
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                          {isAr ? "تقديم التوصيات الاسترشادية" : "Deliver Recommendations"}
                        </h3>
                      </div>
                      <p className="text-xs sm:text-sm text-stone-800 leading-snug font-medium">
                        {isAr
                          ? "إنشاء استراتيجيات تتابع محصولي مرتبة وفق أولويات المزارع في توفير المياه، وصحة التربة، والحد من المخاطر، وتحقيق أعلى ربحية."
                          : "Generate ranked crop rotation strategies matching farmer priorities for water saving, soil health, risk mitigation and highest profit."}
                      </p>
                    </div>
                  </div>

                  <div className="relative z-10 w-full pt-12" />
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* ==========================================================================
             4. THE HIDDEN BATTLEFIELD IN THE SOIL
             ========================================================================== */}
        <section id="battlefield" className="relative py-16 sm:py-24 border-t border-[var(--astryx-color-border-subtle)] overflow-hidden">
          {/* Background Picture: battle_background.jpeg */}
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
            style={{ backgroundImage: "url('/battle_background.jpeg')" }}
          />

          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* Tactical Battlefield Mission Briefing Banner */}
            <div className="astryx-card p-6 sm:p-8 mb-8 backdrop-blur-md bg-[var(--astryx-color-surface)]/90 border border-[var(--astryx-color-border)] shadow-xl text-start">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="max-w-2xl">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[var(--astryx-color-text-primary)] leading-tight">
                    {isAr ? "المعركة الخفية في باطن التربة" : "The Hidden Battlefield in the Soil"}
                  </h2>
                </div>
                <p className="text-sm sm:text-base text-[var(--astryx-color-text-secondary)] max-w-md leading-relaxed md:border-l md:border-[var(--astryx-color-border)] md:pl-6 rtl:md:border-l-0 rtl:md:border-r rtl:md:pl-0 rtl:md:pr-6">
                  {isAr
                    ? "في أعماق التربة الخضراء، تدور حرب غير مرئية تهدد كل محصول. إليك المعارك الثلاث الحاسمة الدائرة في باطن الأرض."
                    : "Deep beneath the green crops, an invisible war threatens every harvest. Here are the three critical underground battles raging in the soil."}
                </p>
              </div>
            </div>

            {/* 3 Battlefield Threat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 astryx-three-col-pipeline gap-6 text-start">

              {/* Battle Card 1 */}
              <div className="astryx-card astryx-card--interactive p-6 flex flex-col justify-between backdrop-blur-md bg-[var(--astryx-color-surface)]/92 border border-[var(--astryx-color-border)] shadow-xl relative overflow-hidden group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-mono">
                      {isAr ? "المعركة 01 · حصار الملوحة" : "BATTLE 01 · SALINITY SIEGE"}
                    </span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" className="text-rose-500">
                      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                    </svg>
                  </div>

                  <h3 className="text-lg font-bold text-[var(--astryx-color-text-primary)] leading-tight">
                    {isAr ? "خنق الجذور بالأملاح" : "Salt Strangulation"}
                  </h3>

                  <ul className="space-y-2.5 text-xs text-[var(--astryx-color-text-secondary)] font-medium">
                    <li className="flex items-start gap-2">
                      <span className="text-rose-500 shrink-0 mt-0.5 font-bold">✕</span>
                      <span>
                        {isAr
                          ? "تتراكم الأملاح حول الجذور وتمنع النبات تماماً من شرب المياه."
                          : "Salt builds up around the roots and stops them from drinking water."}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-500 shrink-0 mt-0.5 font-bold">✕</span>
                      <span>
                        {isAr
                          ? "يعطش المحصول ويجف حتى لو كانت الأرض مروية بالكامل."
                          : "The plant dries out and dies of thirst, even when the soil is wet."}
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="mt-5 pt-3 border-t border-[var(--astryx-color-border-subtle)] flex items-center justify-between text-[11px] font-mono text-[var(--astryx-color-text-tertiary)]">
                  <span>COMBAT IMPACT</span>
                  <span className="text-rose-500 font-bold">
                    {isAr ? "التهديد: عطش النباتات في وفرة الماء" : "Threat: Plants Thirsty in Wet Soil"}
                  </span>
                </div>
              </div>

              {/* Battle Card 2 */}
              <div className="astryx-card astryx-card--interactive p-6 flex flex-col justify-between backdrop-blur-md bg-[var(--astryx-color-surface)]/92 border border-[var(--astryx-color-border)] shadow-xl relative overflow-hidden group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-mono">
                      {isAr ? "المعركة 02 · كمين استنزاف الخصوبة" : "BATTLE 02 · NUTRIENT AMBUSH"}
                    </span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" className="text-amber-500">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                  </div>

                  <h3 className="text-lg font-bold text-[var(--astryx-color-text-primary)] leading-tight">
                    {isAr ? "استنزاف العناصر والمغذيات" : "Nutrient Exhaustion"}
                  </h3>

                  <ul className="space-y-2.5 text-xs text-[var(--astryx-color-text-secondary)] font-medium">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 shrink-0 mt-0.5 font-bold">✕</span>
                      <span>
                        {isAr
                          ? "تكرار زراعة نفس المحصول يسحب كل الغذاء المفيد من الأرض."
                          : "Planting the same crop year after year eats up all food in the dirt."}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 shrink-0 mt-0.5 font-bold">✕</span>
                      <span>
                        {isAr
                          ? "تتعب التربة وتفرغ قوتها فلا يجد الزرع الجديد ما يكفيه لينمو."
                          : "The soil gets tired and empty, leaving new crops nothing to grow on."}
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="mt-5 pt-3 border-t border-[var(--astryx-color-border-subtle)] flex items-center justify-between text-[11px] font-mono text-[var(--astryx-color-text-tertiary)]">
                  <span>COMBAT IMPACT</span>
                  <span className="text-amber-500 font-bold">
                    {isAr ? "التهديد: نفاد الغذاء من الأرض" : "Threat: Soil Running Out of Food"}
                  </span>
                </div>
              </div>

              {/* Battle Card 3 */}
              <div className="astryx-card astryx-card--interactive p-6 flex flex-col justify-between backdrop-blur-md bg-[var(--astryx-color-surface)]/92 border border-[var(--astryx-color-border)] shadow-xl relative overflow-hidden group">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 font-mono">
                      {isAr ? "المعركة 03 · حصار الجفاف الباطني" : "BATTLE 03 · MOISTURE LOCKOUT"}
                    </span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" className="text-sky-500">
                      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                    </svg>
                  </div>

                  <h3 className="text-lg font-bold text-[var(--astryx-color-text-primary)] leading-tight">
                    {isAr ? "الجفاف وتصلب الطبقات الصماء" : "Hardpan Drought"}
                  </h3>

                  <ul className="space-y-2.5 text-xs text-[var(--astryx-color-text-secondary)] font-medium">
                    <li className="flex items-start gap-2">
                      <span className="text-sky-500 shrink-0 mt-0.5 font-bold">✕</span>
                      <span>
                        {isAr
                          ? "حرارة الشمس القوية تجفف الأرض وتحول باطنها لطبقة قاسية كالحجر."
                          : "Strong sun and dry heat bake the ground into a crust like concrete."}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-sky-500 shrink-0 mt-0.5 font-bold">✕</span>
                      <span>
                        {isAr
                          ? "يعجز الماء عن النزول في العمق وتصطدم الجذور بجدار صلب يوقف نموها."
                          : "Water cannot soak deep down, and young roots hit a solid wall."}
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="mt-5 pt-3 border-t border-[var(--astryx-color-border-subtle)] flex items-center justify-between text-[11px] font-mono text-[var(--astryx-color-text-tertiary)]">
                  <span>COMBAT IMPACT</span>
                  <span className="text-sky-500 font-bold">
                    {isAr ? "التهديد: حبس الجذور في أرض صلبة" : "Threat: Roots Trapped by Hard Ground"}
                  </span>
                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ==========================================================================
             6. CROP TALK (SECTION 4)
             ========================================================================== */}
        <section id="crop-talk" className="py-16 sm:py-24 border-t border-[var(--astryx-color-border-subtle)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[var(--astryx-color-text-primary)] mb-8 leading-tight max-w-3xl text-start">
              {isAr ? "حديث المحصول: ازرع سؤالاً، تحصد إجابة" : "Crop Talk: Plant a Question, Grow an Answer"}
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              
              {/* Chatbot Visibility Spotlight (Beside Chatbot Box) */}
              <div className="lg:col-span-5 space-y-4 text-start">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shadow-sm border border-emerald-500/20">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="12" cy="5" r="2" />
                    <path d="M12 7v4" />
                  </svg>
                </div>
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black bg-gradient-to-r from-[#1b4332] via-[#2d6a4f] to-[#d97706] dark:from-[#52b788] dark:via-[#74c69d] dark:to-[#f59e0b] bg-clip-text text-transparent leading-tight tracking-tight inline-block">
                  {isAr ? "ما يمكن أن يقدمه لك كروبي:" : "What cropy the chatbot does:"}
                </h3>
                <p className="text-base sm:text-lg text-[var(--astryx-color-text-secondary)] font-medium leading-relaxed">
                  {isAr
                    ? "يمكن لكروبي الإجابة ومناقشة أي استفسار متعلق بالمحاكاة أو التوصيات الزراعية."
                    : "Cropy can answer questions and talk about anything related to the simulation or recommendations."}
                </p>
              </div>

              {/* Interactive Dialogue Showcase UI */}
              <div className="lg:col-span-7">
                <div className="astryx-card overflow-hidden shadow-xl border border-[var(--astryx-color-border)]">
                  {/* Chat Header */}
                  <div className="px-5 py-4 border-b border-[var(--astryx-color-border-subtle)] bg-[var(--astryx-color-surface-subtle)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[var(--astryx-color-primary-subtle)] text-[var(--astryx-color-primary)] flex items-center justify-center font-bold">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                          <rect x="3" y="11" width="18" height="10" rx="2" />
                          <circle cx="12" cy="5" r="2" />
                          <path d="M12 7v4" />
                        </svg>
                      </div>
                      <div className="text-start">
                        <h3 className="text-sm font-bold text-[var(--astryx-color-text-primary)]">
                          cropy the chatbot
                        </h3>
                        <p className="text-[11px] text-[var(--astryx-color-text-tertiary)]">
                          {isAr ? "معاير ببيانات ناسا والتربة المصرية" : "Calibrated with Egypt SoilGrids & NASA Data"}
                        </p>
                      </div>
                    </div>
                    <span className="astryx-badge astryx-badge--matcha text-[10px] py-0.5 px-2 font-mono">
                      ● ACTIVE ADVISORY
                    </span>
                  </div>

                  {/* Chat Message Stream */}
                  <div className="p-5 space-y-4 max-h-[380px] overflow-y-auto">
                    {/* User Message */}
                    <div className="flex items-start gap-3 justify-end">
                      <div id="chatUserMsg" className="astryx-chat-bubble-user p-3.5 rounded-2xl rounded-tr-none text-xs sm:text-sm max-w-md shadow-sm text-start">
                        {isAr
                          ? "لماذا تم ترشيح محصول الحمص بعد القمح في البحيرة مع ملوحة مياه 2.8 ديسيمنز؟"
                          : "Why was chickpea recommended after wheat in Beheira with 2.8 dS/m canal water?"}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-[var(--astryx-color-surface-subtle)] border border-[var(--astryx-color-border)] flex items-center justify-center text-xs font-bold shrink-0">
                        👨‍🌾
                      </div>
                    </div>

                    {/* AI Response */}
                    <div className="flex items-start gap-3 justify-start">
                      <div className="w-8 h-8 rounded-full bg-[var(--astryx-color-primary-subtle)] text-[var(--astryx-color-primary)] flex items-center justify-center text-xs font-bold shrink-0">
                        🌱
                      </div>
                      <div id="chatAiMsg" className="astryx-chat-bubble-ai p-3.5 rounded-2xl rounded-tl-none text-xs sm:text-sm max-w-lg space-y-2 shadow-sm leading-relaxed text-start">
                        {isAr ? (
                          <>
                            <p>
                              <strong>الأساس الزراعي:</strong> في أراضي البحيرة الطميية، يؤدي تكرار زراعة الحبوب إلى استنزاف نيتروجين منطقة الجذور. يثبت الحمص النيتروجين الجوي بمعدل 40–60 كجم/هكتار مما يستعيد خصوبة التربة.
                            </p>
                            <p>
                              <strong>مقاومة الملوحة:</strong> يتحمل الحمص ملوحة جذور حتى 1.7 ديسيمنز/م. ولمياه ري بملوحة 2.8، توصي محاكاة FAO-56 بنسبة غسيل 12% مع أمطار الشتاء لتصريف الأملاح تحت عمق 45 سم.
                            </p>
                            <div className="pt-1 text-[11px] font-mono text-[var(--astryx-color-text-tertiary)]">
                              ملاحظة إرشادية: تحقق دائماً من قدرة الصرف المحلي قبل بدء الزراعة.
                            </div>
                          </>
                        ) : (
                          <>
                            <p>
                              <strong>Agronomic rationale:</strong> In Beheira's clay-loam soil, back-to-back cereal crops heavily exhaust available root-zone nitrogen. Chickpea fixes atmospheric nitrogen (approx. 40–60 kg N/ha), revitalizing soil biology.
                            </p>
                            <p>
                              <strong>Salinity buffer:</strong> Chickpea handles moderate root ECe thresholds up to 1.7 dS/m. With 2.8 dS/m irrigation water, our FAO-56 simulation mandates a 12% leaching fraction during winter rains to flush accumulated salts below the 45 cm root perimeter.
                            </p>
                            <div className="pt-1 text-[11px] font-mono text-[var(--astryx-color-text-tertiary)]">
                              Advisory note: Always verify local drainage capacity before planting.
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Interactive Prompt Input Bar Mockup */}
                  <div
                    onClick={() => {
                      if (userEmail) {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      } else {
                        setAuthModalOpen(true);
                      }
                    }}
                    className="p-3 border-t border-[var(--astryx-color-border-subtle)] bg-[var(--astryx-color-surface-subtle)]/50 flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      id="chatInputMock"
                      type="text"
                      readOnly
                      value={
                        isAr
                          ? "اسأل كروبي (cropy the chatbot) عن تربتك أو محاصيلك أو الري..."
                          : "Ask cropy the chatbot about your soil, crops, or irrigation..."
                      }
                      className="flex-1 bg-[var(--astryx-color-surface)] border border-[var(--astryx-color-border)] rounded-xl px-3.5 py-2 text-xs text-[var(--astryx-color-text-secondary)] focus:outline-none select-none cursor-pointer"
                    />
                    <button type="button" aria-label="Send" className="astryx-btn astryx-btn--primary p-2 rounded-xl">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  </div>

                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ==========================================================================
             7. INTERACTIVE AGROCLIMATOLOGY MAP OF EGYPT (ASTRYX SECTION 5)
             ========================================================================== */}
        <section id="map-section" className="py-16 sm:py-24 border-t border-[var(--astryx-color-border-subtle)] bg-[var(--astryx-color-bg-subtle)]/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-3xl mx-auto mb-14">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[var(--astryx-color-text-primary)] mb-4">
                {isAr ? "خريطة المناخ الزراعي في مصر" : "Agroclimatology Map of Egypt"}
              </h2>
              <p className="text-base sm:text-lg text-[var(--astryx-color-text-secondary)] leading-relaxed">
                {isAr
                  ? "خريطة تفاعلية لجمهورية مصر العربية تُبرز المحافظات والمناطق الزراعية التي تمت معايرة بيانات ناسا المناخية وفيزياء التربة فيها."
                  : "An interactive map of Egypt highlighting the governorates and agricultural regions where our NASA agroclimatology and soil data are calibrated."}
              </p>
            </div>

            {/* Zone Filter Chips */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
              {[
                { id: "all", label_en: "All 27 Governorates", label_ar: "كافة المحافظات الـ 27" },
                { id: "delta", label_en: "Nile Delta", label_ar: "الدلتا والوجه البحري" },
                { id: "canal", label_en: "Canal & Sinai", label_ar: "القناة وسيناء" },
                { id: "upper", label_en: "Upper Egypt", label_ar: "الصعيد ومصر العليا" },
                { id: "desert", label_en: "Desert & Oases", label_ar: "الواحات والصحراء" },
              ].map((z) => (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => setSelectedZone(z.id as typeof selectedZone)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${selectedZone === z.id ? "astryx-btn--primary shadow-md" : "astryx-btn--secondary"}`}
                >
                  {isAr ? z.label_ar : z.label_en}
                </button>
              ))}
            </div>

            <div className="astryx-card p-4 sm:p-7 shadow-2xl">
              
              {/* Interactive Status Banner */}
              <div className="p-4 rounded-2xl bg-[var(--astryx-color-surface-subtle)] border border-[var(--astryx-color-border-subtle)] mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-start">
                <div>
                  <div className="text-xs font-mono font-bold text-[var(--astryx-color-primary)] uppercase">
                    {isAr ? "محطة بيانات المناخ والتربة (ناسا)" : "NASA Climate & Soil Data Node"}
                  </div>
                  <div className="text-base sm:text-lg font-black text-[var(--astryx-color-text-primary)]">
                    {isAr ? `${activeGov.name_ar} • محطة معايرة معتمدة` : `${activeGov.name_en} • Calibrated Node`}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--astryx-color-text-secondary)] font-medium">
                  <span className="px-2.5 py-1 rounded-lg bg-[var(--astryx-color-surface)] border border-[var(--astryx-color-border)]">
                    <strong>{isAr ? "التربة:" : "Soil:"}</strong> {isAr ? activeGov.soil_ar : activeGov.soil_en}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-[var(--astryx-color-surface)] border border-[var(--astryx-color-border)]">
                    <strong>{isAr ? "التبخر-نتح:" : "Ref ET0:"}</strong> {activeGov.et0}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      showToast(isAr ? `جاري تحميل محاكاة ${activeGov.name_ar}...` : `Loading simulation for ${activeGov.name_en}...`);
                      try {
                        const demoSites = await api.demoSites();
                        const match = demoSites.find((s) => s.id === activeGov.id) || demoSites[0];
                        if (match) {
                          await openDemoSite(match);
                        } else {
                          onStartSimulation();
                        }
                      } catch {
                        onStartSimulation();
                      }
                    }}
                    className="astryx-btn astryx-btn--primary px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span>{isAr ? "محاكاة هذه المحافظة" : "Simulate This Site"}</span>
                  </button>
                </div>
              </div>

              {/* Interactive Map Container (Locked to LTR so Egypt geography is never flipped) */}
              <div className="map-lock-ltr relative w-full rounded-2xl overflow-hidden border border-[var(--astryx-color-border)] bg-[#0b0e0c] shadow-inner" dir="ltr">
                <div className="relative w-full max-w-[1100px] mx-auto aspect-[1451/1084]">
                  {/* Base Map Image */}
                  <img
                    src="/Unlabeled Relief Map of Egypt.png"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.src.endsWith("egypt_map.png")) {
                        target.src = "/egypt_map.png";
                      }
                    }}
                    alt="Agroclimatology Relief Map of Egypt"
                    className="w-full h-full block object-cover select-none pointer-events-none"
                  />
                  
                  {/* Red Pins & Labels Layer */}
                  <div className="absolute inset-0 pointer-events-none" role="region" aria-label="Egyptian Governorates Pins">
                    {filteredGovs.map((gov) => {
                      const isActive = gov.id === activeGovId;
                      const govName = isAr ? gov.name_ar : gov.name_en;

                      let alignClass = "start-full ms-1.5 top-1/2 -translate-y-1/2";
                      if (gov.align === "left") alignClass = "end-full me-1.5 top-1/2 -translate-y-1/2";
                      if (gov.align === "top") alignClass = "start-1/2 -translate-x-1/2 bottom-full mb-1.5 align-top";
                      if (gov.align === "bottom") alignClass = "start-1/2 -translate-x-1/2 top-full mt-1.5 align-bottom";

                      return (
                        <div
                          key={gov.id}
                          className={`gov-marker absolute cursor-pointer pointer-events-auto z-10 ${isActive ? "active" : ""}`}
                          style={{ left: `${gov.x}%`, top: `${gov.y}%` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveGovId(gov.id);
                          }}
                          onMouseEnter={() => setActiveGovId(gov.id)}
                          tabIndex={0}
                          role="button"
                          aria-label={govName}
                          title={govName}
                        >
                          <div className="relative w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                            <div className="astryx-pin-beacon absolute inset-0 rounded-full bg-red-500 opacity-60" />
                            <div className="pin-dot relative z-10 w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-red-600 border-2 border-white shadow-md transition-all" />
                          </div>
                          <span className={`pin-badge absolute ${alignClass} px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] md:text-[11px] font-bold bg-red-600/95 text-white border border-white/70 shadow-md backdrop-blur-sm whitespace-nowrap select-none`}>
                            {govName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Governorates Tags List Beneath Map */}
              <div className="mt-8 pt-6 border-t border-[var(--astryx-color-border-subtle)] text-start">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--astryx-color-text-secondary)]">
                    {isAr ? "المحافظات والمناطق الزراعية المشمولة بالمعايرة" : "Calibrated Governorates & Agricultural Zones"}
                  </h4>
                  <span className="text-xs font-mono font-semibold text-[var(--astryx-color-primary)]">
                    {filteredGovs.length} {isAr ? "محافظة" : "Governorates"}
                  </span>
                </div>
                <ul className="flex flex-wrap gap-2 list-none p-0 m-0" role="list">
                  {filteredGovs.map((gov) => {
                    const isActive = gov.id === activeGovId;
                    return (
                      <li key={gov.id}>
                        <button
                          type="button"
                          onClick={() => setActiveGovId(gov.id)}
                          onMouseEnter={() => setActiveGovId(gov.id)}
                          className={`gov-tag px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-2 select-none ${isActive ? "astryx-btn--primary shadow-md" : "astryx-btn--secondary"}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-[#ffd54a]" : "bg-[#ef4444]"}`} />
                          <span>{isAr ? gov.name_ar : gov.name_en}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

            </div>

          </div>
        </section>

      </main>

      {/* ==========================================================================
           9. ASTRYX FOOTER (COMPLIANT WITH RULE #1 NON-NEGOTIABLE)
           ========================================================================== */}
      <footer className="border-t border-[var(--astryx-color-border-subtle)] bg-[var(--astryx-color-surface-subtle)] py-12 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <img src="/Gemini_Generated_Image_42gudn42gudn42gu.svg" alt="The Shifters Logo" className="h-10 sm:h-12 w-auto object-contain bg-transparent" />
            <span className="font-extrabold text-[var(--astryx-color-text-primary)] text-base">The Shifter</span>
            <span className="text-[var(--astryx-color-text-tertiary)]">·</span>
            <span className="font-medium text-[var(--astryx-color-text-secondary)] text-sm">
              {isAr ? "رحلة في أعماق التربة" : "Journey into the Soil"}
            </span>
            <span className="text-[var(--astryx-color-text-tertiary)]">·</span>
            <span className="astryx-badge astryx-badge--neutral text-[10px] py-0.5 px-2 font-mono">Astryx Design System</span>
          </div>

          <p className="text-xs sm:text-sm text-[var(--astryx-color-text-tertiary)] max-w-3xl mx-auto leading-relaxed">
            {isAr
              ? "تم التطوير لتحدي ناسا لتطبيقات الفضاء 2026 (NASA Space Apps). نظام دعم قرارات استرشادي فقط، ولا يغني عن التحليل المعملي للتربة أو استشارة المهندس الزراعي المختص. لا يتضمن توصيات أسمدة كمية أو وعوداً إنتاجية."
              : "Developed for NASA Space Apps Challenge 2026 (Field Shift: Adapting Farms with NASA Data). Advisory decision-support system only. Does not replace local soil laboratory testing or agronomic expert judgment. No fertilizer rates or yield guarantees provided."}
          </p>

          <div className="pt-4 flex items-center justify-center gap-4 text-xs text-[var(--astryx-color-text-tertiary)]">
            <span>Team The Shifters</span>
            <span>•</span>
            <a href="#" className="hover:text-[var(--astryx-color-text-primary)] underline">
              {isAr ? "العودة للأعلى" : "Back to Top"}
            </a>
          </div>
        </div>
      </footer>

      {/* ==========================================================================
           MODAL 1: PRINT ANALYSIS AND RECOMMENDATION PDF
           ========================================================================== */}
      {pdfModalOpen && (
        <div id="pdfModal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="w-full max-w-3xl bg-white dark:bg-[#141b17] border border-neutral-200 dark:border-white/15 rounded-3xl shadow-2xl p-6 sm:p-8 text-neutral-900 dark:text-white max-h-[90vh] overflow-y-auto text-start" id="printReportSection">
            
            {/* Report Header */}
            <div className="flex items-start justify-between pb-4 border-b border-neutral-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center p-1.5">
                  <img src="/the_shifters_logo_transparent.png" alt="The Shifters" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-neutral-900 dark:text-white leading-tight">
                    {isAr ? "تقرير التحليل الفيزيائي وتوصيات الدورة الزراعية" : "Agronomic Soil Analysis & Rotation Recommendation"}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                    {isAr
                      ? `تمت المعايرة ببيانات NASA POWER وقاعدة SoilGrids مصر · المستفيد: ${userEmail || "Ahmed Yasser"}`
                      : `Calibrated via NASA POWER & Egypt SoilGrids · Beneficiary: ${userEmail || "Ahmed Yasser"}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPdfModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition no-print"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Report Body Content */}
            <div className="space-y-6 py-6 text-xs sm:text-sm">
              
              {/* Summary Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10">
                <div>
                  <div className="text-[11px] text-neutral-500 font-mono">LOCATION</div>
                  <div className="font-bold text-neutral-900 dark:text-white">Beheira, Nile Delta (31.0°N, 30.5°E)</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 font-mono">WATER SALINITY</div>
                  <div className="font-bold text-amber-600 dark:text-amber-400">2.8 dS/m (ECw)</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 font-mono">CALIBRATION STATUS</div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">NASA POWER Daily Feed Verified</div>
                </div>
              </div>

              {/* Section: Soil Physics Simulation Profile */}
              <div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
                  <span className="text-[#00a76f]">❖</span>
                  1. Multi-Layer Soil Physics & Salinity Profile
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-start border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-white/10 text-neutral-500 font-mono text-[11px]">
                        <th className="py-2 text-start">HORIZON (DEPTH)</th>
                        <th className="py-2 text-start">TEXTURE</th>
                        <th className="py-2 text-start">ORGANIC MATTER</th>
                        <th className="py-2 text-start">BULK DENSITY</th>
                        <th className="py-2 text-start">SATURATION (ECe)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                      <tr>
                        <td className="py-2.5 font-bold">Topsoil (0–15 cm)</td>
                        <td>Clay Loam</td>
                        <td>1.8%</td>
                        <td>1.28 g/cm³</td>
                        <td className="text-amber-600 dark:text-amber-400 font-bold">2.4 dS/m (Safe)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-bold">Root Zone (15–45 cm)</td>
                        <td>Silty Clay</td>
                        <td>1.1%</td>
                        <td>1.34 g/cm³</td>
                        <td className="text-amber-600 dark:text-amber-400 font-bold">3.1 dS/m (Moderate)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-bold">Subsoil (45–100 cm)</td>
                        <td>Heavy Alluvial Clay</td>
                        <td>0.6%</td>
                        <td>1.42 g/cm³</td>
                        <td className="text-red-500 font-bold">4.2 dS/m (Threshold)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section: Recommended Rotation Strategy */}
              <div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-2">
                  <span className="text-[#00a76f]">❖</span>
                  2. Recommended Multi-Year Salt-Resilient Rotation Plan
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">YEAR 1 (WINTER → SUMMER)</span>
                    <div className="font-bold text-sm text-neutral-900 dark:text-white mt-1">Wheat → Chickpea</div>
                    <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1">
                      Chickpea restores root-zone nitrogen (45 kg N/ha) and buffers against 2.8 dS/m irrigation salts.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30">
                    <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400 font-bold">YEAR 2 (WINTER → SUMMER)</span>
                    <div className="font-bold text-sm text-neutral-900 dark:text-white mt-1">Barley → Sorghum</div>
                    <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1">
                      Highest osmotic tolerance; reduces summer irrigation demand by 28% while extracting deep moisture.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                    <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-bold">YEAR 3 (WINTER → SUMMER)</span>
                    <div className="font-bold text-sm text-neutral-900 dark:text-white mt-1">Faba Bean → Sunflower</div>
                    <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1">
                      Deep taproots break subsoil hardpan crust; incorporates green manure before next cereal cycle.
                    </p>
                  </div>
                </div>
              </div>

              {/* Section: Leaching Fraction & Water Budget */}
              <div className="p-4 rounded-2xl bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-neutral-900 dark:text-white">Required Leaching Fraction (LF)</div>
                  <div className="text-[11px] text-neutral-500">FAO-56 Dual Kc Water Balance Calculation</div>
                </div>
                <div className="text-end">
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">12%</span>
                  <span className="text-[11px] text-neutral-500 block">Extra volume during winter flushing</span>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-neutral-200 dark:border-white/10 flex items-center justify-end gap-3 no-print">
              <button
                type="button"
                onClick={() => setPdfModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/15 text-xs font-bold hover:bg-neutral-100 dark:hover:bg-white/10 transition"
              >
                {isAr ? "إغلاق" : "Close"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition flex items-center gap-2 hover:brightness-105"
                style={{ backgroundColor: "#00a76f" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                <span>{isAr ? "طباعة / حفظ كـ PDF" : "Print / Save as PDF"}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ==========================================================================
           MODAL 2: COMPARING DATA WITH NASA'S DATA
           ========================================================================== */}
      {nasaModalOpen && (
        <div id="nasaModal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="w-full max-w-3xl bg-white dark:bg-[#141b17] border border-sky-500/30 rounded-3xl shadow-2xl p-6 sm:p-8 text-neutral-900 dark:text-white max-h-[90vh] overflow-y-auto text-start">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-neutral-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-500 flex items-center justify-center p-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-neutral-900 dark:text-white leading-tight">
                    {isAr ? "أرصاد أقمار ناسا الفضائية مقابل الحساسات الحقلية" : "NASA Earth Observation Telemetry vs Ground Truth"}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                    Field Station: Beheira Delta (31.0°N, 30.5°E) · Updated Daily
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNasaModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Telemetry Comparison Body */}
            <div className="space-y-4 py-6 text-xs sm:text-sm">
              
              {/* Parameter 1: Solar Radiation & ET0 */}
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold flex items-center gap-2 text-neutral-900 dark:text-white">
                    <span className="text-amber-500">☀</span>
                    {isAr ? "الإشعاع الشمسي والبخر-نتح المرجعي (ET0)" : "Solar Irradiance & Evapotranspiration (ET0)"}
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">98.5% MATCH</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-neutral-500 block font-mono">NASA POWER (CERES)</span>
                    <strong className="text-neutral-900 dark:text-white">19.4 MJ/m²/day</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block font-mono">GROUND SENSOR</span>
                    <strong className="text-neutral-900 dark:text-white">19.1 MJ/m²/day</strong>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-neutral-500 block font-mono">COMPUTED ET0</span>
                    <strong className="text-[#00a76f]">4.2 mm/day (FAO-56)</strong>
                  </div>
                </div>
              </div>

              {/* Parameter 2: Precipitation & Soil Infiltration */}
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold flex items-center gap-2 text-neutral-900 dark:text-white">
                    <span className="text-sky-500">🌧</span>
                    {isAr ? "الأمطار وتراكم التسرب اليومي" : "Precipitation & Daily Rainfall Accumulation"}
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">96.2% MATCH</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-neutral-500 block font-mono">NASA GPM (IMERG)</span>
                    <strong className="text-neutral-900 dark:text-white">18.5 mm (Monthly)</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block font-mono">LOCAL RAIN GAUGE</span>
                    <strong className="text-neutral-900 dark:text-white">17.8 mm (Monthly)</strong>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-neutral-500 block font-mono">LEACHING POTENTIAL</span>
                    <strong className="text-sky-500">+1.2 mm effective flush</strong>
                  </div>
                </div>
              </div>

              {/* Parameter 3: Root-Zone Volumetric Soil Moisture (SMAP) */}
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold flex items-center gap-2 text-neutral-900 dark:text-white">
                    <span className="text-emerald-500">💧</span>
                    {isAr ? "ملف رطوبة نطاق الجذور (0–100 سم)" : "Root-Zone Moisture Profile (0–100 cm)"}
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">97.0% MATCH</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-neutral-500 block font-mono">NASA SMAP L4 RADAR</span>
                    <strong className="text-neutral-900 dark:text-white">0.32 m³/m³ (Root Zone)</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block font-mono">FIELD FDR PROBE</span>
                    <strong className="text-neutral-900 dark:text-white">0.31 m³/m³ (at 30 cm)</strong>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-neutral-500 block font-mono">HYDROLOGIC STATUS</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">Optimal Field Capacity</strong>
                  </div>
                </div>
              </div>

              {/* Parameter 4: Salinity Hazard & Vegetation Stress (Sentinel/Landsat) */}
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold flex items-center gap-2 text-neutral-900 dark:text-white">
                    <span className="text-purple-500">📈</span>
                    {isAr ? "مؤشر الملوحة الطيفي المعياري (NDSI)" : "Normalized Difference Salinity Index (NDSI)"}
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[10px] font-mono font-bold">CROSS-VALIDATED</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-neutral-500 block font-mono">SENTINEL-2 / LANDSAT</span>
                    <strong className="text-neutral-900 dark:text-white">NDSI = 0.18 (Mild Crust)</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block font-mono">SOIL WATER ECw</span>
                    <strong className="text-amber-500 font-bold">2.8 dS/m</strong>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-neutral-500 block font-mono">ADVISORY ACTION</span>
                    <strong className="text-amber-500">12% Leaching Buffer</strong>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-neutral-200 dark:border-white/10 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setNasaModalOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-white/15 text-xs font-bold hover:bg-neutral-100 dark:hover:bg-white/10 transition"
              >
                {isAr ? "إغلاق والعودة" : "Close & Return"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ==========================================================================
           MODAL 3: GOOGLE OAUTH SIGN-IN MODAL
           ========================================================================== */}
      {authModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAuthModalOpen(false);
          }}
        >
          <div className="w-full max-w-[440px] bg-white/95 dark:bg-[#151b17]/95 border border-white/60 dark:border-white/10 rounded-[32px] shadow-2xl p-7 sm:p-10 backdrop-blur-xl text-neutral-900 dark:text-white text-center transform transition-all relative">
            
            {/* Close Modal Button */}
            <button
              type="button"
              onClick={() => setAuthModalOpen(false)}
              aria-label="Close modal"
              className="absolute top-5 end-5 p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Logo */}
            <div className="flex flex-col items-center mb-3">
              <div className="w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center mb-2">
                <img src="/the_shifters_logo_transparent.png" alt="The Shifters Logo" className="w-full h-full object-contain drop-shadow-xl" />
              </div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#00a76f] font-mono">
                {isAr ? "رحلة في أعماق التربة" : "Journey into the Soil"}
              </div>
            </div>

            {/* Title & Subtitle */}
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
              {isAr ? "تسجيل الدخول عبر Google" : "Sign in with Google"}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 mt-2 max-w-sm mx-auto leading-relaxed">
              {isAr
                ? "سجّل الدخول بحساب Google الخاص بك لتشغيل محاكي فيزياء التربة وأرصاد ناسا الفضائية وتقارير التوصية."
                : "Sign in with your Google account to unlock NASA Earth data, precision soil physics simulation, and recommendation reports."}
            </p>

            {/* ONLY ACTION: Sign in with Google Button */}
            <div className="mt-8 space-y-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isAuthenticating}
                className="w-full py-4 px-6 rounded-2xl font-bold text-sm sm:text-base border border-neutral-300 dark:border-white/15 bg-white dark:bg-white/10 text-neutral-800 dark:text-white shadow-md hover:shadow-lg hover:bg-neutral-50 dark:hover:bg-white/15 transition-all duration-200 flex items-center justify-center gap-3.5 group cursor-pointer active:scale-[0.99] disabled:opacity-60"
              >
                {isAuthenticating ? (
                  <svg className="animate-spin w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 shrink-0 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                )}
                <span>
                  {isAuthenticating
                    ? (isAr ? "جاري الاتصال بـ Google..." : "Connecting to Google...")
                    : (isAr ? "المتابعة باستخدام حساب Google" : "Sign in with Google")}
                </span>
              </button>

              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                {isAr
                  ? "مصادقة فورية وآمنة عبر Google OAuth بنقرة واحدة"
                  : "Fast 1-tap Google OAuth authentication · Direct and secure"}
              </p>
            </div>

          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastText && (
        <div className="fixed bottom-6 end-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--astryx-color-surface-contrast)] text-[var(--astryx-color-text-inverse)] border border-[var(--astryx-color-border)] shadow-2xl backdrop-blur-md transition-all duration-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="text-[var(--astryx-color-primary)]">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span className="text-xs sm:text-sm font-semibold">{toastText}</span>
        </div>
      )}

    </div>
  );
}
