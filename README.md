# Journey Into the Soil

Decision-support web application for **NASA Space Apps Challenge 2026: "Field Shift: Adapting Farms with NASA Data"** (Team: **The Shifters**).

A farmer or agronomist selects a field on a map (or picks from 27 pre-calibrated demo sites across Egypt), combines NASA Earth observations with local soil data, simulates physical agro-hydrological soil dynamics (FAO-56 ET0, Saxton-Rawls pedotransfer, 4-layer soil water balance, and salinity response), evaluates historical multi-year climate uncertainty across 15 analog years (2011–2025), and dives into the soil with a 3D Babylon.js root-zone visualization to compare 3 distinct crop rotation strategies.

> [!IMPORTANT]
> **Support, not replacement.** Advisory estimates only. The engine provides decision support and risk bounds, not definitive agricultural instructions or yield guarantees.
> 
> **Honesty about data.** All synthetic, unreviewed, or qualitative inputs surface explicitly as data gaps and lower overall confidence. Placeholders are never presented as NASA data.

---

## Current Architecture & Status

| Area | Component | State & Capabilities |
| :--- | :--- | :--- |
| **Physics Simulation** | [`api/app/sim`](api/app/sim) | FAO-56 Penman-Monteith daily reference evapotranspiration ($ET_0$), Saxton-Rawls 2006 pedotransfer soil hydraulics, 4-layer soil water balance (dynamic root growth, daily infiltration, percolation, evaporation, transpiration), and Maas-Hoffman salinity yield reduction. Includes high-efficiency headless simulation (`record_daily=False`) for fast historical sweeps and live moisture index ($SMI$) grounding. |
| **Rotation Engine** | [`api/app/engine`](api/app/engine) | Implementation of the FIELD.PUA Section 9 rotation pipeline: input validation, agronomic season windows, soil texture/drainage filters, crop rotation rules (family repetition, leguminous fixation, root depth alternations), sim-informed candidate ranking, and multi-objective scoring (water, soil health, income, risk). Generates 3 strategies: `existing`, `primary`, and `contrast`. |
| **Climate Uncertainty Engine** | [`api/app/engine/uncertainty.py`](api/app/engine/uncertainty.py) | **Schema 1.1.0 Multi-Year Simulation**: Evaluates candidate rotations across 15 historical analog years (2011–2025) under climate scenario shifts ($\Delta T, \Delta P$). Computes $p10, p50, p90$ distributions for irrigation ($mm$), water stress, salinity stress, heat stress days ($>35^\circ\text{C}$), and total rotation score. Computes strategy `rank_stability` and spread-adjusted confidence. Features bidirectional leap year (Feb 29) alignment. Benchmarked at **~3.7 s** per full analysis. |
| **AI Agent & Grounded RAG** | [`api/app/agent`](api/app/agent) & [`api/app/rag`](api/app/rag) | Deterministic rotation orchestration (`/agent/recommend`) with optional LLM explanation layer (never scoring). Source-grounded agronomic assistant (`/agent/ask`, `/knowledge/search`) with BM25 citation retrieval over reviewed knowledge corpus, strict domain refusal, and persistent floating UI assistant. |
| **Live Telemetry & NASA Data** | [`api/app/services`](api/app/services) | Meteomatics downscaled weather & multi-depth soil moisture (`SMI_5cm`, `SMI_50cm`) grounding live simulation runs, alongside real NASA SMAP surface moisture (`SPL3SMP_E`) and VIIRS NDVI (`VNP13A1` v002) observational evidence panels. |
| **Offline Demo Packs** | [`data/packs/demo_sites/`](data/packs/demo_sites) | **27 pre-built offline demo sites** across Egypt (Nile Delta, Upper Egypt, New Valley, Fayoum, Matrouh, Nubaria, Sinai) containing 25+ years (2000–2025) of daily NASA POWER agrometeorology. Zero network dependency at demo runtime. |
| **Data Pipelines** | [`pipelines/`](pipelines) | NASA POWER agrometeorology fetcher, ISRIC SoilGrids extractor, NASA SMAP/NDVI processors, and automated pack compiler ([`pipelines/build_demo_packs.py`](pipelines/build_demo_packs.py)). Covered by 35 dedicated automated tests. |
| **Contract & Schema** | [`contracts/`](contracts) | JSON Schema `1.1.0` in [`contracts/result.schema.json`](contracts/result.schema.json). Generated and validated mock result in [`contracts/mock_result.json`](contracts/mock_result.json). Full bilingual i18n parity (English LTR and Arabic RTL) enforced by [`scripts/check_i18n.py`](scripts/check_i18n.py). |
| **3D Scene & Web UI** | [`web/`](web) | React 18 + Vite + TypeScript + Astryx design tokens. Three.js / Babylon 3D root-zone visualization decoupled cleanly through [`web/src/scene/SceneController.ts`](web/src/scene/SceneController.ts). 3-act sky-to-soil dive, dense multi-plant realistic crop root network, dynamic weather atmosphere HUD, 4-stage guided simulation wizard, executive dashboard, and MapLibre GL parcel selector. Complete RTL/LTR localization. |
| **Deployment & Infra** | [`infra/`](infra) | Docker & Docker Compose setup supporting Linux ARM64 (OCI Ampere A1) and AMD64 with built-in healthchecks, Google OAuth backend endpoints, and Cloudflare Tunnel reverse proxy. |

---

## Key Highlights

### 1. Multi-Year Historical Climate Uncertainty (Schema 1.1.0)
Rather than relying on a single analog weather year, the backend now runs rotational candidates across 15 historical years (2011–2025) from pre-built NASA POWER climate data packs:
- **Scenario Stress Testing**: Applies user-selected temperature shifts ($\Delta T$) and precipitation scaling ($\Delta P$) on top of historical daily series.
- **Risk Distribution ($p10 / p50 / p90$)**: Reports 10th, 50th (median), and 90th percentile bounds for seasonal irrigation needs, crop water stress, salinity-induced yield loss, extreme heat days, and composite rotation score.
- **Rank Stability**: Measures the fraction of historical years in which a recommended strategy maintains its superior rank, exposing climate vulnerability.
- **Spread-Aware Confidence**: High climate variance or unstable ranking penalizes engine confidence and surfaces advisory alerts (`conf.high_climate_variance`).
- **High Performance**: Optimized headless simulation mode evaluates 55 rotation candidates over 15 years in **~3.7 s**, staying comfortably within the 5.0 s ARM VM latency budget.

### 2. 27 Pre-Built Demo Sites Across Egypt
The app requires **no live network access** during demonstrations. 27 agricultural sites covering every major Egyptian agro-ecological zone are packaged locally in `data/packs/demo_sites/`:
- **Nile Delta**: Kafr El-Sheikh, Gharbia, Beheira, Dakahlia, Sharkia, Menofia, Qalyubia, Damietta, Alexandria.
- **Upper Egypt**: Minya, Beni Suef, Assiut, Sohag, Qena, Luxor, Aswan.
- **Reclaimed & Desert Soils**: Nubaria, Wadi El-Natrun, New Valley (Kharga, Dakhla, Farafra), East Oweinat, Toshka, Matrouh, Siwa.
- **Suez Canal & Sinai**: Ismailia, North Sinai.

### 3. Strict Contract-First & i18n Parity
- All engine outputs conform strictly to [`contracts/result.schema.json`](contracts/result.schema.json) (`schema_version: "1.1.0"`).
- All strings returned by the backend are structured internationalization keys (`{key, params}`).
- Arabic (MSA) and English catalogs maintain 100% key parity, verified in CI via [`scripts/check_i18n.py`](scripts/check_i18n.py).

### 4. Deterministic AI Agent & Source-Grounded Agronomic RAG
- **Deterministic Orchestration**: `/agent/recommend` executes the physical rotation engine pipeline and formats actionable advisory recommendations with an optional LLM reasoning layer (LLM only narrates; scoring is 100% mathematical physics).
- **Source-Grounded Assistant**: `/agent/ask` and `/knowledge/search` perform BM25 extractive search over reviewed Egyptian agronomy guidelines and crop YAML definitions. Strict domain bounds provide verifiable citations and transparently refuse out-of-scope inquiries.
- **Persistent Floating Assistant**: Always accessible in the web interface with pre-populated contextual questions based on the active simulation scenario.

### 5. Live Telemetry & NASA Observational Evidence
- **Meteomatics Weather & Soil Grounding**: High-resolution downscaled weather and multi-depth Soil Moisture Index ($SMI_{5cm}$, $SMI_{50cm}$) telemetry initialize actual root-zone moisture conditions, dynamically flagging pre-sowing deficits ($SMD > 50\text{ mm}$).
- **NASA SMAP & VIIRS NDVI Evidence**: Integrates real NASA SMAP surface soil moisture (`SPL3SMP_E`) and VIIRS NDVI (`VNP13A1` v002) series. Transparently labels depth limitations (surface 0–5 cm vs root zone) and provides indicative model-vs-satellite statistical validation (RMSE, MAE, Pearson $r$).

### 6. Cinematic 3D Sky-to-Soil Dive & Botanical Rhizosphere
- **3-Act Cinematic Narrative**: Seamless dive from eye-level agricultural canopy (date palms, cattle herd, field vegetation), through ground-parting excavation, to stratified 4-layer subterranean inspection.
- **Multi-Plant Realistic Root Network**: Procedural organic root splines with dense branching, root hairs, and botanical shading embedded across the Layer 1 cutaway face.
- **Dynamic Weather Atmosphere HUD**: Real-time 3D particle systems for rainfall and dust motes with dynamic ambient lighting and live weather telemetry metrics.

### 7. 4-Stage Simulation Wizard & Executive Dashboard
- **Guided Onboarding**: 4-stage wizard (Field Location & Relief Map -> Soil Characteristics & Irrigation -> Crop History -> Climate Scenarios & Farmer Goals) replaces complex JSON inputs.
- **Executive Decision Dashboard**: Clear comparative matrices showing water requirements, soil health trajectories, gross revenue, and climate risk distributions alongside interactive timeline playback.

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm
- (Optional) Docker & Docker Compose

### Linux / macOS / WSL / Git Bash

```bash
# 1. Bootstrap environment, virtualenv, dependencies, and build packs
bash scripts/bootstrap.sh

# 2. Run backend API (FastAPI on http://127.0.0.1:8000, docs at /docs)
make dev-api

# 3. Run frontend (Vite on http://127.0.0.1:5173)
make dev-web
```

### Windows (PowerShell / Command Prompt)

```powershell
# PowerShell:
powershell -ExecutionPolicy Bypass -File scripts/bootstrap.ps1

# Or in CMD:
scripts\bootstrap.bat
```

### Docker Deployment (OCI Ampere A1 arm64 / amd64)

```bash
cp .env.example .env
docker compose up -d --build
# Web frontend available on http://127.0.0.1:8080 (or through your reverse proxy)
# API available on http://127.0.0.1:8000
```

---

## Verification & Testing

Run all quality and verification checks before committing:

```bash
# Run API test suite (84+ tests including physics, engine, demo packs, uncertainty)
cd api
python -m pytest -q
ruff check .

# Run data pipeline tests (13 tests)
cd ..
python -m pytest pipelines/tests -q

# Verify Arabic and English i18n key parity
python scripts/check_i18n.py

# Benchmark multi-year simulation runtime (target < 5.0 s)
python scripts/benchmark_analysis.py

# Recompile demo site packs from raw NASA data
python pipelines/build_demo_packs.py

# Regenerate mock result from the live engine and validate schema
python scripts/make_mock_result.py
```

---

## Scientific Foundations & Data Sources

1. **NASA POWER Project**: Daily agrometeorology (solar radiation, $T_{max}$, $T_{min}$, precipitation, humidity, wind speed) from 2000 to 2025. Obtained from the NASA Langley Research Center POWER Project funded through the NASA Earth Science Directorate Applied Science Program.
2. **FAO-56 Irrigation and Drainage Paper**: Penman-Monteith method for standard reference crop evapotranspiration ($ET_0$) and dual crop coefficients ($K_c$).
3. **Saxton & Rawls (2006)**: Soil water characteristic equations (pedotransfer functions) estimating wilting point ($\theta_{wp}$), field capacity ($\theta_{fc}$), saturation ($\theta_{sat}$), and hydraulic conductivity ($K_{sat}$) from texture, organic matter, and compaction.
4. **FAO Irrigation and Drainage Papers 29 & 61 / Maas-Hoffman**: Salinity threshold and slope models for crop yield reduction under soil electrical conductivity ($EC_e$) and irrigation water salinity ($EC_w$).
5. **ISRIC SoilGrids 250m**: Global digital soil property maps used as secondary unconfirmed priors when user field measurements are not available.

---

## Project Structure

```text
journey-into-the-soil/
├── api/                       # FastAPI backend
│   ├── app/
│   │   ├── agent/             # Deterministic pipeline agent orchestration & LLM layer
│   │   ├── api/v1/            # Endpoints: /analyses, /demo-sites, /telemetry, /auth
│   │   ├── engine/            # FIELD.PUA rotation engine & climate uncertainty (1.1.0)
│   │   ├── rag/               # Source-grounded agronomic assistant (BM25 retriever)
│   │   ├── services/          # NASA POWER pack loader, Meteomatics API, SoilGrids, SMAP/NDVI
│   │   └── sim/               # Physics: ET0, Saxton-Rawls, 4-layer balance, salinity
│   └── tests/                 # Comprehensive pytest test suite (119+ tests)
├── contracts/                 # Contract-first interface definitions
│   ├── result.schema.json     # Single source of truth JSON Schema (v1.1.0)
│   ├── mock_result.json       # Validated mock result matching schema v1.1.0
│   └── i18n/                  # Bilingual engine translation keys (en.json, ar.json)
├── data/
│   ├── packs/demo_sites/      # 27 validated offline demo packs (NASA POWER 2000-2025)
│   └── raw/                   # Raw NASA POWER, SMAP, and SoilGrids source datasets
├── docs/                      # Documentation, plans, architecture, pitch, benchmarks
├── knowledge/                 # Crop parameters, rotation rules, and agronomy corpus (YAML/MD)
├── pipelines/                 # Offline NASA data acquisition & pack generation scripts (35 tests)
├── scripts/                   # Bootstrap, benchmark, i18n parity check, mock generation
└── web/                       # React 18 + Vite + TypeScript frontend
    ├── src/
    │   ├── api/               # Typed API client with fallback simulation mock
    │   ├── features/          # Modular feature modules:
    │   │   ├── assistant/     # Floating AI Assistant widget
    │   │   ├── inputs/        # 4-Stage Guided Simulation Wizard
    │   │   ├── landing/       # Astryx landing page, Egypt relief map, Auth modal
    │   │   ├── map/           # MapLibre GL parcel selection & satellite base
    │   │   ├── navigation/    # High-contrast top navbar & theme/language controls
    │   │   └── results/       # Executive dashboard, NASA evidence, timeline playback
    │   ├── scene/             # Three.js / Babylon scene controller, 3-act dive, root network
    │   ├── state/             # Zustand state management
    │   └── i18n/              # UI strings and engine translations (en, ar)
    └── public/                # Static assets, textures, 3D models, and demo result
```

---

## License & Team

Developed by **The Shifters** for the NASA Space Apps Challenge 2026.
Advisory output only. See [`AGENTS.md`](AGENTS.md) for project guidelines and non-negotiables.
