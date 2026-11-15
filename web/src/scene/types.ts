// Mirrors contracts/result.schema.json (schema_version 1.1.0). Change the schema first, then this file.
export type Season = "winter" | "summer" | "nili";
export type StrategyId = "existing" | "primary" | "contrast";
export type Priority = "water" | "soil_health" | "income" | "risk";
export type Quality = "high" | "medium" | "low";

export interface Msg {
  key: string;
  params: Record<string, string | number>;
}
export interface Evidence {
  source: string;
  key: string;
  params: Record<string, string | number>;
}
export interface Layer {
  name_key: string;
  top_cm: number;
  bottom_cm: number;
  sand: number;
  silt: number;
  clay: number;
  om: number;
  ph: number;
  ec: number;
  wp: number;
  fc: number;
  sat: number;
  source: Record<string, "measured" | "estimated">;
  confidence: "low" | "medium" | "high";
}
export interface SeasonPlan {
  season: Season;
  crop: string | null;
  sow_date: string | null;
  harvest_date: string | null;
  indicators: {
    et_mm: number;
    rain_mm: number;
    irrigation_mm: number;
    drainage_mm: number;
    water_stress: number;
    salinity_stress: number;
    heat_days: number;
  } | null;
}
export interface Sim {
  moisture: number[][]; // [layer][day]; 0 = wilting point, 1 = field capacity
  ece: number[][]; // [layer][day] dS/m
  root_cm: number[];
  canopy: number[];
  ks: number[];
  irrigation_mm: number[];
  crop_idx: number[]; // index into non-fallow seasons, -1 when bare
}
export interface UncertaintyMetrics {
  irrigation_mm: number;
  water_stress: number;
  salinity_stress: number;
  heat_days: number;
  total_score: number;
}
export interface StrategyUncertainty {
  rank_stability: number;
  years_evaluated: number;
  p10: UncertaintyMetrics;
  p50: UncertaintyMetrics;
  p90: UncertaintyMetrics;
}
export interface Strategy {
  id: StrategyId;
  label_key: string;
  archetype: "existing" | Priority;
  seasons: SeasonPlan[];
  bare_periods: { start: string; end: string; days: number }[];
  scores: Record<Priority | "total", number>;
  indicators: { irrigation_mm: number; et_mm: number; bare_days: number; span_days: number };
  why: Msg[];
  evidence: Evidence[];
  benefits: Msg[];
  gaps: Msg[];
  risks: Msg[];
  confidence: { level: "low" | "medium" | "high"; score: number; factors: Msg[] };
  uncertainty: StrategyUncertainty;
  sim: Sim;
}
export interface NasaItem {
  id: string;
  name_key: string;
  role_key: string;
  status: "pack" | "live" | "planned" | "placeholder";
  resolution_km: number;
}
export interface SmapComparison {
  n_pairs: number;
  status: string;
  bias_m3m3: number | null;
  rmse_m3m3: number | null;
  mae_m3m3: number | null;
  pearson_r: number | null;
  pairs?: { date: string; observed_m3m3: number; modeled_m3m3: number }[];
}
export interface SmapEvidence {
  status: "pack" | "planned";
  product: string;
  version: string;
  product_title?: string;
  doi?: string;
  variable?: string;
  depth?: string | null;
  root_zone_available?: boolean;
  units?: string;
  resolution_km?: number;
  indicative?: boolean;
  reason?: string;
  n_accepted?: number;
  n_observations_total?: number;
  observations: { date: string; overpass: string; time_utc?: string | null; soil_moisture_m3m3: number | null; uncertainty_m3m3?: number | null; pixel?: { lat: number | null; lon: number | null; distance_km: number | null } }[];
  comparison: Record<string, SmapComparison>;
  limitations: string[];
}
export interface NdviTimelineItem {
  start: string;
  end: string;
  midpoint?: string;
  ndvi: number;
  expected: "crop" | "fallow";
  expected_crop?: string | null;
  observed?: "vegetated" | "low_cover" | "uncertain";
  agreement?: "ok" | "check" | "uncertain";
}
export interface NdviEvidence {
  status: "pack" | "planned";
  product: string;
  version: string;
  product_title?: string;
  variable?: string;
  units?: string;
  resolution_km?: number;
  reason?: string;
  observations: { start: string; end: string; midpoint?: string; ndvi: number | null; quality?: Record<string, string | number | null> }[];
  regional_series?: { start: string; end: string; ndvi: number | null; p25?: number | null; p75?: number | null; vegetated_fraction?: number | null }[];
  timeline_check: {
    basis?: string;
    classification_used: boolean;
    threshold_ndvi?: number | null;
    separation_ndvi?: number | null;
    expected_periods?: { start: string; end: string; crop: string; season: Season }[];
    items: NdviTimelineItem[];
    summary: { n_composites?: number; n_ok?: number; n_check?: number; n_uncertain?: number };
  };
  limitations: string[];
}
export interface NasaEvidence {
  smap: SmapEvidence;
  ndvi: NdviEvidence;
  meteomatics?: {
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
  };
}

/** Answer returned by POST /api/v1/agent/ask. */
export interface AgentAnswer {
  question: string;
  grounded: boolean;
  scope: "general" | "site_specific" | "insufficient";
  answer: { text: string; generated_by: string; sentences?: Msg[] };
  citations: { source: string; passage_id?: string; key?: string; title?: string }[];
  notes: string[];
  request_id?: string;
  knowledge?: { grounded: boolean; passages: { id: string; title: string }[] };
}

export interface AnalysisResult {
  schema_version: string;
  request_id: string;
  candidates_evaluated?: number;
  existing_rank?: number;
  input: AnalysisRequest;
  field: { lat: number; lon: number; area_feddan: number | null; region: string };
  flags: { field: string; key: string; severity: "info" | "warn" | "error"; params: Record<string, string | number> }[];
  input_status: Record<string, "measured" | "estimated">;
  nasa_data: NasaItem[];
  nasa_evidence?: NasaEvidence;
  layers: Layer[];
  climate: {
    dates: string[];
    tmax: number[];
    tmin: number[];
    rain: number[];
    et0: number[];
    source: "synthetic" | "pack";
    scenario: { dT: number; dP: number };
  };
  timeline: { start: string; end: string; days: number };
  strategies: Strategy[];
  needs_local_review: string[];
  disclaimers: string[];
}

export interface AnalysisRequest {
  lat: number;
  lon: number;
  area_feddan?: number | null;
  texture: "sand" | "sandy_loam" | "loam" | "silt_loam" | "clay_loam" | "clay";
  texture_confirmed?: boolean;
  effective_depth_cm?: number;
  drainage: "good" | "moderate" | "poor";
  ph?: number | null;
  soil_ec?: number | null;
  organic_matter?: number | null;
  organic_input: "none" | "some" | "regular";
  residues: "retained" | "burned" | "unknown";
  irrigation: "flood" | "sprinkler" | "drip" | "none";
  water_ec: number;
  water_ec_measured?: boolean;
  water_availability: "ample" | "limited" | "scarce";
  pest: "none" | "nematodes" | "soil_borne" | "unknown";
  history: { crop: string; season: Season }[];
  next_season: Season;
  priorities: Record<Priority, number>;
  scenario?: { dT: number; dP: number };
  use_live_weather?: boolean;
  reference_date?: string | null;
}

export type WeatherMode = "auto" | "sunny" | "rain" | "dust";

export interface DemoSite {
  id: string;
  name_en: string;
  name_ar: string;
  lat: number;
  lon: number;
  region: string;
  preset: Partial<AnalysisRequest> & { texture?: AnalysisRequest["texture"] };
}
export interface CropInfo {
  id: string;
  name_en: string;
  name_ar: string;
  family: string;
  seasons: Season[];
  perennial?: boolean;
}

export type CameraPreset = "perspective" | "cutaway" | "canopy";
export type DiveStage = "field" | "underground" | "layers";

export interface LayerInspectData {
  layerIndex: number;
  nameKey: string;
  topCm: number;
  bottomCm: number;
  sand: number;
  silt: number;
  clay: number;
  availableWaterPct: number; // Share of plant-available water (0 at wilting point, 100 at field capacity)
  moistureStatus: "dry" | "stress" | "optimal" | "saturated";
  salinityDsm: number; // e.g. 2.1 dS/m
  salinityStatus: "low" | "moderate" | "high";
  organicMatter: number; // % OM
}

export interface SceneTelemetry {
  cropId: string | null;
  season: Season | null;
  rootCm: number;
  canopyPct: number;
  et0Mm: number;
  rainMm: number;
  tempC: number;
  date: string;
  isSynthetic: boolean;
}

