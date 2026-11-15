import { create } from "zustand";
import { api, type AuthUser } from "../api/client";
import type { AnalysisRequest, AnalysisResult, DemoSite, Quality, StrategyId, WeatherMode } from "../scene/types";

export const DEFAULT_REQUEST: AnalysisRequest = {
  lat: 30.79,
  lon: 31.0,
  texture: "loam",
  drainage: "good",
  organic_input: "some",
  residues: "unknown",
  irrigation: "flood",
  water_ec: 1.0,
  water_availability: "ample",
  pest: "none",
  next_season: "winter",
  history: [
    { crop: "maize", season: "summer" },
    { crop: "wheat", season: "winter" },
    { crop: "maize", season: "summer" },
  ],
  priorities: { water: 1, soil_health: 1, income: 1, risk: 1 },
  use_live_weather: true,
};

const safeGet = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage may be blocked */
  }
};

interface State {
  request: AnalysisRequest;
  result: AnalysisResult | null;
  strategyId: StrategyId;
  dayT: number;
  lang: "en" | "ar";
  theme: "light" | "dark";
  quality: Quality | "auto";
  weatherMode: WeatherMode;
  loading: boolean;
  error: string | null;
  usingSample: boolean;
  focusedLayer: number | null;
  user: AuthUser | null;
  authToken: string | null;
  userEmail: string | null;
  authModalOpen: boolean;
  pdfModalOpen: boolean;
  nasaModalOpen: boolean;
  assistantOpen: boolean;
  assistantInitialQuery: string | null;
  assistantNotification: string | null;
  setRequest: (patch: Partial<AnalysisRequest>) => void;
  applySite: (site: DemoSite) => void;
  openDemoSite: (site: DemoSite) => Promise<void>;
  analyze: () => Promise<void>;
  loadAnalysis: (id: string) => Promise<void>;
  loadSample: () => Promise<void>;
  applyScenario: (dT: number, dP: number) => Promise<void>;
  reset: () => void;
  setFocusedLayer: (idx: number | null) => void;
  setUser: (user: AuthUser | null, token?: string | null) => void;
  setUserEmail: (email: string | null) => void;
  setAuthModalOpen: (open: boolean) => void;
  setPdfModalOpen: (open: boolean) => void;
  setNasaModalOpen: (open: boolean) => void;
  setAssistantOpen: (open: boolean, initialQuery?: string) => void;
  dismissAssistantNotification: () => void;
  setStrategy: (id: StrategyId) => void;
  setDayT: (t: number) => void;
  setLang: (l: "en" | "ar") => void;
  setTheme: (t: "light" | "dark") => void;
  setQuality: (q: Quality | "auto") => void;
  setWeatherMode: (m: WeatherMode) => void;
}

export const useStore = create<State>((set, get) => ({
  request: DEFAULT_REQUEST,
  result: null,
  strategyId: "primary",
  dayT: 0,
  lang: (safeGet("shifter_lang") || safeGet("lang")) === "ar" ? "ar" : "en",
  theme: (() => {
    const saved = safeGet("shifter_theme") || safeGet("theme");
    if (saved === "light" || saved === "dark") return saved;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  })(),
  quality: "auto",
  weatherMode: "auto",
  loading: false,
  error: null,
  usingSample: false,
  focusedLayer: null,
  user: (() => {
    try {
      const saved = safeGet("shifter_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })(),
  authToken: safeGet("shifter_auth_token") || null,
  userEmail: (() => {
    try {
      const savedUser = safeGet("shifter_user");
      if (savedUser) return JSON.parse(savedUser).email;
      return safeGet("shifters_farmer_email") || null;
    } catch {
      return safeGet("shifters_farmer_email") || null;
    }
  })(),
  authModalOpen: false,
  pdfModalOpen: false,
  nasaModalOpen: false,
  assistantOpen: false,
  assistantInitialQuery: null,
  assistantNotification: null,
  setAssistantOpen: (assistantOpen, initialQuery) =>
    set({
      assistantOpen,
      assistantInitialQuery: initialQuery ?? null,
      assistantNotification: assistantOpen ? null : get().assistantNotification,
    }),
  dismissAssistantNotification: () => set({ assistantNotification: null }),
  setUser: (user, token) => {
    if (user) {
      safeSet("shifter_user", JSON.stringify(user));
      safeSet("shifters_farmer_email", user.email);
      if (token) safeSet("shifter_auth_token", token);
      set({ user, userEmail: user.email, authToken: token || get().authToken });
    } else {
      try {
        localStorage.removeItem("shifter_user");
        localStorage.removeItem("shifters_farmer_email");
        localStorage.removeItem("shifter_auth_token");
      } catch {}
      set({ user: null, userEmail: null, authToken: null });
    }
  },
  setUserEmail: (userEmail) => {
    if (userEmail) safeSet("shifters_farmer_email", userEmail);
    else try { localStorage.removeItem("shifters_farmer_email"); } catch {}
    set({ userEmail });
  },
  setAuthModalOpen: (authModalOpen) => set({ authModalOpen }),
  setPdfModalOpen: (pdfModalOpen) => set({ pdfModalOpen }),
  setNasaModalOpen: (nasaModalOpen) => set({ nasaModalOpen }),
  setRequest: (patch) => set((s) => ({ request: { ...s.request, ...patch } })),
  applySite: (site) =>
    set((s) => ({ request: { ...s.request, ...site.preset, lat: site.lat, lon: site.lon, region: site.region } as AnalysisRequest })),
  openDemoSite: async (site) => {
    const req = {
      ...DEFAULT_REQUEST,
      ...site.preset,
      lat: site.lat,
      lon: site.lon,
      region: site.region,
    } as AnalysisRequest;
    set({ request: req, loading: true, error: null, usingSample: false });
    try {
      const result = await api.analyze(req);
      if (typeof window !== "undefined" && result.request_id) {
        window.history.pushState({ id: result.request_id }, "", `/a/${result.request_id}`);
      }
      set({ result, strategyId: "primary", dayT: 0, loading: false, assistantNotification: "ready" });
    } catch {
      // Offline fallback for demo: load sample
      try {
        const sample = await api.sample();
        if (typeof window !== "undefined" && sample.request_id) {
          window.history.pushState({ id: sample.request_id }, "", `/a/${sample.request_id}`);
        }
        set({ result: sample, strategyId: "primary", dayT: 0, loading: false, usingSample: true, assistantNotification: "ready" });
      } catch (err) {
        set({ loading: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
  },
  analyze: async () => {
    set({ loading: true, error: null, usingSample: false });
    try {
      const result = await api.analyze(get().request);
      if (typeof window !== "undefined" && result.request_id) {
        window.history.pushState({ id: result.request_id }, "", `/a/${result.request_id}`);
      }
      set({ result, strategyId: "primary", dayT: 0, loading: false, assistantNotification: "ready" });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
  loadAnalysis: async (id: string) => {
    set({ loading: true, error: null, usingSample: false });
    try {
      const result = await api.get(id);
      set({ result, strategyId: "primary", dayT: 0, loading: false, request: result.input });
    } catch (e) {
      if (id === "sample" || id === "mock") {
        try {
          const sample = await api.sample();
          set({ result: sample, strategyId: "primary", dayT: 0, loading: false, usingSample: true, request: sample.input });
          return;
        } catch {
          /* ignore */
        }
      }
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
  loadSample: async () => {
    set({ loading: true, error: null });
    try {
      const result = await api.sample();
      if (typeof window !== "undefined" && result.request_id) {
        window.history.pushState({ id: result.request_id }, "", `/a/${result.request_id}`);
      }
      set({ result, strategyId: "primary", dayT: 0, loading: false, usingSample: true, request: result.input });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
  applyScenario: async (dT, dP) => {
    const { result, usingSample } = get();
    if (!result || usingSample) return;
    set({ loading: true, error: null });
    try {
      const next = await api.scenario(result.request_id, dT, dP);
      set({ result: next, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
  reset: () => {
    if (typeof window !== "undefined" && (window.location.pathname.startsWith("/a/") || window.location.hash.startsWith("#/a/"))) {
      window.history.pushState(null, "", "/");
    }
    set({ result: null, error: null, usingSample: false, focusedLayer: null, assistantNotification: null });
  },
  setFocusedLayer: (focusedLayer) => set({ focusedLayer }),
  setStrategy: (strategyId) => set({ strategyId }),
  setDayT: (dayT) => set({ dayT }),
  setLang: (lang) => {
    safeSet("lang", lang);
    safeSet("shifter_lang", lang);
    set({ lang });
  },
  setTheme: (theme) => {
    safeSet("theme", theme);
    safeSet("shifter_theme", theme);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = theme;
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
    set({ theme });
  },
  setQuality: (quality) => set({ quality }),
  setWeatherMode: (weatherMode) => set({ weatherMode }),
}));
