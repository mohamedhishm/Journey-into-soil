# NASA Space Apps Challenge 2026 Submission

**Project Title:** Journey Into the Soil: Where Space Data Meets the Root Zone  
**Challenge:** Field Shift: Adapting Farms with NASA Data  
**Team:** The Shifters (Ahmed Yasser, Jewidan, Nada, et al.)  
**Repository:** [github.com/AhmedYasser-1/journey-into-the-soil](https://github.com/AhmedYasser-1/journey-into-the-soil)  

---

## 1. Project One-Liner
A bilingual (English & Arabic) agro-hydrological decision-support web platform that integrates 25 years of NASA Earth observations with 3D rhizosphere simulation and deterministic agronomic modeling to help Egyptian farmers transition toward climate-resilient crop rotations.

---

## 2. Problem Statement
In Egypt's hyper-arid agricultural landscape, smallholders and farm managers face intensifying climate volatility: rising temperatures, extreme heat stress days ($>35^\circ\text{C}$), soil salinization, and severe water scarcity. While NASA operates advanced Earth observation satellites providing continuous environmental data, raw space agency datasets (NetCDF/HDF5 granules spanning continental scales) are incomprehensible and inaccessible to farmers on the ground. Furthermore, farmers cannot afford to risk their livelihoods on speculative trial-and-error rotations. They need transparent, physical, and localized decision support that reveals what happens beneath the soil surface.

---

## 3. What It Does
**Journey Into the Soil** bridges orbit to topsoil:
1. **Interactive Field Selection**: Farmers select any field across Egypt or pick from 27 pre-calibrated agro-ecological demo sites spanning the Nile Delta, Upper Egypt, Fayoum, New Valley, and Sinai.
2. **Deterministic Physics Simulation**: Combines FAO-56 Penman-Monteith reference evapotranspiration ($ET_0$), Saxton-Rawls pedotransfer soil hydraulics, a dynamic 4-layer soil water balance (0–15 cm, 15–30 cm, 30–60 cm, 60–100 cm), and Maas-Hoffman salinity yield response.
3. **Multi-Year Climate Uncertainty (Schema 1.1.0)**: Rather than assuming average weather, the engine sweeps rotational candidates across 15 historical analog years (2011–2025) from NASA POWER datasets. It computes $p10, p50, p90$ probability bounds for seasonal irrigation needs, water stress, extreme heat days, and rank stability under configurable climate shifts ($\Delta T, \Delta P$).
4. **Cinematic 3D Rhizosphere Dive**: A 3-act sky-to-soil dive transitions from the above-ground agricultural field (palms, cattle, crop canopy) through an excavation trench into the subterranean root zone. Farmers inspect realistic procedural root networks across the Layer 1 cutaway face and view real-time weather effects (rain, dust motes, solar lighting).
5. **3 Comparative Strategies**: The system always presents the baseline `existing` rotation alongside a top-ranked `primary` recommendation and an alternative `contrast` strategy, each accompanied by transparent explanations: Why this rotation, Agronomic Evidence, Quantifiable Benefits, Information Gaps, and Local Extension Risks.
6. **Source-Grounded AI Agronomist & RAG**: A persistent floating assistant grounded with BM25 citations over authoritative Egyptian extension literature, ready to answer questions in Arabic and English with zero hallucination.

---

## 4. NASA Earth Observations & External Data
Honesty about data is a foundational non-negotiable of this project:
- **NASA POWER Project**: Daily agrometeorology from 2000 to 2025 across all 27 demo sites ($T_{max}, T_{min}$, precipitation, solar radiation, relative humidity, wind speed) used for historical climate analogs, FAO-56 reference evapotranspiration, and multi-year uncertainty sweeps.
- **NASA SMAP (SPL3SMP_E v006)**: Surface soil moisture observations (top 0–5 cm). The platform explicitly clarifies that root-zone soil moisture is not directly observed by satellite radiometry and requires hydraulic model integration. Satellite-vs-model comparisons are labelled indicative ($RMSE, MAE, r$).
- **NASA / NOAA VIIRS (VNP13A1 v002)**: 500m 16-day NDVI series used for bare-field vs crop timeline validation.
- **ISRIC SoilGrids 250m**: Soil texture (sand, silt, clay) and organic matter used as baseline priors, explicitly tagged as machine-learning estimates until overridden by user soil tests.
- **Meteomatics Weather & Multi-Depth Soil API**: High-resolution downscaled telemetry used to ground initial topsoil and subsoil moisture conditions in live real-time simulations.

---

## 5. Non-Negotiable Core Principles: Support, Not Replace
1. **Advisory bounds, not commands**: The platform outputs decision-support envelopes, never definitive fertilizer application rates, prescriptive instructions, or guaranteed crop yields.
2. **Honesty about data gaps**: Qualitative, synthetic, or unreviewed inputs explicitly lower engine confidence scores and surface as visible warnings.
3. **Contract-first architecture**: Rigid single interface schema (`contracts/result.schema.json` v1.1.0) validated across all services.
4. **100% Bilingual Parity**: Complete feature and key parity across Modern Standard Arabic (RTL) and English (LTR).

---

## 6. AI-Use Disclosure
In full transparency as required by NASA Space Apps Challenge guidelines:
- **Artificial Intelligence Tools Used**: Claude (Anthropic) and Gemini (Google) via Antigravity CLI were utilized during development for code scaffolding, scientific formula verification, test generation, and bilingual copywriting review.
- **Visual Asset Prototyping**: Gemini Image generation was utilized for background illustration concepts and relief map base styling.
- **Simulation Scoring Independence**: All agronomic rankings, physical soil hydraulics, multi-year percentile distributions, and crop rotation rules are executed 100% deterministically by Python mathematical algorithms—AI is never used to score, rank, or fabricate agronomic numbers.

---

## 7. Links & Resources
- **Source Code**: [github.com/AhmedYasser-1/journey-into-the-soil](https://github.com/AhmedYasser-1/journey-into-the-soil)
- **Live Deployment**: Hosted on OCI Ampere A1 (ARM64) via Cloudflare Tunnel.
- **Demonstration Video**: 60-second video demo (see `docs/pitch/video-script.md`).
