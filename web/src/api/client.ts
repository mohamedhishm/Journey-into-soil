import type { AgentAnswer, AnalysisRequest, AnalysisResult, CropInfo, DemoSite } from "../scene/types";

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
const BASE = RAW_BASE
  ? RAW_BASE.endsWith("/api/v1")
    ? RAW_BASE
    : `${RAW_BASE}/api/v1`
  : "/api/v1";

export const DEFAULT_DEMO_SITES: DemoSite[] = [
  {
    id: "kafr_el_sheikh",
    name_en: "Kafr El-Sheikh (northern Delta)",
    name_ar: "كفر الشيخ (شمال الدلتا)",
    lat: 31.11,
    lon: 30.94,
    region: "delta",
    preset: {
      texture: "clay_loam",
      irrigation: "flood",
      water_ec: 2.2,
      ph: 8.0,
      pest: "none",
      history: [
        { crop: "wheat", season: "winter" },
        { crop: "rice", season: "summer" },
        { crop: "wheat", season: "winter" },
      ],
    },
  },
  {
    id: "gharbia",
    name_en: "Gharbia (central Delta)",
    name_ar: "الغربية (وسط الدلتا)",
    lat: 30.79,
    lon: 31.0,
    region: "delta",
    preset: {
      texture: "loam",
      irrigation: "flood",
      water_ec: 0.8,
      ph: 7.9,
      pest: "nematodes",
      history: [
        { crop: "tomato", season: "summer" },
        { crop: "wheat", season: "winter" },
        { crop: "tomato", season: "summer" },
      ],
    },
  },
  {
    id: "nubaria",
    name_en: "West Nubaria (new lands)",
    name_ar: "النوبارية الغربية (أراضٍ جديدة)",
    lat: 30.75,
    lon: 30.15,
    region: "new_lands",
    preset: {
      texture: "sandy_loam",
      irrigation: "sprinkler",
      water_ec: 1.5,
      ph: 8.2,
      pest: "none",
      water_availability: "limited",
      history: [
        { crop: "maize", season: "summer" },
        { crop: "wheat", season: "winter" },
        { crop: "maize", season: "summer" },
      ],
    },
  },
  {
    id: "minya",
    name_en: "Minya (Upper Egypt)",
    name_ar: "المنيا (صعيد مصر)",
    lat: 28.11,
    lon: 30.75,
    region: "upper_egypt",
    preset: {
      texture: "silt_loam",
      irrigation: "flood",
      water_ec: 0.9,
      ph: 7.8,
      pest: "none",
      history: [
        { crop: "sugar_beet", season: "winter" },
        { crop: "maize", season: "summer" },
        { crop: "berseem", season: "winter" },
      ],
    },
  },
  {
    id: "fayoum",
    name_en: "Fayoum (saline depression)",
    name_ar: "الفيوم (منخفض ملحي)",
    lat: 29.31,
    lon: 30.84,
    region: "upper_egypt",
    preset: {
      texture: "clay",
      irrigation: "flood",
      water_ec: 3.2,
      ph: 8.1,
      soil_ec: 5.5,
      pest: "none",
      history: [
        { crop: "cotton", season: "summer" },
        { crop: "wheat", season: "winter" },
        { crop: "cotton", season: "summer" },
      ],
    },
  },
];

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  verified_email?: boolean;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: AuthUser;
}

export interface MeteomaticsTelemetry {
  status: "live" | "demo_analog";
  configured: boolean;
  source: string;
  timestamp: string;
  coordinates: { lat: number; lon: number };
  downscaling_model: string;
  parameters: {
    t_2m_c: number | null;
    relative_humidity_pct: number | null;
    precip_24h_mm: number | null;
    evapotranspiration_24h_mm: number | null;
    soil_moisture_index_5cm: number | null;
    soil_moisture_index_50cm: number | null;
    soil_moisture_deficit_mm: number | null;
  };
  notes: string[];
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} ${detail.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getGoogleAuthUrl: (redirectUri?: string) =>
    fetch(`${BASE}/auth/google/url${redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : ""}`).then((r) =>
      json<{ auth_url: string; client_id: string; configured: boolean; redirect_uri: string }>(r),
    ),
  exchangeGoogleAuth: (payload: { code?: string; credential?: string; redirect_uri?: string }) =>
    fetch(`${BASE}/auth/google/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => json<AuthResponse>(r)),
  getMe: (token: string) =>
    fetch(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => json<{ authenticated: boolean; user: AuthUser }>(r)),
  logout: () => fetch(`${BASE}/auth/logout`, { method: "POST" }).then((r) => json<{ success: boolean }>(r)),
  analyze: (req: AnalysisRequest) =>
    fetch(`${BASE}/analyses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) }).then(
      (r) => json<AnalysisResult>(r),
    ),
  scenario: (id: string, dT: number, dP: number) =>
    fetch(`${BASE}/analyses/${id}/scenario`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dT, dP }),
    }).then((r) => json<AnalysisResult>(r)),
  get: (id: string) => fetch(`${BASE}/analyses/${id}`).then((r) => json<AnalysisResult>(r)),
  crops: () => fetch(`${BASE}/crops`).then((r) => json<CropInfo[]>(r)),
  demoSites: () =>
    fetch(`${BASE}/demo-sites`)
      .then((r) => json<DemoSite[]>(r))
      .then((sites) => (sites && sites.length > 0 ? sites : DEFAULT_DEMO_SITES))
      .catch(() => DEFAULT_DEMO_SITES),
  lookup: (lat: number, lon: number) =>
    fetch(`${BASE}/geo/lookup?lat=${lat}&lon=${lon}`).then((r) =>
      json<{
        region: string;
        in_delta_area: boolean;
        climate: { source: string; resolution_km: number | null; mean_tmax: number; mean_tmin: number; annual_rain_mm: number; annual_et0_mm: number };
      }>(r),
    ),
  sample: () => fetch("/mock_result.json").then((r) => json<AnalysisResult>(r)),
  meteomatics: (lat: number, lon: number) =>
    fetch(`${BASE}/telemetry/meteomatics?lat=${lat}&lon=${lon}`).then((r) => json<MeteomaticsTelemetry>(r)),
  ask: (question: string, farmer?: AnalysisRequest, analysisId?: string) =>
    fetch(`${BASE}/agent/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, farmer, analysis_id: analysisId }),
    }).then((r) => json<AgentAnswer>(r)),
};
